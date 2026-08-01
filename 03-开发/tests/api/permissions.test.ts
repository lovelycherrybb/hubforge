// ============================================================
// HubForge - M2 权限模块 API 测试
// 测试权限分配、权限检查逻辑
// ============================================================

import { describe, it, expect } from 'vitest';
import { mockPgClient, createAuthToken } from '../setup';

/** 创建 pg 查询结果 */
const R = (rows: any[], command = 'SELECT') => ({
  rows, rowCount: rows.length, command, oid: 0, fields: [],
});

// ============================================================
// 权限分配 POST /api/permissions/assign
// ============================================================
describe('POST /api/permissions/assign — 权限分配', () => {
  it('主租户管理员分配框架权限 → 成功（TC-043）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找权限
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-framework-001', key: 'app.inspection.access', label: '巡检系统访问', type: 'framework', tenantId: null }]);
      // INSERT user_permissions (ON CONFLICT DO NOTHING)
      if (s.includes('INTO USER_PERMISSIONS'))
        return R([], 'INSERT');
      return R([]);
    });

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
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找权限（框架权限，非 owner 也会查到，但角色检查先拦截）
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-framework-001', key: 'app.inspection.access', type: 'framework', tenantId: null }]);
      return R([]);
    });

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

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it('主租户管理员分配应用权限 → 成功（TC-044）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-app-001', key: 'inspection.submit', label: '提交巡检', type: 'app', tenantId: 'tenant-001', appId: 'app-001' }]);
      if (s.includes('INTO USER_PERMISSIONS'))
        return R([], 'INSERT');
      return R([]);
    });

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
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-001', key: 'app.inspection.view', type: 'app', tenantId: 'tenant-001' }]);
      if (s.startsWith('DELETE') && s.includes('USER_PERMISSIONS'))
        return { rows: [], rowCount: 1, command: 'DELETE', oid: 0, fields: [] };
      return R([]);
    });

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
// 框架权限授予租户 POST /api/permissions/assign (tenantId)
// ============================================================
describe('POST /api/permissions/assign — 框架权限授予租户', () => {
  it('平台 owner 将框架权限授予租户 → 成功', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    let insertTenantPermCalled = false;

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-framework-001', key: 'app.inspection.access', label: '巡检系统访问', type: 'framework', tenantId: null }]);
      if (s.includes('INTO TENANT_PERMISSIONS')) {
        insertTenantPermCalled = true;
        return R([], 'INSERT');
      }
      return R([]);
    });

    const { POST } = await import('@/app/api/permissions/assign/route');

    const request = new Request('http://localhost:3000/api/permissions/assign', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permissionId: 'perm-framework-001',
        tenantId: 'tenant-002',
        action: 'grant',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('框架权限已授予租户');
    expect(insertTenantPermCalled).toBe(true);
  });

  it('平台 owner 撤销租户框架权限 → 成功', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    let deleteTenantPermCalled = false;

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-framework-001', key: 'app.inspection.access', type: 'framework', tenantId: null }]);
      if (s.startsWith('DELETE') && s.includes('TENANT_PERMISSIONS')) {
        deleteTenantPermCalled = true;
        return { rows: [], rowCount: 1, command: 'DELETE', oid: 0, fields: [] };
      }
      return R([]);
    });

    const { POST } = await import('@/app/api/permissions/assign/route');

    const request = new Request('http://localhost:3000/api/permissions/assign', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permissionId: 'perm-framework-001',
        tenantId: 'tenant-002',
        action: 'revoke',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('撤销租户框架权限');
    expect(deleteTenantPermCalled).toBe(true);
  });

  it('非 owner 尝试授予框架权限给租户 → 返回 403', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'admin');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-framework-001', key: 'app.inspection.access', type: 'framework', tenantId: null }]);
      return R([]);
    });

    const { POST } = await import('@/app/api/permissions/assign/route');

    const request = new Request('http://localhost:3000/api/permissions/assign', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permissionId: 'perm-framework-001',
        tenantId: 'tenant-002',
        action: 'grant',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// 权限检查 GET /api/permissions/check
// ============================================================
describe('GET /api/permissions/check — 权限检查', () => {
  it('用户有个人权限 → 检查通过（source: user）', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找权限定义
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-001', key: 'app.inspection.view', type: 'app', tenantId: 'tenant-001' }]);
      // 检查用户直接权限
      if (s.includes('FROM USER_PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'up-001', userId: 'user-001', permissionId: 'perm-001' }]);
      return R([]);
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
    const token = await createAuthToken('user-002', 'tenant-001', 'member');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找权限定义
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-001', key: 'app.inspection.view', type: 'app', tenantId: 'tenant-001' }]);
      // 用户无个人权限
      if (s.includes('FROM USER_PERMISSIONS') && s.includes('LIMIT'))
        return R([]);
      // 用户属于组织
      if (s.includes('FROM USER_ORGANIZATIONS'))
        return R([{ organizationId: 'dept-001' }]);
      // 部门 parentId 查询（权限检查中的祖先遍历）
      if (s.includes('FROM DEPARTMENTS') && s.includes('"PARENTID"'))
        return R([{ parentId: null }]);
      // 部门有该权限
      if (s.includes('FROM DEPARTMENT_PERMISSIONS'))
        return R([{ id: 'dp-001', departmentId: 'dept-001', permissionId: 'perm-001' }]);
      return R([]);
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
    const token = await createAuthToken('user-003', 'tenant-001', 'member');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-001', key: 'app.inspection.view', type: 'app', tenantId: 'tenant-001' }]);
      if (s.includes('FROM USER_PERMISSIONS') && s.includes('LIMIT'))
        return R([]);
      if (s.includes('FROM USER_ORGANIZATIONS'))
        return R([]);
      return R([]);
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
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

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

  it('框架权限：租户未被授予 → 检查不通过', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 框架权限存在
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-framework-001', key: 'app.inspection.access', type: 'framework', tenantId: null }]);
      // 租户未被授予
      if (s.includes('FROM TENANT_PERMISSIONS'))
        return R([]);
      return R([]);
    });

    const { GET } = await import('@/app/api/permissions/check/route');

    const request = new Request(
      'http://localhost:3000/api/permissions/check?key=app.inspection.access',
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

  it('框架权限：租户已授予 + 用户有权限 → 检查通过', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 框架权限存在
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-framework-001', key: 'app.inspection.access', type: 'framework', tenantId: null }]);
      // 租户已被授予
      if (s.includes('FROM TENANT_PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'tp-001', tenantId: 'tenant-001', permissionId: 'perm-framework-001' }]);
      // 用户有直接权限
      if (s.includes('FROM USER_PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'up-001', userId: 'user-001', permissionId: 'perm-framework-001' }]);
      return R([]);
    });

    const { GET } = await import('@/app/api/permissions/check/route');

    const request = new Request(
      'http://localhost:3000/api/permissions/check?key=app.inspection.access',
      {
        method: 'GET',
        headers: { Cookie: `hubforge-token=${token}` },
      }
    ) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.hasPermission).toBe(true);
    expect(data.data.source).toBe('user');
  });

  it('框架权限：租户已授予但用户无个人/部门权限 → 检查不通过', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 框架权限存在
      if (s.includes('FROM PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'perm-framework-001', key: 'app.inspection.featureA', type: 'framework', tenantId: null }]);
      // 租户已被授予
      if (s.includes('FROM TENANT_PERMISSIONS') && s.includes('LIMIT'))
        return R([{ id: 'tp-001', tenantId: 'tenant-001', permissionId: 'perm-framework-001' }]);
      // 用户无个人权限
      if (s.includes('FROM USER_PERMISSIONS') && s.includes('LIMIT'))
        return R([]);
      // 用户无部门
      if (s.includes('FROM USER_ORGANIZATIONS'))
        return R([]);
      return R([]);
    });

    const { GET } = await import('@/app/api/permissions/check/route');

    const request = new Request(
      'http://localhost:3000/api/permissions/check?key=app.inspection.featureA',
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
});

// ============================================================
// 权限列表 GET /api/permissions
// ============================================================
describe('GET /api/permissions — 权限列表', () => {
  it('已登录用户获取权限列表 → 返回框架权限和应用权限', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    let callIndex = 0;
    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      callIndex++;
      // 第一次调用：应用权限查询（FROM permissions p LEFT JOIN tenant_permissions）
      if (s.includes('FROM PERMISSIONS') && s.includes('LEFT JOIN') && s.includes('"TENANTID"'))
        return R([{
          id: 'p2', key: 'app.perm1', label: '应用权限1',
          type: 'app', tenantId: 'tenant-001',
          tenantGrants: [],
        }]);
      // 第二次调用：框架权限查询（FROM tenant_permissions tp INNER JOIN permissions）
      if (s.includes('FROM TENANT_PERMISSIONS') && s.includes('INNER JOIN'))
        return R([{
          id: 'p1', key: 'framework.perm1', label: '框架权限1',
          type: 'framework', tenantId: null,
          tenantGrants: [{ id: 'tp-1', tenantId: 'tenant-001', grantedAt: new Date(), tenant: { id: 'tenant-001', name: '测试租户', slug: 'test' } }],
        }]);
      return R([]);
    });

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
    expect(data.data.framework[0].tenantGrants).toHaveLength(1);
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
