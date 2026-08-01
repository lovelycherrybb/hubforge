# HubForge 任务跟踪

> 新会话启动时先读本文件，获取当前上下文。

---

## 进行中

（暂无）

---

## 已完成

### 安全修复批次（2026-07-29）— 全部完成 ✅
- ✅ `src/lib/rls-pg.ts` — 新增 pg Pool 版 RLS 上下文（独占连接 + set_config 参数化）
- ✅ `src/app/api/apps/route.ts` — 补 withTenantContext
- ✅ `src/app/api/apps/[id]/token/route.ts` — 补 withTenantContext + JWT_SECRET 从 auth.ts 导入 + perm 为 null 拒绝
- ✅ `src/app/api/auth/me/route.ts` — 补 withTenantContext
- ✅ `src/app/api/apps/verify-token/route.ts` — JWT_SECRET 从 auth.ts 导入
- ✅ `src/app/api/auth/login/route.ts` — JSON 解析 try-catch + 登录锁定机制

### 早期修复
- ✅ `src/lib/rls.ts` — 新增 `setUserContext`，`withTenantContext` 增加 userId 参数
- ✅ `src/app/api/users/[id]/route.ts` — isGlobalAdmin 改为仅 owner
- ✅ `src/app/api/tenants/route.ts` — generateTempPassword 改用 crypto.randomBytes
- ✅ `src/app/(dashboard)/layout.tsx` — H5 底部导航链接修正
- ✅ `src/app/api/apps/[id]/route.ts` — 权限检查默认拒绝
- ✅ `src/app/api/departments/route.ts` — 补 withTenantContext
- ✅ `src/app/api/permissions/route.ts` — 补 withTenantContext
- ✅ `src/app/api/users/route.ts` — 补 withTenantContext

### 流程建设
- ✅ 开发流程规范 `docs/dev-process.md` 定稿
- ✅ AGENTS.md 更新至构建阶段

---

## 规则备忘

- PRD 与代码不一致 → 以代码为准（PRD 滞后）
- 无邮箱系统 → 临时密码 API 明文返回是合理的
- iframe sandbox 不含 allow-same-origin → 设计决策，非 bug
