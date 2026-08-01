// ============================================================
// HubForge - 用户管理 API 测试
// 测试用户列表、详情、更新（租户隔离）
// ============================================================

import { describe, it, expect } from 'vitest';
import { mockPgClient, createAuthToken } from '../setup';

/** 创建 pg 查询结果 */
const R = (rows: any[], command = 'SELECT') => ({
  rows, rowCount: rows.length, command, oid: 0, fields: [],
});

// ============================================================
// GET /api/users — 用户列表（租户隔离）
// ============================================================
describe('GET /api/users — 用户列表', () => {
  it('管理员查看当前租户用户列表 → 返回分页数据', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    const users = [
      { id: 'u1', email: 'a@test.com', name: '用户A', avatarUrl: null, createdAt: new Date(), role: 'member', status: 'active', joinedAt: new Date() },
      { id: 'u2', email: 'b@test.com', name: '用户B', avatarUrl: null, createdAt: new Date(), role: 'admin', status: 'active', joinedAt: new Date() },
    ];

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('COUNT(*)') && s.includes('USER_TENANTS')) return R([{ count: '2' }]);
      if (s.includes('FROM USER_TENANTS') && s.includes('INNER JOIN')) return R(users);
      return R([]);
    });

    const { GET } = await import('@/app/api/users/route');

    const request = new Request('http://localhost:3000/api/users?page=1&pageSize=20', {
      method: 'GET',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
  });

  it('非管理员查看用户列表 → 返回 403', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    const { GET } = await import('@/app/api/users/route');

    const request = new Request('http://localhost:3000/api/users', {
      method: 'GET',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it('未登录查看用户列表 → 返回 401', async () => {
    const { GET } = await import('@/app/api/users/route');

    const request = new Request('http://localhost:3000/api/users', {
      method: 'GET',
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// GET /api/users/:id — 用户详情
// ============================================================
describe('GET /api/users/:id — 用户详情', () => {
  it('管理员查看用户详情 → 返回脱敏数据（含权限）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找 userTenant + user 信息（JOIN 查询）
      if (s.includes('FROM USER_TENANTS') && s.includes('INNER JOIN') && s.includes('LIMIT'))
        return R([{
          id: 'ut-001', role: 'member', status: 'active', joinedAt: new Date(),
          uId: 'user-001', uEmail: 'test@example.com', uName: '测试用户',
          uAvatarUrl: null, uEmailVerified: null, uCreatedAt: new Date(), uUpdatedAt: new Date(),
        }]);
      // 用户权限（JOIN permissions）
      if (s.includes('FROM USER_PERMISSIONS') && s.includes('INNER JOIN'))
        return R([{ permissionId: 'perm-001', key: 'app.inspection.view', label: '查看巡检', type: 'app' }]);
      // 用户部门（JOIN departments）
      if (s.includes('FROM USER_ORGANIZATIONS') && s.includes('INNER JOIN'))
        return R([{ id: 'dept-001', name: '生产部', isPrimary: true }]);
      return R([]);
    });

    const { GET } = await import('@/app/api/users/[id]/route');

    const request = new Request('http://localhost:3000/api/users/user-001', {
      method: 'GET',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await GET(request, { params: { id: 'user-001' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.email).toBe('test@example.com');
    expect(data.data.permissions).toHaveLength(1);
    expect(data.data.permissions[0].key).toBe('app.inspection.view');
  });

  it('查看不存在的用户 → 返回 404', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM USER_TENANTS') && s.includes('INNER JOIN') && s.includes('LIMIT'))
        return R([]);
      return R([]);
    });

    const { GET } = await import('@/app/api/users/[id]/route');

    const request = new Request('http://localhost:3000/api/users/nonexistent', {
      method: 'GET',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await GET(request, { params: { id: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// PUT /api/users/:id — 更新用户
// ============================================================
describe('PUT /api/users/:id — 更新用户', () => {
  it('管理员更新用户名 → 成功', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找 userTenant（SELECT * FROM user_tenants WHERE）
      if (s.includes('FROM USER_TENANTS') && s.includes('WHERE') && s.includes('"USERID"') && s.includes('LIMIT') && !s.includes('ROLE'))
        return R([{ id: 'ut-001' }]);
      // UPDATE user_tenants
      if (s.startsWith('UPDATE') && s.includes('USER_TENANTS'))
        return R([], 'UPDATE');
      // UPDATE users
      if (s.startsWith('UPDATE') && s.includes('USERS'))
        return R([], 'UPDATE');
      // 查找更新后的用户（SELECT id, email, name, "avatarUrl" FROM users）
      if (s.includes('FROM USERS') && s.includes('"AVATARURL"') && s.includes('LIMIT'))
        return R([{ id: 'user-001', email: 'test@example.com', name: '新名字', avatarUrl: null }]);
      // 查找更新后的 userTenant（SELECT role, status FROM user_tenants）
      if (s.includes('FROM USER_TENANTS') && s.includes('ROLE') && s.includes('LIMIT'))
        return R([{ role: 'member', status: 'active' }]);
      return R([]);
    });

    const { PUT } = await import('@/app/api/users/[id]/route');

    const request = new Request('http://localhost:3000/api/users/user-001', {
      method: 'PUT',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: '新名字' }),
    }) as any;

    const response = await PUT(request, { params: { id: 'user-001' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('新名字');
  });

  it('更新不存在的用户 → 返回 404', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM USER_TENANTS') && s.includes('WHERE') && s.includes('LIMIT'))
        return R([]);
      return R([]);
    });

    const { PUT } = await import('@/app/api/users/[id]/route');

    const request = new Request('http://localhost:3000/api/users/nonexistent', {
      method: 'PUT',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: '新名字' }),
    }) as any;

    const response = await PUT(request, { params: { id: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// DELETE /api/users/:id — 删除用户
// ============================================================
describe('DELETE /api/users/:id — 删除用户', () => {
  it('管理员删除用户 → 成功', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找 userTenant
      if (s.includes('FROM USER_TENANTS') && s.includes('WHERE') && s.includes('LIMIT'))
        return R([{ id: 'ut-delete' }]);
      // DELETE user_tenants
      if (s.startsWith('DELETE') && s.includes('USER_TENANTS'))
        return { rows: [], rowCount: 1, command: 'DELETE', oid: 0, fields: [] };
      // DELETE user_permissions
      if (s.startsWith('DELETE') && s.includes('USER_PERMISSIONS'))
        return { rows: [], rowCount: 0, command: 'DELETE', oid: 0, fields: [] };
      return R([]);
    });

    const { DELETE } = await import('@/app/api/users/[id]/route');

    const request = new Request('http://localhost:3000/api/users/user-to-delete', {
      method: 'DELETE',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await DELETE(request, { params: { id: 'user-to-delete' } });

    expect(response.status).toBe(204);
  });

  it('管理员不能删除自己 → 返回错误', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    const { DELETE } = await import('@/app/api/users/[id]/route');

    const request = new Request('http://localhost:3000/api/users/admin-001', {
      method: 'DELETE',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await DELETE(request, { params: { id: 'admin-001' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('当前登录用户');
  });
});
