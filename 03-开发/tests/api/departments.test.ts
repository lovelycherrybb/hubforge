// ============================================================
// HubForge - 组织架构（部门管理）API 测试
// 测试部门 CRUD、部门树、移动节点、删除拦截
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { mockPgClient, createAuthToken } from '../setup';

/** 创建 pg 查询结果 */
const R = (rows: any[], command = 'SELECT') => ({
  rows, rowCount: rows.length, command, oid: 0, fields: [],
});

let POST_dept: any, GET_tree: any, PUT_dept: any, DELETE_dept: any, PUT_move: any;

beforeAll(async () => {
  const route = await import('@/app/api/departments/route');
  POST_dept = route.POST;
  const treeRoute = await import('@/app/api/departments/tree/route');
  GET_tree = treeRoute.GET;
  const idRoute = await import('@/app/api/departments/[id]/route');
  PUT_dept = idRoute.PUT;
  DELETE_dept = idRoute.DELETE;
  const moveRoute = await import('@/app/api/departments/[id]/move/route');
  PUT_move = moveRoute.PUT;
});

// ============================================================
// POST /api/departments — 创建部门
// ============================================================
describe('POST /api/departments — 创建部门', () => {
  it('管理员创建根部门 → 成功（TC-033）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    const mockDept = {
      id: 'dept-001',
      name: '总公司',
      parentId: null,
      sortOrder: 0,
      tenantId: 'tenant-001',
    };

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.startsWith('INSERT') && s.includes('DEPARTMENTS')) return R([mockDept], 'INSERT');
      return R([]);
    });

    const request = new Request('http://localhost:3000/api/departments', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: '总公司' }),
    }) as any;

    const response = await POST_dept(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('总公司');
  });

  it('管理员创建子部门 → 成功（TC-034）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    const mockDept = {
      id: 'dept-002',
      name: '生产部',
      parentId: 'dept-root',
      sortOrder: 0,
      tenantId: 'tenant-001',
    };

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 租户配置（maxOrgLevels）
      if (s.includes('FROM TENANTS'))
        return R([{ maxOrgLevels: 5 }]);
      // 查询父部门的 parentId（SELECT "parentId" FROM departments）
      if (s.includes('FROM DEPARTMENTS') && s.includes('"PARENTID"'))
        return R([{ parentId: null }]);
      // 检查父部门存在（SELECT id FROM departments）
      if (s.includes('FROM DEPARTMENTS') && !s.includes('COUNT'))
        return R([{ id: 'dept-root' }]);
      // INSERT
      if (s.startsWith('INSERT') && s.includes('DEPARTMENTS')) return R([mockDept], 'INSERT');
      return R([]);
    });

    const request = new Request('http://localhost:3000/api/departments', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: '生产部', parentId: 'dept-root' }),
    }) as any;

    const response = await POST_dept(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.parentId).toBe('dept-root');
  });

  it('非管理员创建部门 → 返回 403', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    const request = new Request('http://localhost:3000/api/departments', {
      method: 'POST',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: '测试部' }),
    }) as any;

    const response = await POST_dept(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// GET /api/departments/tree — 部门树查询
// ============================================================
describe('GET /api/departments/tree — 部门树', () => {
  it('已登录用户获取部门树 → 返回树形结构', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    const departments = [
      { id: 'dept-root', name: '总公司', parentId: null, sortOrder: 0, userCount: 5 },
      { id: 'dept-002', name: '生产部', parentId: 'dept-root', sortOrder: 1, userCount: 3 },
    ];

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM DEPARTMENTS')) return R(departments);
      return R([]);
    });

    const request = new Request('http://localhost:3000/api/departments/tree', {
      method: 'GET',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await GET_tree(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].name).toBe('总公司');
    expect(data.data[0].children).toHaveLength(1);
    expect(data.data[0].children[0].name).toBe('生产部');
  });

  it('未登录获取部门树 → 返回 401', async () => {
    const request = new Request('http://localhost:3000/api/departments/tree', {
      method: 'GET',
    }) as any;

    const response = await GET_tree(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// DELETE /api/departments/:id — 删除部门
// ============================================================
describe('DELETE /api/departments/:id — 删除部门', () => {
  it('删除无用户无子部门的部门 → 成功（TC-036）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找部门
      if (s.includes('FROM DEPARTMENTS') && s.includes('LIMIT')) return R([{ id: 'dept-001', name: '质检部', tenantId: 'tenant-001' }]);
      // 子部门计数
      if (s.includes('COUNT(*)') && s.includes('FROM DEPARTMENTS')) return R([{ count: '0' }]);
      // 用户计数
      if (s.includes('COUNT(*)') && s.includes('FROM USER_ORGANIZATIONS')) return R([{ count: '0' }]);
      // DELETE
      if (s.startsWith('DELETE')) return { rows: [], rowCount: 1, command: 'DELETE', oid: 0, fields: [] };
      return R([]);
    });

    const request = new Request('http://localhost:3000/api/departments/dept-001', {
      method: 'DELETE',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await DELETE_dept(request, { params: { id: 'dept-001' } });

    expect(response.status).toBe(204);
  });

  it('删除含用户的部门 → 拦截（TC-037）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM DEPARTMENTS') && s.includes('LIMIT')) return R([{ id: 'dept-001', name: '生产部', tenantId: 'tenant-001' }]);
      if (s.includes('COUNT(*)') && s.includes('FROM DEPARTMENTS')) return R([{ count: '0' }]);
      if (s.includes('COUNT(*)') && s.includes('FROM USER_ORGANIZATIONS')) return R([{ count: '3' }]);
      return R([]);
    });

    const request = new Request('http://localhost:3000/api/departments/dept-001', {
      method: 'DELETE',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await DELETE_dept(request, { params: { id: 'dept-001' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('用户');
  });

  it('删除含子部门的部门 → 拦截', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM DEPARTMENTS') && s.includes('LIMIT')) return R([{ id: 'dept-001', name: '总公司', tenantId: 'tenant-001' }]);
      if (s.includes('COUNT(*)') && s.includes('FROM DEPARTMENTS')) return R([{ count: '2' }]);
      return R([]);
    });

    const request = new Request('http://localhost:3000/api/departments/dept-001', {
      method: 'DELETE',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await DELETE_dept(request, { params: { id: 'dept-001' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('子部门');
  });

  it('删除不存在的部门 → 返回 404', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      if (s.includes('FROM DEPARTMENTS') && s.includes('LIMIT')) return R([]);
      return R([]);
    });

    const request = new Request('http://localhost:3000/api/departments/nonexistent', {
      method: 'DELETE',
      headers: { Cookie: `hubforge-token=${token}` },
    }) as any;

    const response = await DELETE_dept(request, { params: { id: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });
});

// ============================================================
// PUT /api/departments/:id/move — 移动部门节点
// ============================================================
describe('PUT /api/departments/:id/move — 移动部门', () => {
  it('非管理员移动部门 → 返回 403', async () => {
    const token = await createAuthToken('user-001', 'tenant-001', 'member');

    const request = new Request('http://localhost:3000/api/departments/dept-001/move', {
      method: 'PUT',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parentId: 'dept-002' }),
    }) as any;

    const response = await PUT_move(request, { params: { id: 'dept-001' } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
  });

  it('将部门移动到自身下 → 拦截', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找源部门
      if (s.includes('FROM DEPARTMENTS') && s.includes('LIMIT'))
        return R([{ id: 'dept-001', name: 'IT部', parentId: 'dept-root', tenantId: 'tenant-001' }]);
      return R([]);
    });

    const request = new Request('http://localhost:3000/api/departments/dept-001/move', {
      method: 'PUT',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parentId: 'dept-001' }),
    }) as any;

    const response = await PUT_move(request, { params: { id: 'dept-001' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('自身');
  });

  it('移动部门到新父级 → 成功（TC-038）', async () => {
    const token = await createAuthToken('admin-001', 'tenant-001', 'owner');

    mockPgClient.query.mockImplementation(async (sql: string) => {
      const s = sql.toUpperCase();
      // 查找源部门
      if (s.includes('FROM DEPARTMENTS') && s.includes('LIMIT'))
        return R([{ id: 'dept-it', name: 'IT部', parentId: 'dept-root', tenantId: 'tenant-001' }]);
      // 查找目标父部门（getDeptParent）
      if (s.includes('FROM DEPARTMENTS') && s.includes('"PARENTID"'))
        return R([{ id: 'dept-branch', parentId: null }]);
      // UPDATE
      if (s.startsWith('UPDATE') && s.includes('DEPARTMENTS'))
        return R([{ id: 'dept-it', name: 'IT部', parentId: 'dept-branch', tenantId: 'tenant-001' }], 'UPDATE');
      return R([]);
    });

    const request = new Request('http://localhost:3000/api/departments/dept-it/move', {
      method: 'PUT',
      headers: {
        Cookie: `hubforge-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parentId: 'dept-branch' }),
    }) as any;

    const response = await PUT_move(request, { params: { id: 'dept-it' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.parentId).toBe('dept-branch');
  });
});
