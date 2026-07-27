# 华检科 HubForge — 应用接入指南

> **版本**: v1.0 | **更新**: 2026-07-27
> **面向**: vibecoding 应用开发者（业务人员/技术人员）

---

## 一句话说明

你的应用部署到 HubForge 同域下，用户从 HubForge 点进去，自动登录，直接用。

---

## 架构总览

```
用户浏览器
    │
    ▼
┌─────────────────────────────────────────────┐
│  hubforge.com（HubForge 门户）               │
│  ├── /                    → 首页（应用列表）  │
│  ├── /app/inspection/     → 巡检应用（iframe）│
│  ├── /app/vc-inspection/  → VC巡检（iframe）  │
│  └── /api/*               → 统一 API         │
└─────────────────────────────────────────────┘
         │                    │
         │ Cookie 自动共享     │ 同域
         ▼                    ▼
    ┌──────────┐      ┌──────────┐
    │ 你的应用  │      │ 他的应用  │
    │ 调API获取 │      │ 调API获取 │
    │ 用户信息  │      │ 用户信息  │
    └──────────┘      └──────────┘
```

**核心原则**：所有应用和 HubForge 在同一个域名下，Cookie 天然共享，用户无感知。

---

## 认证机制

### 用户不需要二次登录

```
1. 用户在 hubforge.com 登录
   → HubForge 签发 JWT，存入 httpOnly Cookie（名称: hubforge-token）

2. 用户点击某个应用
   → HubForge 通过 iframe 加载 hubforge.com/app/xxx/

3. iframe 内的应用发起 API 请求（如 fetch('/api/auth/me')）
   → 浏览器自动携带 Cookie（因为同域）
   → HubForge 验证 JWT，返回用户信息

全程无需应用自己做登录页面。
```

### 应用如何获取当前用户

```javascript
// 在你的应用中直接调用
const res = await fetch('/api/auth/me', {
  credentials: 'include'  // 确保携带 Cookie
});
const { data: user } = await res.json();

console.log(user);
// {
//   id: "xxx",
//   email: "zhangsan@company.com",
//   name: "张三",
//   isGlobalAdmin: false,
//   tenant: { id: "xxx", name: "华检科" },
//   department: { id: "xxx", name: "生产部" },
//   permissions: [{ key: "inspection.view", label: "查看巡检" }]
// }
```

### 认证失败处理

如果 API 返回 `401 { success: false, error: "请先登录" }`，说明 Cookie 过期或无效。应用应提示用户返回 HubForge 重新登录。

---

## 组织架构共享

应用不需要自己维护组织架构，直接调 HubForge API 获取。

### 获取部门树

```javascript
const res = await fetch('/api/departments/tree', {
  credentials: 'include'
});
const { data: departments } = await res.json();

// 返回树形结构
// [
//   {
//     id: "xxx",
//     name: "总公司",
//     children: [
//       { id: "xxx", name: "生产部", userCount: 15, children: [...] },
//       { id: "xxx", name: "质检部", userCount: 8, children: [] }
//     ]
//   }
// ]
```

### 获取本租户用户列表

```javascript
const res = await fetch('/api/users?page=1&pageSize=100', {
  credentials: 'include'
});
const { data: users, pagination } = await res.json();

// [
//   { id: "xxx", email: "zhangsan@company.com", name: "张三", department: { name: "生产部" } },
//   { id: "xxx", email: "lisi@company.com", name: "李四", department: { name: "质检部" } }
// ]
```

### 获取当前用户的部门信息

```javascript
const { data: user } = await (await fetch('/api/auth/me', { credentials: 'include' })).json();

console.log(user.department);  // { id: "xxx", name: "生产部" }
```

---

## 权限控制

### 两层权限体系

```
框架权限（主租户控制）
├── 谁能访问哪个应用
└── 由 HubForge 管理后台配置

应用权限（租户管理员控制）
├── 应用内的角色和功能权限
└── 由租户管理员在 HubForge 后台配置
```

### 应用如何声明权限

在 `hubforge.config.json` 中声明应用需要的权限：

```json
{
  "name": "设备巡检",
  "permissions": [
    { "key": "inspection.view", "label": "查看巡检" },
    { "key": "inspection.submit", "label": "提交巡检" },
    { "key": "inspection.approve", "label": "审批巡检" }
  ]
}
```

权限注册到 HubForge 后，由**租户管理员**在 HubForge 后台决定哪些用户/部门拥有哪些权限。

### 应用如何检查权限

```javascript
// 方式1：获取用户全部权限（从 /api/auth/me）
const { data: user } = await (await fetch('/api/auth/me', { credentials: 'include' })).json();
const canSubmit = user.permissions.some(p => p.key === 'inspection.submit');

// 方式2：单独检查某个权限
const res = await fetch('/api/permissions/check?key=inspection.submit', {
  credentials: 'include'
});
const { data: { hasPermission } } = await res.json();
```

### 权限规则

- **取并集**：用户个人权限 ∪ 所在部门权限，合并生效
- **只做加法**：没有"拒绝"权限，没有授予 = 没有权限
- **类型隔离**：`framework` 类型权限只有主租户能分配，`app` 类型权限由租户管理员分配

---

## 部署要求

### 必须同域

```
✅ 正确：
   HubForge: hubforge.com
   你的应用: hubforge.com/app/your-app/
   → Cookie 自动共享，认证无感知

✅ 也可以（子域名，需配置 Cookie domain）：
   HubForge: hubforge.com
   你的应用: app.hubforge.com
   → 需要 HubForge 配置 Cookie domain=.hubforge.com

❌ 不行：
   HubForge: hubforge.com
   你的应用: your-app.vercel.app
   → Cookie 不共享，认证失败
```

### Nginx 反向代理配置示例

```nginx
server {
    listen 443 ssl;
    server_name hubforge.com;

    # HubForge 门户
    location / {
        proxy_pass http://localhost:3000;
    }

    # 你的应用
    location /app/your-app/ {
        proxy_pass http://localhost:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 另一个应用
    location /app/another-app/ {
        proxy_pass http://localhost:3002/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 接入步骤（5 分钟）

### 第 1 步：开发你的应用

用 vibecoding 工具（Cursor/Claude Code）开发，本地运行测试。

```
你的应用/
├── index.html（或 src/App.tsx）
├── hubforge.config.json
└── ...
```

### 第 2 步：创建配置文件

在应用根目录创建 `hubforge.config.json`：

```json
{
  "name": "你的应用名称",
  "type": "h5",
  "description": "一句话描述",
  "permissions": [
    { "key": "your-app.view", "label": "查看" },
    { "key": "your-app.edit", "label": "编辑" }
  ]
}
```

type 可选值：
- `"pc"` — PC 网页应用
- `"h5"` — 移动端应用
- `"both"` — PC 和 H5 都支持

### 第 3 步：部署到 HubForge 同域

把应用部署到服务器，通过 Nginx 反向代理挂到 HubForge 域名下。

### 第 4 步：在 HubForge 后台注册

管理员进入 HubForge 后台 → 应用管理 → 注册新应用，填写：
- 应用名称
- 应用 URL（如 `https://hubforge.com/app/your-app/`）
- 应用类型（PC/H5）

### 第 5 步：配置权限

管理员在 HubForge 后台 → 权限管理，给用户/部门分配应用权限。

### 完成

用户从 HubForge 首页点击你的应用，自动登录，直接使用。

---

## 应用内 API 速查

所有 API 都需要 `credentials: 'include'`，返回格式统一为 `{ success, data, message/error }`。

| API | 方法 | 说明 | 返回 |
|-----|------|------|------|
| `/api/auth/me` | GET | 当前用户信息 | 用户对象（含租户、部门、权限） |
| `/api/users` | GET | 本租户用户列表 | 用户数组 + 分页 |
| `/api/departments/tree` | GET | 部门树 | 树形结构 |
| `/api/permissions/check?key=xxx` | GET | 检查权限 | `{ hasPermission: boolean }` |
| `/api/apps` | GET | 本租户应用列表 | 应用数组 + 分页 |

---

## 常见问题

### Q: 应用需要自己做登录页面吗？
A: 不需要。用户在 HubForge 登录后，Cookie 自动共享到同域下的所有应用。

### Q: 应用需要自己维护用户表吗？
A: 不需要。直接调 `/api/auth/me` 和 `/api/users` 获取用户信息。

### Q: 应用能访问其他租户的数据吗？
A: 不能。API 自动按租户隔离，只能访问本租户数据。

### Q: iframe 里应用的弹窗/下拉菜单会被截断吗？
A: 同域部署时不会。iframe 没有跨域限制，弹窗、下拉、全屏都正常。

### Q: 应用可以在 iframe 里跳转页面吗？
A: 可以。应用内部的路由跳转在 iframe 内正常工作。

### Q: 如果应用需要调用自己的后端 API 呢？
A: 应用自己的后端部署在同域下（如 `/app/your-app/api/xxx`），或者在应用内通过 `/api/auth/me` 获取用户 token 后自行传递给后端。

### Q: 应用能用 Vue/React/纯 HTML 吗？
A: 都可以。HubForge 通过 iframe 加载，不限制应用的技术栈。

---

## 参考实现

### 纯 HTML 应用示例

```html
<!DOCTYPE html>
<html>
<head><title>我的应用</title></head>
<body>
  <div id="app">加载中...</div>
  <script>
    async function init() {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        document.getElementById('app').innerHTML = '请从华检科 HubForge 登录后访问';
        return;
      }
      const { data: user } = await res.json();
      document.getElementById('app').innerHTML =
        `<h1>你好，${user.name}</h1>` +
        `<p>部门：${user.department?.name || '未分配'}</p>` +
        `<p>租户：${user.tenant.name}</p>`;
    }
    init();
  </script>
</body>
</html>
```

### React 应用示例

```tsx
import { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(({ data }) => setUser(data));
  }, []);

  if (!user) return <div>加载中...</div>;

  return (
    <div>
      <h1>你好，{user.name}</h1>
      <p>部门：{user.department?.name || '未分配'}</p>
      <p>权限：{user.permissions.map(p => p.label).join('、')}</p>
    </div>
  );
}
```
