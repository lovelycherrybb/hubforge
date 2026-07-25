// ============================================================
// HubForge - M2 权限模块 API 测试
// 测试权限分配、权限检查逻辑
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { mockPrisma, createTestUser, createTestTenant, createAuthToken } from '../setup';

// ============================================================
// 权限分配 POST /api/permissions/assign
// ============================================================
describe('POST /api/permissions/assign — 权限分配', () => {
  it('主租户管理员分配框架权限 → 成功（TC-043）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', true);

    // 权限存在，类型为 framework
    mockPrisma.permission.findFirst.mockResolvedValue({
      id: 'perm-framework-001',
      key: 'app.inspection.access',
      label: '巡检系统访问',
      type: 'framework',
      tenantId: null,
    });

    mockPrisma.userPermission.upsert.mockResolvedValue({});

    const { POST } = await import('@/app/api/permissions/assign/route');

    const request = new Request('http://localhost:3000/api/permissions/assign', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permissionId: 'perm-framework-001',
        userId: 'user-002',
        action: 'grant',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('权限已授予');
  });

  it('非全局管理员分配框架权限 → 返回 403（TC-045）', async () => {
    // 非全局管理员
    const token = await createAuthToken('user-001', 'tenant-001', false);

    const { POST } = await import('@/app/api/permissions/assign/route');

    const request = new Request('http://localhost:3000/api/permissions/assign', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permissionId: 'perm-framework-001',
        userId: 'user-002',
        action: 'grant',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    // 非全局管理员直接被拦截（代码第 28 行检查 isGlobalAdmin）
    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it('主租户管理员分配应用权限 → 成功（TC-044）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', true);

    // 权限存在，类型为 app
    mockPrisma.permission.findFirst.mockResolvedValue({
      id: 'perm-app-001',
      key: 'inspection.submit',
      label: '提交巡检',
      type: 'app',
      tenantId: 'tenant-001',
      appId: 'app-001',
    });

    mockPrisma.userPermission.upsert.mockResolvedValue({});

    const { POST } = await import('@/app/api/permissions/assign/route');

    const request = new Request('http://localhost:3000/api/permissions/assign', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permissionId: 'perm-app-001',
        userId: 'user-002',
        action: 'grant',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('撤销用户权限 → 成功', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', true);

    mockPrisma.permission.findFirst.mockResolvedValue({
      id: 'perm-001',
      key: 'app.inspection.view',
      type: 'app',
      tenantId: 'tenant-001',
    });

    mockPrisma.userPermission.deleteMany.mockResolvedValue({ count: 1 });

    const { POST } = await import('@/app/api/permissions/assign/route');

    const request = new Request('http://localhost:3000/api/permissions/assign', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permissionId: 'perm-001',
        userId: 'user-002',
        action: 'revoke',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('撤销');
  });
});

// ============================================================
// 权限检查 GET /api/permissions/check
// ============================================================
describe('GET /api/permissions/check — 权限检查', () => {
  it('用户有个人权限 → 检查通过（source: user）', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', false);

    // 全局管理员为 false，所以不走 admin 快速路径
    mockPrisma.permission.findFirst.mockResolvedValue({
      id: 'perm-001',
      key: 'app.inspection.view',
      type: 'app',
      tenantId: 'tenant-001',
    });

    // 用户有直接权限
    mockPrisma.userPermission.findFirst.mockResolvedValue({
      id: 'up-001',
      userId: 'user-001',
      permissionId: 'perm-001',
    });

    const { GET } = await import('@/app/api/permissions/check/route');

    const request = new Request(
      'http://localhost:3000/api/permissions/check?key=app.inspection.view',
      {
        method: 'GET',
        headers: { Cookie: `hubforge-token=${token}` },
      }
    ) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.hasPermission).toBe(true);
    expect(data.data.source).toBe('user');
  });

  it('用户通过组织继承权限 → 检查通过（source: department）', async () => {
    const token = await createAuthToken('user-002', 'tenant-001', false);

    mockPrisma.permission.findFirst.mockResolvedValue({
      id: 'perm-001',
      key: 'app.inspection.view',
      type: 'app',
      tenantId: 'tenant-001',
    });

    // 用户没有个人权限
    mockPrisma.userPermission.findFirst.mockResolvedValue(null);

    // 用户属于部门 dept-001
    mockPrisma.user.findUnique.mockResolvedValue({
      departmentId: 'dept-001',
    });

    // 部门有该权限
    mockPrisma.departmentPermission.findFirst.mockResolvedValue({
      id: 'dp-001',
      departmentId: 'dept-001',
      permissionId: 'perm-001',
    });

    const { GET } = await import('@/app/api/permissions/check/route');

    const request = new Request(
      'http://localhost:3000/api/permissions/check?key=app.inspection.view',
      {
        method: 'GET',
        headers: { Cookie: `hubforge-token=${token}` },
      }
    ) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.hasPermission).toBe(true);
    expect(data.data.source).toBe('department');
  });

  it('用户无权限 → 检查不通过（TC-047）', async () => {
    const token = await createAuthToken('user-003', 'tenant-001', false);

    mockPrisma.permission.findFirst.mockResolvedValue({
      id: 'perm-001',
      key: 'app.inspection.view',
      type: 'app',
      tenantId: 'tenant-001',
    });

    // 无个人权限
    mockPrisma.userPermission.findFirst.mockResolvedValue(null);

    // 用户无部门
    mockPrisma.user.findUnique.mockResolvedValue({
      departmentId: null,
    });

    const { GET } = await import('@/app/api/permissions/check/route');

    const request = new Request(
      'http://localhost:3000/api/permissions/check?key=app.inspection.view',
      {
        method: 'GET',
        headers: { Cookie: `hubforge-token=${token}` },
      }
    ) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.hasPermission).toBe(false);
  });

  it('全局管理员检查任意权限 → 直接通过（source: admin）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', true);

    const { GET } = await import('@/app/api/permissions/check/route');

    const request = new Request(
      'http://localhost:3000/api/permissions/check?key=any.permission',
      {
        method: 'GET',
        headers: { Cookie: `hubforge-token=${token}` },
      }
    ) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.hasPermission).toBe(true);
    expect(data.data.source).toBe('admin');
  });
});

// ============================================================
// 权限列表 GET /api/permissions
// ============================================================
describe('GET /api/permissions — 权限列表', () => {
  it('已登录用户获取权限列表 → 返回框架权限和应用权限', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', false);

    const permissions = [
      { id: 'p1', key: 'framework.perm1', label: '框架权限1', type: 'framework', tenantId: null, app: null },
      { id: 'p2', key: 'app.perm1', label: '应用权限1', type: 'app', tenantId: 'tenant-001', app: { id: 'app-001', name: '应用1' } },
    ];

    mockPrisma.permission.findMany.mockResolvedValue(permissions);

    const { GET } = await import('@/app/api/permissions/route');

    const request = new Request('http://localhost:3000/api/permissions', {
      method: 'GET',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.framework).toHaveLength(1);
    expect(data.data.app).toHaveLength(1);
  });

  it('未登录获取权限列表 → 返回 401', async () => {
    const { GET } = await import('@/app/api/permissions/route');

    const request = new Request('http://localhost:3000/api/permissions', {
      method: 'GET',
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});
