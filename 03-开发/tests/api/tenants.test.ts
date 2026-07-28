// ============================================================
// HubForge - M2 租户模块 API 测试
// 测试租户 CRUD、权限控制、配额限制
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { mockPrisma, createTestUser, createTestTenant, createAuthToken } from '../setup';

// ============================================================
// 租户列表 GET /api/tenants
// ============================================================
describe('GET /api/tenants — 租户列表', () => {
  it('主租户管理员查看租户列表 → 返回全部租户', async () => {
    // 主租户管理员 token
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    const tenants = [
      createTestTenant({ id: 't1', name: '租户A', slug: 'tenant-a' }),
      createTestTenant({ id: 't2', name: '租户B', slug: 'tenant-b' }),
    ];

    mockPrisma.tenant.findMany.mockResolvedValue(tenants);
    mockPrisma.tenant.count.mockResolvedValue(2);

    const { GET } = await import('@/app/api/tenants/route');

    const request = new Request('http://localhost:3000/api/tenants?page=1&pageSize=20', {
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

  it('非全局管理员查看租户列表 → 返回 403', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    const { GET } = await import('@/app/api/tenants/route');

    const request = new Request('http://localhost:3000/api/tenants', {
      method: 'GET',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it('未登录查看租户列表 → 返回 401', async () => {
    const { GET } = await import('@/app/api/tenants/route');

    const request = new Request('http://localhost:3000/api/tenants', {
      method: 'GET',
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// 创建租户 POST /api/tenants
// ============================================================
describe('POST /api/tenants — 创建租户', () => {
  it('主租户管理员创建新租户 → 成功（TC-019）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    // slug 和邮箱均不存在
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const mockTenant = createTestTenant({ id: 'new-tenant', name: '测试租户A', slug: 'tenant-a' });
    const mockAdmin = createTestUser({
      id: 'new-admin',
      email: 'admin-a@example.com',
      tenantId: 'new-tenant',
      isGlobalAdmin: false,
      status: 'invited',
    });

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        ...mockPrisma,
        tenant: { ...mockPrisma.tenant, create: vi.fn().mockResolvedValue(mockTenant) },
        user: { ...mockPrisma.user, findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(mockAdmin) },
        userTenant: { ...mockPrisma.userTenant, create: vi.fn().mockResolvedValue({ id: 'ut-new', status: 'invited', role: 'owner' }) },
      };
      return fn(tx);
    });

    // Mock individual db calls made outside transaction
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/tenants/route');

    const request = new Request('http://localhost:3000/api/tenants', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '测试租户A',
        slug: 'tenant-a',
        adminEmail: 'admin-a@example.com',
        adminName: '管理员A',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.message).toContain('租户创建成功');
  });

  it('非主租户管理员创建租户 → 返回 403', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    const { POST } = await import('@/app/api/tenants/route');

    const request = new Request('http://localhost:3000/api/tenants', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '测试租户',
        slug: 'test-slug',
        adminEmail: 'admin@test.com',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// 软删除租户 DELETE /api/tenants/:id
// ============================================================
describe('DELETE /api/tenants/:id — 软删除租户', () => {
  it('硬删除租户 → 成功（TC-022 相关）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    const existingTenant = createTestTenant({ id: 'tenant-to-delete' });
    mockPrisma.tenant.findUnique.mockResolvedValue(existingTenant);
    mockPrisma.tenant.delete.mockResolvedValue(existingTenant);

    const { DELETE } = await import('@/app/api/tenants/[id]/route');

    const request = new Request('http://localhost:3000/api/tenants/tenant-to-delete', {
      method: 'DELETE',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await DELETE(request, { params: { id: 'tenant-to-delete' } });

    expect(response.status).toBe(204);

    // 验证调用了 delete 进行硬删除
    expect(mockPrisma.tenant.delete).toHaveBeenCalledWith({
      where: { id: 'tenant-to-delete' },
    });
  });

  it('非全局管理员删除租户 → 返回 403', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    const { DELETE } = await import('@/app/api/tenants/[id]/route');

    const request = new Request('http://localhost:3000/api/tenants/some-id', {
      method: 'DELETE',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await DELETE(request, { params: { id: 'some-id' } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it('删除不存在的租户 → 返回 404', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/tenants/[id]/route');

    const request = new Request('http://localhost:3000/api/tenants/nonexistent', {
      method: 'DELETE',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await DELETE(request, { params: { id: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// 用户配额测试
// ============================================================
describe('用户配额限制（TC-027）', () => {
  it('用户数达到上限 → 阻止创建新用户', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    // 用户已存在检查通过（不重复）
    mockPrisma.user.findUnique.mockResolvedValue(null);

    // 租户配额为 5
    const tenant = createTestTenant({ id: 'tenant-001', maxUsers: 5 });
    mockPrisma.tenant.findUnique.mockResolvedValue(tenant);

    // 当前已有 5 个用户
    mockPrisma.userTenant.count.mockResolvedValue(5);

    const { POST } = await import('@/app/api/users/route');

    const request = new Request('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'newuser@test.com',
        password: 'Abcd@1234',
        name: '新用户',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain('上限');
  });

  it('用户数未达上限 → 允许创建新用户', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const tenant = createTestTenant({ id: 'tenant-001', maxUsers: 100 });
    mockPrisma.tenant.findUnique.mockResolvedValue(tenant);

    // 当前只有 3 个用户
    mockPrisma.userTenant.count.mockResolvedValue(3);

    const newUser = createTestUser({
      id: 'new-user',
      email: 'newuser@test.com',
      name: '新用户',
    });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        ...mockPrisma,
        user: { ...mockPrisma.user, findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(newUser) },
        userTenant: { ...mockPrisma.userTenant, create: vi.fn().mockResolvedValue({ id: 'ut-new', role: 'member', status: 'active' }) },
      };
      return fn(tx);
    });

    const { POST } = await import('@/app/api/users/route');

    const request = new Request('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'newuser@test.com',
        password: 'Abcd@1234',
        name: '新用户',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
  });
});
