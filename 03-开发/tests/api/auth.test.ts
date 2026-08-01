// ============================================================
// HubForge - M1 认证模块 API 测试
// 测试 register / login / logout / me 四个端点
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { mockPrisma, mockPgClient, createTestTenant, createAuthToken } from '../setup';

/** 创建 pg 查询结果 */
const R = (rows: any[], command = 'SELECT') => ({
  rows, rowCount: rows.length, command, oid: 0, fields: [],
});

// ============================================================
// register 测试（⚠️ 路由仍使用 Prisma，保留 mockPrisma）
// ============================================================
describe('POST /api/auth/register — 用户注册', () => {
  async function getRoute() {
    return await import('@/app/api/auth/register/route');
  }

  it('正常注册新租户 → 返回成功（TC-001）', async () => {
    const ownerToken = await createAuthToken('owner-001', 'tenant-001', true);

    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    const mockTenant = createTestTenant({ id: 'new-tenant-id', slug: 'new-tenant' });
    const mockNewUser = { id: 'new-user-id', email: 'new@example.com', name: '新用户' };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        tenant: { create: vi.fn().mockResolvedValue(mockTenant) },
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(mockNewUser),
        },
        userTenant: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const { POST } = await getRoute();

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hubforge-token=${ownerToken}`,
      },
      body: JSON.stringify({
        tenantName: '新租户',
        tenantSlug: 'new-tenant',
        adminEmail: 'new@example.com',
        adminName: '新用户',
        adminPassword: 'Abcd@1234',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('租户创建成功');
    expect(data.data.admin.email).toBe('new@example.com');
  });

  it('重复slug注册 → 返回错误（TC-002）', async () => {
    const ownerToken = await createAuthToken('owner-001', 'tenant-001', true);

    mockPrisma.tenant.findUnique.mockResolvedValue(
      createTestTenant({ slug: 'existing-slug' })
    );

    const { POST } = await getRoute();

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hubforge-token=${ownerToken}`,
      },
      body: JSON.stringify({
        tenantName: '测试租户',
        tenantSlug: 'existing-slug',
        adminEmail: 'test@example.com',
        adminName: '测试',
        adminPassword: 'Abcd@1234',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain('租户标识');
  });

  it('弱密码注册 → 返回 400（TC-003）', async () => {
    const { POST } = await getRoute();

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantName: '测试租户',
        tenantSlug: 'test-slug',
        email: 'test@example.com',
        password: '123',
        name: '测试',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
  });

  it('空字段注册 → 返回 400（TC-017）', async () => {
    const { POST } = await getRoute();

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
  });
});

// ============================================================
// login 测试（⚠️ 路由仍使用 Prisma，保留 mockPrisma）
// ============================================================
describe('POST /api/auth/login — 用户登录', () => {
  async function getRoute() {
    return await import('@/app/api/auth/login/route');
  }

  const TEST_EMAIL = 'test@example.com';
  const TEST_PASSWORD = 'Abcd@1234';
  const TENANT_ID = 'tenant-test-001';

  function mockStep1(passwordHash: string, userOverrides: Record<string, any> = {}) {
    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // Step1: 查询用户
      if (s.includes('FROM USERS') && s.includes('EMAIL')) {
        return { rows: [{ id: 'user-test-001', email: TEST_EMAIL, name: '测试用户' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
      }
      // Step1: 查询租户成员
      if (s.includes('FROM USER_TENANTS') && s.includes('JOIN TENANTS')) {
        return { rows: [{
          id: 'ut-001', tenantId: TENANT_ID, role: 'admin', status: userOverrides.status || 'active',
          t_id: TENANT_ID, t_name: '测试租户', t_slug: 'test-tenant', t_logoUrl: null, t_status: 'active',
        }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
      }
      // set_config / RESET
      if (s.includes('SET_CONFIG') || s.startsWith('RESET')) {
        return { rows: [], rowCount: 0, command: 'SET', oid: 0, fields: [] };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });
  }

  function mockStep2(passwordHash: string, utOverrides: Record<string, any> = {}) {
    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // Step2: 查询 userTenant + user + tenant
      if (s.includes('FROM USER_TENANTS') && s.includes('JOIN USERS')) {
        return { rows: [{
          id: 'ut-001', userId: 'user-test-001', tenantId: TENANT_ID,
          passwordHash, role: 'admin', status: utOverrides.status || 'active',
          failedAttempts: utOverrides.failedAttempts || 0, lockedUntil: utOverrides.lockedUntil || null,
          u_id: 'user-test-001', u_email: TEST_EMAIL, u_name: '测试用户',
          t_id: TENANT_ID, t_name: '测试租户', t_slug: 'test-tenant', t_status: 'active',
        }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
      }
      // UPDATE user_tenants
      if (s.startsWith('UPDATE') && s.includes('USER_TENANTS')) {
        return { rows: [], rowCount: 1, command: 'UPDATE', oid: 0, fields: [] };
      }
      // set_config / RESET
      if (s.includes('SET_CONFIG') || s.startsWith('RESET')) {
        return { rows: [], rowCount: 0, command: 'SET', oid: 0, fields: [] };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });
  }

  function loginStep2Body(overrides: Record<string, any> = {}) {
    return { email: TEST_EMAIL, tenantId: TENANT_ID, step: 2, ...overrides };
  }

  it('正常登录 → 写入 httpOnly Cookie（TC-005）', async () => {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
    mockStep2(passwordHash);

    const { POST } = await getRoute();
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginStep2Body({ password: TEST_PASSWORD })),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('登录成功');
    expect(data.data.user.email).toBe(TEST_EMAIL);
  });

  it('错误密码 → 返回 401（TC-006）', async () => {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('Correct@123', 12);
    mockStep2(passwordHash, { failedAttempts: 0 });

    const { POST } = await getRoute();
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginStep2Body({ password: 'WrongPassword@1' })),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(response.status).toBe(401);
    expect(data.error).toContain('密码错误');
  });

  it('5 次错误密码后锁定 → 返回 403（TC-007）', async () => {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('Correct@123', 12);
    mockStep2(passwordHash, { failedAttempts: 4 });

    const { POST } = await getRoute();
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginStep2Body({ password: 'WrongPassword@1' })),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain('锁定');
  });

  it('未激活用户登录 → 仍可登录（新流程不做invited拦截）', async () => {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
    mockStep2(passwordHash, { status: 'invited' });

    const { POST } = await getRoute();
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginStep2Body({ password: TEST_PASSWORD })),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
  });
});

// ============================================================
// logout 测试
// ============================================================
describe('POST /api/auth/logout — 用户登出', () => {
  it('登出 → 返回成功（TC-013）', async () => {
    const { POST } = await import('@/app/api/auth/logout/route');

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('已登出');
  });
});

// ============================================================
// me 测试（已迁移 pg raw SQL）
// ============================================================
describe('GET /api/auth/me — 获取当前用户信息', () => {
  it('已登录 → 返回用户信息和权限', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', false);

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找用户
      if (s.includes('FROM USERS') && s.includes('WHERE'))
        return R([{ id: 'user-001', email: 'test@example.com', name: '测试用户', avatarUrl: null }]);
      // 查找租户
      if (s.includes('FROM TENANTS') && s.includes('WHERE'))
        return R([{ id: 'tenant-001', name: '测试租户', slug: 'test-tenant', logoUrl: null }]);
      // 查找 userTenant
      if (s.includes('FROM USER_TENANTS') && s.includes('WHERE'))
        return R([{ role: 'admin', status: 'active' }]);
      // 查找用户权限（JOIN permissions）
      if (s.includes('FROM USER_PERMISSIONS') && s.includes('INNER JOIN'))
        return R([{ key: 'app.inspection.view', label: '查看巡检', type: 'app' }]);
      // 查找用户组织
      if (s.includes('FROM USER_ORGANIZATIONS'))
        return R([]);
      return R([]);
    });

    const { GET } = await import('@/app/api/auth/me/route');

    const request = new Request('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        Cookie: `hubforge-token=${token}`,
      },
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('user-001');
    expect(data.data.permissions).toHaveLength(1);
    expect(data.data.permissions[0].key).toBe('app.inspection.view');
    expect(data.data.role).toBe('admin');
    expect(data.data.tenant.id).toBe('tenant-001');
  });

  it('未登录 → 返回 401', async () => {
    const { GET } = await import('@/app/api/auth/me/route');

    const request = new Request('http://localhost:3000/api/auth/me', {
      method: 'GET',
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('登录');
  });
});
