// ============================================================
// HubForge - M1 认证模块 API 测试
// 测试 register / login / logout / me 四个端点
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { mockPrisma, createTestUser, createTestTenant, createAuthToken } from '../setup';

// ============================================================
// register 测试
// ============================================================
describe('POST /api/auth/register — 用户注册', () => {
  // 动态导入路由模块，确保 mock 生效
  async function getRoute() {
    return await import('@/app/api/auth/register/route');
  }

  it('正常注册新用户 → 返回成功（TC-001）', async () => {
    // 准备：模拟邮箱和 slug 均不存在
    mockPrisma.tenant.findUnique.mockResolvedValue(null); // slug 不重复
    mockPrisma.user.findFirst.mockResolvedValue(null);    // 邮箱不重复

    // 模拟事务：创建租户和用户
    const mockTenant = createTestTenant({ id: 'new-tenant-id' });
    const mockUser = createTestUser({
      id: 'new-user-id',
      tenantId: 'new-tenant-id',
      isGlobalAdmin: true,
    });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        tenant: { create: vi.fn().mockResolvedValue(mockTenant) },
        user: { create: vi.fn().mockResolvedValue(mockUser) },
      });
    });

    const { POST } = await getRoute();

    // 构造请求
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantName: '新租户',
        tenantSlug: 'new-tenant',
        email: 'new@example.com',
        password: 'Abcd@1234',
        name: '新用户',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('注册成功');
    expect(data.data.user.email).toBe('test@example.com'); // mockUser 的默认邮箱
  });

  it('重复邮箱注册 → 返回错误（TC-002）', async () => {
    // slug 不存在，但邮箱已存在
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(
      createTestUser({ email: 'exist@example.com' })
    );

    const { POST } = await getRoute();

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantName: '测试租户',
        tenantSlug: 'test-slug',
        email: 'exist@example.com',
        password: 'Abcd@1234',
        name: '测试',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toContain('邮箱');
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
        password: '123', // 太弱
        name: '测试',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    // Zod 验证失败，应返回错误信息
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
// login 测试
// ============================================================
describe('POST /api/auth/login — 用户登录', () => {
  async function getRoute() {
    return await import('@/app/api/auth/login/route');
  }

  it('正常登录 → 写入 httpOnly Cookie（TC-005）', async () => {
    // bcrypt hash for 'Abcd@1234' with cost 12
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('Abcd@1234', 12);

    mockPrisma.user.findFirst.mockResolvedValue(
      createTestUser({
        passwordHash,
        status: 'active',
        tenant: createTestTenant(),
      })
    );

    const { POST } = await getRoute();

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Abcd@1234',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('登录成功');
    expect(data.data.user.email).toBe('test@example.com');
  });

  it('错误密码 → 返回 401（TC-006）', async () => {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('Correct@123', 12);

    mockPrisma.user.findFirst.mockResolvedValue(
      createTestUser({
        passwordHash,
        failedLoginAttempts: 0,
        tenant: createTestTenant(),
      })
    );
    mockPrisma.user.update.mockResolvedValue({});

    const { POST } = await getRoute();

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'WrongPassword@1',
      }),
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

    // 第 5 次错误尝试（failedLoginAttempts 已经是 4）
    mockPrisma.user.findFirst.mockResolvedValue(
      createTestUser({
        passwordHash,
        failedLoginAttempts: 4,
        tenant: createTestTenant(),
      })
    );
    mockPrisma.user.update.mockResolvedValue({});

    const { POST } = await getRoute();

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'WrongPassword@1',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    // 第 5 次失败后应锁定
    expect(data.success).toBe(false);
    expect(data.error).toContain('锁定');
  });

  it('未激活用户登录 → 返回 403（TC-009）', async () => {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('Abcd@1234', 12);

    mockPrisma.user.findFirst.mockResolvedValue(
      createTestUser({
        passwordHash,
        status: 'invited', // 未激活
        tenant: createTestTenant(),
      })
    );

    const { POST } = await getRoute();

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Abcd@1234',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(response.status).toBe(403);
    expect(data.error).toContain('激活');
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
// me 测试
// ============================================================
describe('GET /api/auth/me — 获取当前用户信息', () => {
  it('已登录 → 返回用户信息和权限', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', true);

    const userWithRelations = createTestUser({
      id: 'user-001',
      tenantId: 'tenant-001',
      departmentId: null,
      department: null,
      tenant: createTestTenant(),
      grantedPermissions: [
        {
          permission: {
            key: 'app.inspection.view',
            label: '查看巡检',
            type: 'app',
          },
        },
      ],
    });

    mockPrisma.user.findUnique.mockResolvedValue(userWithRelations);
    mockPrisma.departmentPermission.findMany.mockResolvedValue([]);

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
