# HubForge 应用接入指南

> 版本: v1.0 | 最后更新: 2026-07-27

---

## 一、接入方式概览

HubForge 支持两种应用接入模式：

| 模式 | 适用场景 | 是否需要改代码 | 用户体验 |
|------|---------|-------------|---------|
| **iframe 嵌入** | 大多数 vibecoding 应用 | 可选（加 SDK 获得身份信息） | 应用在 Portal 内展示 |
| **独立应用** | 有独立域名的正式应用 | 需要集成认证 | 独立访问，SSO 跳转 |

**推荐：iframe 嵌入 + 浏览器 SDK**，30 分钟内完成接入。

---

## 二、快速接入（iframe 嵌入模式）

### 步骤 1：在 HubForge 注册应用

管理员在 HubForge 后台 → 应用管理 → 新增应用：

- **应用名称**：给应用起个名字
- **应用标识 (slug)**：如 `my-app`，只能用小写字母、数字、连字符
- **应用类型**：PC / H5 / 两者
- **应用 URL**：应用的访问地址
  - 开发环境：`http://localhost:3001`
  - 生产环境（同域）：`/app/my-app/`
  - 跨域：`https://my-app.example.com`

注册成功后，系统会自动创建框架权限 `app.my-app.access`。

### 步骤 2：（可选）在应用中集成 SDK

如果你的应用需要知道"当前用户是谁"、"用户有哪些权限"，集成浏览器 SDK：

```html
<!-- 在应用的 HTML 中引入 SDK -->
<script src="/sdk/hubforge-sdk.js"></script>
<script>
  const hubforge = new HubForgeSDK();

  hubforge.onAuth(function(auth) {
    console.log('用户:', auth.user.name);       // "张三"
    console.log('租户:', auth.user.tenantId);    // "clx..."
    console.log('权限:', auth.permissions);       // ["admin", "editor"]
    console.log('配置:', auth.config);            // { theme: "dark" }
    console.log('Token:', auth.token);            // JWT 字符串

    // 用 Token 调用应用自己的后端 API
    fetch('/api/data', {
      headers: { 'X-HubForge-Token': auth.token }
    });
  });

  hubforge.onReady(function() {
    console.log('已连接到 HubForge Portal');
  });

  hubforge.onError(function(err) {
    console.error('认证失败:', err.message);
  });
</script>
```

**SDK 不需要集成也能用** — 应用照样在 iframe 中运行，只是拿不到用户身份。

### 步骤 3：（可选）声明应用权限

如果你的应用需要细粒度权限控制（如 admin / editor / viewer），通过 API 声明：

```bash
# 应用管理员调用（需要主租户权限）
curl -X POST https://portal.example.com/api/apps/{appId}/register-permissions \
  -H "Content-Type: application/json" \
  -H "Cookie: hubforge-token=..." \
  -d '{
    "permissions": [
      { "key": "admin", "label": "管理员" },
      { "key": "editor", "label": "编辑者" },
      { "key": "viewer", "label": "查看者" }
    ]
  }'
```

声明后，租户管理员可以在 HubForge 后台给用户/部门分配这些权限。

---

## 三、SDK API 参考（浏览器端）

### new HubForgeSDK(options?)

创建 SDK 实例。可选参数：
- `autoRequest` (boolean, 默认 true)：是否自动向 Portal 请求认证
- `maxRetries` (number, 默认 3)：最大重试次数

### 事件回调

```javascript
hubforge.onAuth(callback)   // 认证成功时触发，callback(authData)
hubforge.onReady(callback)  // 连接就绪时触发
hubforge.onError(callback)  // 认证失败时触发
```

### authData 结构

```typescript
{
  token: string;           // JWT Token（1小时有效）
  user: {
    id: string;            // 用户 ID
    email: string;         // 邮箱
    name: string;          // 姓名
    tenantId: string;      // 租户 ID
  };
  permissions: string[];   // 权限 key 列表
  config: Record<string, string>;  // 应用配置
  appSlug: string;         // 应用标识
}
```

### 实用方法

```javascript
hubforge.getToken()                     // 获取 Token 字符串
hubforge.hasPermission("editor")        // 检查是否有某权限
hubforge.getConfig("theme", "light")    // 获取配置值（带默认值）
hubforge.isEmbedded()                   // 是否运行在 iframe 中
hubforge.refreshAuth()                  // 请求重新认证（Token 过期时）
hubforge.close()                        // 请求关闭应用
hubforge.navigate("/other-page")        // 请求 Portal 页面跳转
hubforge.resize(600)                    // 通知 Portal 调整 iframe 高度
```

---

## 四、Node.js SDK（服务端验证）

应用后端可以用 Node.js SDK 验证 Token：

```typescript
import { HubForgeClient } from './hubforge-sdk-node';

const hubforge = new HubForgeClient({
  portalUrl: 'https://portal.example.com',
  appSlug: 'my-app',
});

// Express/Koa/Next.js 中间件
async function authMiddleware(req, res, next) {
  const token = req.headers['x-hubforge-token'];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const auth = await hubforge.verifyToken(token);
  if (!auth.valid) return res.status(401).json({ error: auth.error });

  req.hubforge = auth;  // auth.userId, auth.tenantId, auth.permissions...
  next();
}
```

---

## 五、认证流程详解

```
┌───────────────┐     ┌──────────────┐     ┌───────────────┐
│   用户浏览器    │     │ HubForge     │     │  嵌入式应用     │
│               │     │  Portal      │     │  (iframe)      │
└───────┬───────┘     └──────┬───────┘     └───────┬───────┘
        │                    │                      │
        │  1. 点击应用卡片    │                      │
        │───────────────────>│                      │
        │                    │                      │
        │  2. 加载 iframe    │                      │
        │─────────────────────────────────────────>│
        │                    │                      │
        │                    │  3. hubforge:ready   │
        │                    │<─────────────────────│
        │                    │                      │
        │                    │  4. 签发 App Token   │
        │                    │──────┐               │
        │                    │      │ JWT(userId,   │
        │                    │<─────┘ tenantId,     │
        │                    │       permissions)   │
        │                    │                      │
        │                    │  5. hubforge:auth    │
        │                    │─────────────────────>│
        │                    │                      │
        │                    │     6. 应用使用 Token │
        │                    │        展示个性化内容  │
```

**安全说明**：
- Token 由 Portal 通过 postMessage 传递，不经过 URL
- Token 有效期 1 小时，过期后应用可调用 `hubforge.refreshAuth()` 刷新
- Token 包含 userId + tenantId + permissions，由 HubForge JWT_SECRET 签名
- 应用后端可通过 `/api/apps/verify-token` 验证 Token 真伪

---

## 六、多租户数据隔离

### 应用如何知道当前租户？

```javascript
hubforge.onAuth(function(auth) {
  const tenantId = auth.user.tenantId;
  // 用 tenantId 过滤你的业务数据
  // 例如：SELECT * FROM orders WHERE tenant_id = ?
});
```

### 推荐的隔离策略

| 策略 | 实现方式 | 适用场景 |
|------|---------|---------|
| **行级隔离** | 所有业务表加 tenantId 字段，查询时强制过滤 | 大多数 vibecoding 应用 |
| **Schema 隔离** | 每个租户一个 PostgreSQL Schema | 数据量大、安全要求高 |
| **库级隔离** | 每个租户一个数据库 | 极端隔离需求 |

**vibecoding 应用推荐行级隔离** — 在每条数据记录上标注 tenantId，查询时加 WHERE 条件。

### 配置隔离

应用的配置分两层：
- **全局配置** (AppConfig)：所有租户共享，如应用版本号
- **租户配置** (TenantAppConfig)：每个租户独立，如 API Key、功能开关

SDK 中通过 `hubforge.getConfig(key)` 自动获取合并后的配置（租户配置优先）。

---

## 七、应用接入检查清单

接入完成后，请逐项确认：

- [ ] 应用已在 HubForge 后台注册（有 slug 和 URL）
- [ ] 应用 URL 可正常访问（HubForge 能加载 iframe）
- [ ] （如需身份）SDK 已集成，onAuth 回调可收到用户信息
- [ ] （如需权限）已通过 register-permissions API 声明权限
- [ ] （如需租户隔离）业务数据已按 tenantId 过滤
- [ ] 应用在 PC (1280px) 和 H5 (375px) 下布局正常
- [ ] 应用不依赖 `allow-same-origin`（iframe 沙箱限制）
- [ ] 应用不弹出 `window.open`（会被沙箱拦截）

---

## 八、常见问题

### Q: 应用不集成 SDK 能用吗？
A: 能。应用照常在 iframe 中运行，只是拿不到用户身份。适合不需要用户信息的纯展示应用。

### Q: Token 过期了怎么办？
A: 调用 `hubforge.refreshAuth()`，Portal 会重新签发 Token 并通过 postMessage 发送。

### Q: 应用可以调用 HubForge 的 API 吗？
A: 可以，但需要在请求头中携带应用 Token：`X-HubForge-Token: <token>`。目前仅支持 `/api/apps/verify-token` 端点，后续会扩展。

### Q: 跨域应用怎么接入？
A: 跨域应用同样通过 postMessage 通信，不受同源策略限制。但 Cookie 不共享，所以应用后端需要通过 Token（而非 Cookie）验证身份。

### Q: iframe 沙箱限制了什么？
A: 当前沙箱配置：`allow-scripts allow-forms`。允许执行 JS 和提交表单，但禁止访问父页面 DOM、Cookie、localStorage。
