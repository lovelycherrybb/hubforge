// ============================================================
// HubForge - 应用 Token 端点测试
// 测试 /api/apps/:id/token、/api/apps/verify-token、/api/apps/:id/register-permissions
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { mockPrisma, createAuthToken } from '../setup';

// ============================================================
// GET /api/apps/:id/token — 签发应用 Token
// ============================================================
describe('GET /api/apps/:id/token — 签发应用 Token', () => {
  it('已登录用户 + 有权访问应用 → 返回 Token', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', true);

    mockPrisma.app.findUnique.mockResolvedValue({
      id: 'app-001',
      slug: 'dashboard',
      tenantId: 'tenant-001',
      config: { theme: 'dark' },
    });
    mockPrisma.permission.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({ name: '张三', email: 'z@test.com' });

    const { GET } = await import('@/app/api/apps/[id]/token/route');

    const request = new Request('http://localhost:3000/api/apps/app-001/token', {
      method: 'GET',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await GET(request, { params: { id: 'app-001' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.token).toBeTruthy();
    expect(data.data.user.name).toBe('张三');
    expect(data.data.user.tenantId).toBe('tenant-001');
    expect(data.data.config).toEqual({ theme: 'dark' });
  });

  it('应用不存在 → 返回 404', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', false);

    mockPrisma.app.findUnique.mockResolvedValue(null);

    const { GET } = await import('@/app/api/apps/[id]/token/route');

    const request = new Request('http://localhost:3000/api/apps/nonexistent/token', {
      method: 'GET',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await GET(request, { params: { id: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('未登录 → 返回 401', async () => {
    const { GET } = await import('@/app/api/apps/[id]/token/route');

    const request = new Request('http://localhost:3000/api/apps/app-001/token', {
      method: 'GET',
    }) as any;

    const response = await GET(request, { params: { id: 'app-001' } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// POST /api/apps/verify-token — 验证应用 Token
// ============================================================
describe('POST /api/apps/verify-token — 验证应用 Token', () => {
  it('有效 Token → 返回用户信息', async () => {
    // 先签发一个真实的 app token
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production'
    );
    const appToken = await new SignJWT({
      userId: 'user-001',
      tenantId: 'tenant-001',
      email: 'test@example.com',
      name: '张三',
      appSlug: 'dashboard',
      appId: 'app-001',
      permissions: ['admin', 'editor'],
      config: { theme: 'dark' },
    } as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('hubforge')
      .setAudience('dashboard')
      .sign(secret);

    const { POST } = await import('@/app/api/apps/verify-token/route');

    const request = new Request('http://localhost:3000/api/apps/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: appToken, appSlug: 'dashboard' }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.valid).toBe(true);
    expect(data.data.userId).toBe('user-001');
    expect(data.data.tenantId).toBe('tenant-001');
    expect(data.data.permissions).toEqual(['admin', 'editor']);
    expect(data.data.config).toEqual({ theme: 'dark' });
  });

  it('无效 Token → 返回 valid: false', async () => {
    const { POST } = await import('@/app/api/apps/verify-token/route');

    const request = new Request('http://localhost:3000/api/apps/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid-token', appSlug: 'dashboard' }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.valid).toBe(false);
  });

  it('缺少参数 → 返回 400', async () => {
    const { POST } = await import('@/app/api/apps/verify-token/route');

    const request = new Request('http://localhost:3000/api/apps/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// POST /api/apps/:id/register-permissions — 注册应用权限
// ============================================================
describe('POST /api/apps/:id/register-permissions — 注册应用权限', () => {
  it('管理员声明权限 → 成功创建', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', true);

    mockPrisma.app.findUnique.mockResolvedValue({
      id: 'app-001',
      slug: 'dashboard',
      tenantId: 'tenant-001',
    });
    mockPrisma.permission.findFirst.mockResolvedValue(null); // 不存在
    mockPrisma.permission.create.mockResolvedValue({ id: 'perm-001' });
    mockPrisma.permission.update.mockResolvedValue({});

    const { POST } = await import('@/app/api/apps/[id]/register-permissions/route');

    const request = new Request('http://localhost:3000/api/apps/app-001/register-permissions', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permissions: [
          { key: 'admin', label: '管理员' },
          { key: 'editor', label: '编辑者' },
        ],
      }),
    }) as any;

    const response = await POST(request, { params: { id: 'app-001' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.summary.total).toBe(2);
    expect(data.data.summary.created).toBe(2);
    expect(mockPrisma.permission.create).toHaveBeenCalledTimes(2);
  });

  it('非管理员 → 返回 403', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', false);

    const { POST } = await import('@/app/api/apps/[id]/register-permissions/route');

    const request = new Request('http://localhost:3000/api/apps/app-001/register-permissions', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permissions: [{ key: 'admin', label: '管理员' }],
      }),
    }) as any;

    const response = await POST(request, { params: { id: 'app-001' } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it('空权限列表 → 返回 400', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', true);

    mockPrisma.app.findUnique.mockResolvedValue({
      id: 'app-001',
      slug: 'dashboard',
      tenantId: 'tenant-001',
    });

    const { POST } = await import('@/app/api/apps/[id]/register-permissions/route');

    const request = new Request('http://localhost:3000/api/apps/app-001/register-permissions', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ permissions: [] }),
    }) as any;

    const response = await POST(request, { params: { id: 'app-001' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });
});
