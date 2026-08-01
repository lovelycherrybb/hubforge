// ============================================================
// HubForge - 应用管理 API 测试
// 测试应用 CRUD、slug 唯一性、权限控制
// ============================================================

import { describe, it, expect } from 'vitest';
import { mockPgClient, createAuthToken } from '../setup';

/** 创建 pg 查询结果 */
const R = (rows: any[], command = 'SELECT') => ({
  rows, rowCount: rows.length, command, oid: 0, fields: [],
});

// ============================================================
// POST /api/apps — 注册应用（仅主租户）
// ============================================================
describe('POST /api/apps — 注册应用', () => {
  it('主租户管理员注册应用 → 成功（TC-053）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', true);

    const mockApp = {
      id: 'app-001',
      name: '数据看板',
      slug: 'dashboard',
      type: 'pc',
      url: 'https://dashboard.example.com',
      status: 'active',
      sortOrder: 0,
      createdAt: new Date(),
    };

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // slug 唯一性检查
      if (s.includes('FROM APPS') && s.includes('SLUG')) return R([]);
      // INSERT app
      if (s.startsWith('INSERT') && s.includes('INTO APPS')) return R([mockApp], 'INSERT');
      // INSERT tenant_apps
      if (s.includes('INTO TENANT_APPS')) return R([{ id: 'new-ta' }], 'INSERT');
      // 框架权限检查（不存在）
      if (s.includes('FROM PERMISSIONS') && s.includes('FRAMEWORK')) return R([]);
      // INSERT permissions
      if (s.startsWith('INSERT') && s.includes('INTO PERMISSIONS') && !s.includes('TENANT_PERMISSIONS')) return R([{ id: 'perm-001' }], 'INSERT');
      // INSERT tenant_permissions
      if (s.includes('INTO TENANT_PERMISSIONS')) return R([{ id: 'new-tp' }], 'INSERT');
      return R([]);
    });

    const { POST } = await import('@/app/api/apps/route');

    const request = new Request('http://localhost:3000/api/apps', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '数据看板',
        slug: 'dashboard',
        type: 'pc',
        url: 'https://dashboard.example.com',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('数据看板');
  });

  it('slug 已存在 → 注册失败', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', true);

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM APPS') && s.includes('SLUG')) return R([{ id: 'existing-app', slug: 'dashboard' }]);
      return R([]);
    });

    const { POST } = await import('@/app/api/apps/route');

    const request = new Request('http://localhost:3000/api/apps', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '数据看板',
        slug: 'dashboard',
        url: 'https://dashboard.example.com',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('标识已存在');
  });

  it('非主租户管理员注册应用 → 返回 403', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', false);

    const { POST } = await import('@/app/api/apps/route');

    const request = new Request('http://localhost:3000/api/apps', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '数据看板',
        slug: 'dashboard',
        url: 'https://dashboard.example.com',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it('未登录注册应用 → 返回 401', async () => {
    const { POST } = await import('@/app/api/apps/route');

    const request = new Request('http://localhost:3000/api/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '数据看板',
        slug: 'dashboard',
        url: 'https://dashboard.example.com',
      }),
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// GET /api/apps — 应用列表
// ============================================================
describe('GET /api/apps — 应用列表', () => {
  it('主租户管理员查看所有应用 → 返回全部', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', true);

    const apps = [
      { id: 'app-1', name: '巡检系统', slug: 'inspection', status: 'active' },
      { id: 'app-2', name: '数据看板', slug: 'dashboard', status: 'active' },
    ];

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('COUNT(*)')) return R([{ count: '2' }]);
      if (s.includes('FROM APPS')) return R(apps);
      return R([]);
    });

    const { GET } = await import('@/app/api/apps/route');

    const request = new Request('http://localhost:3000/api/apps?page=1&pageSize=20', {
      method: 'GET',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
  });

  it('未登录查看应用列表 → 返回 401', async () => {
    const { GET } = await import('@/app/api/apps/route');

    const request = new Request('http://localhost:3000/api/apps', {
      method: 'GET',
    }) as any;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});
