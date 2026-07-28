// ============================================================
// HubForge - 用户管理 API 测试
// 测试用户列表、详情、更新（租户隔离）
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { mockPrisma, createTestUser, createAuthToken } from '../setup';

// ============================================================
// GET /api/users — 用户列表（租户隔离）
// ============================================================
describe('GET /api/users — 用户列表', () => {
  it('管理员查看当前租户用户列表 → 返回分页数据', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    const userTenants = [
      {
        role: 'member',
        status: 'active',
        joinedAt: new Date(),
        user: { id: 'u1', email: 'a@test.com', name: '用户A', avatarUrl: null, createdAt: new Date() },
      },
      {
        role: 'admin',
        status: 'active',
        joinedAt: new Date(),
        user: { id: 'u2', email: 'b@test.com', name: '用户B', avatarUrl: null, createdAt: new Date() },
      },
    ];
    mockPrisma.userTenant.findMany.mockResolvedValue(userTenants);
    mockPrisma.userTenant.count.mockResolvedValue(2);

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

    mockPrisma.userTenant.findUnique.mockResolvedValue({
      id: 'ut-001',
      role: 'member',
      status: 'active',
      joinedAt: new Date(),
      user: {
        id: 'user-001',
        email: 'test@example.com',
        name: '测试用户',
        avatarUrl: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    mockPrisma.userPermission.findMany.mockResolvedValue([
      { permission: { key: 'app.inspection.view', label: '查看巡检', type: 'app' } },
    ]);
    mockPrisma.userOrganization.findMany.mockResolvedValue([
      { department: { id: 'dept-001', name: '生产部' }, isPrimary: true },
    ]);

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
    // 权限应被映射
    expect(data.data.permissions).toHaveLength(1);
    expect(data.data.permissions[0].key).toBe('app.inspection.view');
  });

  it('查看不存在的用户 → 返回 404', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPrisma.userTenant.findUnique.mockResolvedValue(null);

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

    mockPrisma.userTenant.findUnique.mockResolvedValue({ id: 'ut-001' });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-001',
      email: 'test@example.com',
      name: '新名字',
      avatarUrl: null,
    });
    mockPrisma.userTenant.findUnique.mockResolvedValueOnce({ id: 'ut-001' }).mockResolvedValueOnce({
      role: 'member',
      status: 'active',
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

    mockPrisma.userTenant.findUnique.mockResolvedValue(null);

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

    mockPrisma.userTenant.findUnique.mockResolvedValue({ id: 'ut-delete' });
    mockPrisma.userTenant.delete.mockResolvedValue({});
    mockPrisma.userPermission.deleteMany.mockResolvedValue({ count: 0 });

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
