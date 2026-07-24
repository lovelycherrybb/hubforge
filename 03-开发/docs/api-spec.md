# HubForge API 接口规范

## 概述

- **基础路径**: `/api`
- **认证方式**: JWT httpOnly Cookie（Cookie 名称: `hubforge-token`）
- **响应格式**: 统一 JSON 结构
- **多租户**: 通过 JWT 中的 tenantId 自动隔离

### 统一响应格式

```json
// 成功
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 分页
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}

// 错误
{
  "success": false,
  "error": "错误信息"
}
```

---

## 1. 认证 (Auth)

### POST /api/auth/register

用户注册（同时创建租户 + 管理员用户）

**请求体**:
```json
{
  "tenantName": "示例公司",        // 租户名称，2-100 字符
  "tenantSlug": "example-corp",   // 租户标识，小写字母数字连字符
  "email": "admin@example.com",   // 邮箱
  "password": "securePass123",    // 密码，至少 8 位
  "name": "张三"                  // 姓名
}
```

**响应** (200):
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "name": "..." },
    "tenant": { "id": "...", "name": "...", "slug": "..." }
  },
  "message": "注册成功"
}
```

**权限**: 公开（无需认证）

---

### POST /api/auth/login

用户登录，返回 httpOnly Cookie

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "securePass123",
  "tenantSlug": "example-corp"    // 可选，多租户场景指定租户
}
```

**响应** (200):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "...",
      "name": "...",
      "isGlobalAdmin": false
    },
    "tenant": {
      "id": "...",
      "name": "...",
      "slug": "..."
    }
  },
  "message": "登录成功"
}
```

**Cookie**: `hubforge-token` (httpOnly, 7 天过期)

**权限**: 公开

---

### POST /api/auth/logout

登出，清除 Cookie

**请求体**: 无

**响应** (200):
```json
{
  "success": true,
  "data": null,
  "message": "已登出"
}
```

**权限**: 公开

---

### POST /api/auth/forgot-password

忘记密码，发送重置邮件

**请求体**:
```json
{
  "email": "user@example.com"
}
```

**响应** (200):
```json
{
  "success": true,
  "data": null,
  "message": "如果该邮箱已注册，重置链接已发送"
}
```

**权限**: 公开

---

### POST /api/auth/reset-password

重置密码

**请求体**:
```json
{
  "token": "reset-token-from-email",
  "password": "newSecurePass123"
}
```

**响应** (200):
```json
{
  "success": true,
  "data": null,
  "message": "密码已重置，请重新登录"
}
```

**权限**: 公开（需有效重置令牌）

---

### GET /api/auth/me

获取当前登录用户信息

**请求参数**: 无

**响应** (200):
```json
{
  "success": true,
  "data": {
    "id": "...",
    "email": "user@example.com",
    "name": "张三",
    "status": "active",
    "isGlobalAdmin": false,
    "tenant": { "id": "...", "name": "...", "slug": "..." },
    "department": { "id": "...", "name": "技术部" },
    "permissions": [
      { "key": "user:read", "label": "查看用户", "type": "framework" }
    ]
  }
}
```

**权限**: 已认证用户

---

## 2. 租户管理 (Tenants)

> 所有租户管理接口需要全局管理员权限

### GET /api/tenants

租户列表（分页）

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| pageSize | number | 20 | 每页数量 |

**响应** (200): 分页租户列表

**权限**: 全局管理员

---

### POST /api/tenants

创建租户

**请求体**:
```json
{
  "name": "新租户",
  "slug": "new-tenant",
  "quotaUsers": 100,
  "quotaApps": 50,
  "quotaOrgLevels": 5
}
```

**响应** (201): 创建的租户对象

**权限**: 全局管理员

---

### GET /api/tenants/:id

租户详情

**响应** (200): 租户详情（含配置和统计）

**权限**: 全局管理员

---

### PUT /api/tenants/:id

更新租户

**请求体**:
```json
{
  "name": "更新后的名称",
  "quotaUsers": 200
}
```

**响应** (200): 更新后的租户对象

**权限**: 全局管理员

---

### DELETE /api/tenants/:id

删除租户（级联删除所有关联数据）

**响应**: 204 No Content

**权限**: 全局管理员

---

### PUT /api/tenants/:id/status

停用/启用租户

**请求体**:
```json
{
  "status": "suspended"   // active | suspended
}
```

**响应** (200): 更新后的租户对象

**权限**: 全局管理员

---

## 3. 用户管理 (Users)

> 用户管理接口需要租户管理员权限，数据自动按租户隔离

### GET /api/users

用户列表（分页、搜索）

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| pageSize | number | 20 | 每页数量 |
| search | string | - | 搜索关键词（姓名/邮箱） |
| departmentId | string | - | 按部门筛选 |
| status | string | - | 按状态筛选 |

**响应** (200): 分页用户列表（不含密码）

**权限**: 租户管理员

---

### POST /api/users

创建用户

**请求体**:
```json
{
  "email": "newuser@example.com",
  "password": "initialPass123",
  "name": "李四",
  "departmentId": "dept-id",
  "isGlobalAdmin": false
}
```

**响应** (201): 创建的用户对象

**权限**: 租户管理员

---

### GET /api/users/:id

用户详情（含权限列表）

**响应** (200): 用户详情

**权限**: 租户管理员

---

### PUT /api/users/:id

更新用户

**请求体**:
```json
{
  "name": "更新后的姓名",
  "status": "locked",
  "departmentId": "new-dept-id"
}
```

**响应** (200): 更新后的用户对象

**权限**: 租户管理员

---

### DELETE /api/users/:id

删除用户（不能删除自己）

**响应**: 204 No Content

**权限**: 租户管理员

---

## 4. 组织架构 (Departments)

### GET /api/departments/tree

获取部门树形结构

**响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "总公司",
      "parentId": null,
      "sortOrder": 0,
      "userCount": 10,
      "children": [
        {
          "id": "...",
          "name": "技术部",
          "parentId": "...",
          "sortOrder": 1,
          "userCount": 5,
          "children": []
        }
      ]
    }
  ]
}
```

**权限**: 已认证用户

---

### POST /api/departments

创建部门

**请求体**:
```json
{
  "name": "新产品部",
  "parentId": "parent-dept-id",   // null 表示根级别
  "sortOrder": 10
}
```

**响应** (201): 创建的部门对象

**权限**: 租户管理员

---

### PUT /api/departments/:id

更新部门

**请求体**:
```json
{
  "name": "更新后的名称",
  "sortOrder": 20
}
```

**响应** (200): 更新后的部门对象

**权限**: 租户管理员

---

### DELETE /api/departments/:id

删除部门（需先清空子部门和用户）

**响应**: 204 No Content

**权限**: 租户管理员

---

### PUT /api/departments/:id/move

移动部门（变更父级）

**请求体**:
```json
{
  "parentId": "new-parent-id"   // null 表示移到根级别
}
```

**响应** (200): 更新后的部门对象

**权限**: 租户管理员

---

### POST /api/departments/:id/users

批量分配用户到部门

**请求体**:
```json
{
  "userIds": ["user-1", "user-2"]
}
```

**响应** (200):
```json
{
  "success": true,
  "message": "已将 2 个用户分配到 技术部"
}
```

**权限**: 租户管理员

---

## 5. 权限管理 (Permissions)

### GET /api/permissions

获取权限列表（框架权限 + 当前租户的应用权限）

**响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "key": "user:read",
      "label": "查看用户",
      "type": "framework",
      "tenantId": null,
      "appId": null,
      "app": null
    },
    {
      "id": "...",
      "key": "order:approve",
      "label": "审批订单",
      "type": "app",
      "tenantId": "...",
      "appId": "...",
      "app": { "id": "...", "name": "订单系统" }
    }
  ]
}
```

**权限**: 已认证用户

---

### POST /api/permissions/assign

分配或撤销权限

**请求体**:
```json
{
  "permissionId": "perm-id",
  "userId": "user-id",           // 与 departmentId 二选一
  "departmentId": "dept-id",     // 与 userId 二选一
  "action": "grant"              // grant | revoke
}
```

**响应** (200):
```json
{
  "success": true,
  "message": "权限已授予用户"
}
```

**权限**: 租户管理员

---

### GET /api/permissions/check

检查当前用户是否拥有指定权限

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| key | string | 权限标识 |

**响应** (200):
```json
{
  "success": true,
  "data": {
    "hasPermission": true,
    "key": "user:read",
    "source": "user"    // user | department（权限来源）
  }
}
```

**权限**: 已认证用户

---

## 6. 应用管理 (Apps)

### GET /api/apps

应用列表（分页）

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| pageSize | number | 20 | 每页数量 |
| search | string | - | 搜索关键词 |
| type | string | - | 应用类型 (pc/h5/both) |
| status | string | - | 状态 (active/inactive) |

**响应** (200): 分页应用列表

**权限**: 已认证用户（普通用户可查看列表）

---

### POST /api/apps

注册应用

**请求体**:
```json
{
  "name": "订单管理系统",
  "slug": "order-system",
  "type": "pc",
  "description": "企业订单管理",
  "icon": "https://example.com/icon.png",
  "url": "https://order.example.com",
  "sortOrder": 1
}
```

**响应** (201): 创建的应用对象

**权限**: 租户管理员

---

### GET /api/apps/:id

应用详情（含配置）

**响应** (200): 应用详情

**权限**: 已认证用户

---

### PUT /api/apps/:id

更新应用

**请求体**:
```json
{
  "name": "更新后的名称",
  "status": "inactive",
  "url": "https://new-url.example.com"
}
```

**响应** (200): 更新后的应用对象

**权限**: 租户管理员

---

### DELETE /api/apps/:id

删除应用

**响应**: 204 No Content

**权限**: 租户管理员

---

## 错误码

| HTTP 状态码 | 说明 |
|------------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 成功（无返回内容） |
| 400 | 请求参数错误 |
| 401 | 未认证（未登录或 Token 过期） |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
