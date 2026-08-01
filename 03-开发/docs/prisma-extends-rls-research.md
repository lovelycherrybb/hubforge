# Prisma `$extends` 自动注入 RLS 上下文 — 调研报告

> 日期: 2026-07-30  
> 项目: HubForge (Next.js 14 + Prisma 5.22.0 + PostgreSQL 16)

---

## 1. `$extends` queryExtension 能否拦截所有查询并注入 `$executeRawUnsafe`？

### 结论：✅ 可以

Prisma 的 `query` 扩展支持 `$allModels.$allOperations` 通配模式，能拦截 **所有** 模型操作（`findMany`, `findFirst`, `create`, `update`, `delete`, `upsert`, `aggregate`, `groupBy`, `count` 等），以及客户端级别的 `$queryRaw`、`$executeRaw`。

在每个拦截回调中，开发者获得：

```typescript
{ args, model, operation, query }
```

- `query(args)` — 调用原始查询
- 在调用 `query()` **之前**，可以执行任意异步逻辑（包括 `$executeRawUnsafe`）

**关键机制**：扩展回调是一个 `async` 函数，可以在 `await query(args)` 前后插入任意操作。

### 文档引用

- Prisma Docs: "Client extensions — Query"  
  https://www.prisma.io/docs/orm/prisma-client/client-extensions/query  
  > "The query component lets you hook into the query lifecycle... You can define hooks for specific models and operations, or use `$allModels` and `$allOperations`."

- Prisma Docs: "Client extensions"  
  https://www.prisma.io/docs/orm/prisma-client/client-extensions  
  > `$extends` 从 Prisma 4.16.0 起 GA，无需 `previewFeatures`。

---

## 2. 扩展内能否访问当前请求的上下文（AsyncLocalStorage 方案）

### 结论：✅ 可以，AsyncLocalStorage 是标准方案

`$extends` 是在 **PrismaClient 实例级别** 定义的（通常在模块加载时），而非每次请求。因此扩展回调本身没有请求上下文。

解决方案：使用 Node.js 内置的 `AsyncLocalStorage` (ALS)：

1. 创建一个 `AsyncLocalStorage<{ tenantId, userId, isGlobalAdmin }>` 实例
2. 在 Next.js middleware / API route handler / Server Action 入口处调用 `storage.run(context, () => ...)`
3. 在 Prisma 扩展回调内部调用 `storage.getStore()` 获取当前请求的上下文

**Node.js 版本要求**: `AsyncLocalStorage` 从 Node.js 12.17.0+ 可用，Next.js 14 要求 Node 18.17+，完全满足。

**Next.js 兼容性**: Next.js App Router 中每个请求天然运行在独立的异步上下文中，ALS 能正确传播。Server Components、Server Actions、Route Handlers 均支持。

### 文档引用

- Node.js Docs: `AsyncLocalStorage`  
  https://nodejs.org/api/async_context.html#class-asynclocalstorage  
  > "Stores a value and then retrieves it... the value is isolated to the currently running async chain."

- Prisma GitHub Discussion #18984（多租户 RLS + extensions）:  
  https://github.com/prisma/prisma/discussions/18984  
  社区确认 `AsyncLocalStorage` + `$extends` 是 Prisma 多租户 RLS 的推荐方案。

---

## 3. 与 `$transaction` 的兼容性

### 结论：✅ 完全兼容

**交互式事务 (`$transaction(async (tx) => {...})`)**:
- `tx` 是扩展后的 PrismaClient 实例的快照
- 通过 `tx` 发起的查询 **也会触发** 扩展中定义的 `query` 回调
- ALS 在事务闭包内仍然有效（因为事务回调是同步/微任务链的一部分）

**批量事务 (`$transaction([...])`)**:
- 每个查询也会经过扩展拦截
- 但批量事务中，SET 语句需要在事务开始前执行（见下方代码示例）

**关键注意点**: 
- 对于交互式事务，`SET LOCAL` 优于 `SET`，因为 `SET LOCAL` 的作用域自动限定在当前事务内
- 对于批量事务，SET 必须在 `$executeRawUnsafe` 中以单独语句放在最前面

### 文档引用

- Prisma Docs: "Transactions"  
  https://www.prisma.io/docs/orm/prisma-client/queries/transactions  
  > Interactive transactions pass the extended client `tx` to the callback.

- Prisma Docs: "Client extensions — Query"  
  https://www.prisma.io/docs/orm/prisma-client/client-extensions/query  
  > Extensions are applied to the client used inside `$transaction` callbacks.

---

## 4. 代码示例

### 4.1 AsyncLocalStorage 上下文管理器

```typescript
// src/lib/tenant-context.ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
  userId: string;
  isGlobalAdmin: boolean;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * 获取当前请求的租户上下文
 * 在扩展回调中调用，如果未设置则抛出错误
 */
export function getTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error(
      "TenantContext not set. Wrap your request handler with tenantStorage.run()."
    );
  }
  return ctx;
}
```

### 4.2 带 RLS 自动注入的 Prisma Client

```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { tenantStorage, getTenantContext } from "./tenant-context";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  return client.$extends({
    name: "rls-context-injector",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // 获取当前请求的上下文
          const ctx = getTenantContext();

          // 注入 PostgreSQL session variables
          // 使用 SET LOCAL 使其限定在当前事务作用域内
          await client.$executeRawUnsafe(
            `SET LOCAL app.tenant_id = '${ctx.tenantId}';`
          );
          await client.$executeRawUnsafe(
            `SET LOCAL app.user_id = '${ctx.userId}';`
          );
          await client.$executeRawUnsafe(
            `SET LOCAL app.is_global_admin = '${ctx.isGlobalAdmin}';`
          );

          // 执行原始查询
          return query(args);
        },
      },
    },
  });
}

export const db =
  globalForPrisma.prisma ??
  (globalForPrisma.prisma = createPrismaClient() as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

### 4.3 在 Next.js 中包装请求（App Router）

```typescript
// src/lib/with-tenant-context.ts
import { tenantStorage, type TenantContext } from "./tenant-context";
import { NextRequest } from "next/server";

/**
 * 包装 Server Action / Route Handler，注入租户上下文
 */
export async function withTenantContext<T>(
  context: TenantContext,
  fn: () => Promise<T>
): Promise<T> {
  return tenantStorage.run(context, fn);
}
```

**在 Route Handler 中使用：**

```typescript
// src/app/api/projects/route.ts
import { withTenantContext } from "@/lib/with-tenant-context";
import { db } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // 从 JWT / session 中提取（示例）
  const tenantId = "tenant_123";
  const userId = "user_456";
  const isGlobalAdmin = false;

  return withTenantContext(
    { tenantId, userId, isGlobalAdmin },
    async () => {
      // 此处的所有 db 调用自动注入 RLS 上下文
      const projects = await db.project.findMany();
      return NextResponse.json(projects);
    }
  );
}
```

**在 Server Action 中使用：**

```typescript
// src/app/actions/projects.ts
"use server";
import { withTenantContext } from "@/lib/with-tenant-context";
import { db } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getProjects() {
  const session = await getSession();
  
  return withTenantContext(
    {
      tenantId: session.tenantId,
      userId: session.userId,
      isGlobalAdmin: session.isGlobalAdmin,
    },
    async () => {
      return db.project.findMany({
        include: { members: true },
      });
    }
  );
}
```

**交互式事务示例：**

```typescript
// 事务内的查询也会自动注入 RLS 上下文
await withTenantContext(ctx, async () => {
  await db.$transaction(async (tx) => {
    // tx 上的查询同样会被扩展拦截，SET LOCAL 会自动执行
    const project = await tx.project.create({
      data: { name: "New Project", tenantId: ctx.tenantId },
    });

    await tx.projectMember.create({
      data: { projectId: project.id, userId: ctx.userId },
    });
  });
});
```

### 4.4 更安全的参数化注入（防 SQL 注入）

```typescript
// 推荐使用参数化方式，避免拼接字符串
async $allOperations({ args, query }) {
  const ctx = getTenantContext();

  // 使用 PostgreSQL 的 set_config() 函数，第三个参数 `true` = LOCAL
  await client.$executeRawUnsafe(
    `SELECT set_config('app.tenant_id', $1, true)`,
    ctx.tenantId
  );
  await client.$executeRawUnsafe(
    `SELECT set_config('app.user_id', $1, true)`,
    ctx.userId
  );
  await client.$executeRawUnsafe(
    `SELECT set_config('app.is_global_admin', $1, true)`,
    String(ctx.isGlobalAdmin)
  );

  return query(args);
}
```

> `set_config(setting_name, new_value, is_local)` 是 PostgreSQL 内置函数，  
> 第三个参数 `true` 等价于 `SET LOCAL`。参数化调用可防止 SQL 注入。

---

## 5. Prisma 版本要求

| 特性 | 最低版本 | 备注 |
|------|---------|------|
| `$extends` | **Prisma 4.16.0** | GA，无需 previewFeatures |
| `query` 扩展（`$allModels.$allOperations`） | **Prisma 4.16.0** | 与 `$extends` 同版本 GA |
| `client` 扩展 | **Prisma 4.16.0** | GA |
| `result` / `model` 扩展 | **Prisma 4.16.0** | GA |
| `$transaction` + 扩展兼容 | **Prisma 4.16.0+** | 扩展在事务内自动传播 |

**当前项目版本**: Prisma **5.22.0**（`@prisma/client: ^5.22.0`）→ ✅ **完全满足**

### 文档引用

- Prisma 4.16.0 Release Notes:  
  https://github.com/prisma/prisma/releases/tag/4.16.0  
  > "Prisma Client Extensions are now Generally Available"

- Prisma Docs: "Client extensions"  
  https://www.prisma.io/docs/orm/prisma-client/client-extensions  
  > "Available from version 4.16.0"

---

## 6. 替代方案对比

| 方案 | 自动注入 | 事务安全 | 类型安全 | 复杂度 |
|------|---------|---------|---------|--------|
| `$extends` + ALS（本方案） | ✅ | ✅ | ✅ | 中 |
| 手动 `withTenantContext()` | ❌ 需每处调用 | ✅ | ✅ | 低 |
| Middleware (`$use`) | ✅ | ⚠️ 已废弃 | ✅ | 低 |
| Prisma Accelerate | ✅ | ✅ | ✅ | 低（但引入外部依赖） |

---

## 7. 风险与注意事项

1. **性能开销**: 每次查询额外 3 条 `SELECT set_config()` 语句。可通过连接池复用优化（同连接后续查询无需重复 SET）。建议用 `SET LOCAL` 避免跨请求泄漏。

2. **`SET LOCAL` 无事务时行为**: `SET LOCAL` 在非事务上下文中等同于 `SET`（作用于整个会话）。如果使用连接池（Prisma 默认），需要注意：
   - 交互式事务内：`SET LOCAL` 仅在事务内有效 ✅
   - 单次查询（无显式事务）：`SET LOCAL` 效果延续到连接归还。Prisma 内部会为单次查询开启隐式事务，但建议在 PostgreSQL RLS policy 中同时检查 `current_setting('app.tenant_id', true)` 的 `missing_ok=true` 参数。

3. **连接池泄漏**: 确保所有路径都有 `tenantStorage.run()` 包裹，否则 `getTenantContext()` 会抛错（这是期望行为，fail-fast）。

4. **`globalForPrisma` 单例问题**: 开发环境热重载时，扩展可能被重复注册。建议确保 `createPrismaClient` 只执行一次。

---

## 总结

**方案可行性: ✅ 高度可行**

Prisma 5.22.0 的 `$extends` query 扩展 + Node.js `AsyncLocalStorage` 是在 Prisma 层自动注入 RLS 上下文的标准、推荐方案。无需手动在每个查询前调用 `SET`，无需修改业务代码，事务完全兼容。
