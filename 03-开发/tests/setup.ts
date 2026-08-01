// ============================================================
// HubForge - 测试框架基础设施
// Mock Prisma Client + 测试辅助函数
// ============================================================

import { vi, beforeEach } from 'vitest';

// ============================================================
// 1. Mock Prisma Client
// ============================================================

/**
 * 创建 Prisma mock 方法
 * 为每个 model 的 CRUD 方法生成 vi.fn()
 */
function createMockModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  };
}

/**
 * Mock Prisma Client 实例
 * 覆盖所有 10 个 model + VerificationCode
 */
export const mockPrisma = {
  tenant: createMockModel(),
  tenantConfig: createMockModel(),
  user: createMockModel(),
  department: createMockModel(),
  permission: createMockModel(),
  userPermission: createMockModel(),
  departmentPermission: createMockModel(),
  tenantPermission: createMockModel(),
  app: createMockModel(),
  appConfig: createMockModel(),
  tenantApp: createMockModel(),
  tenantAppConfig: createMockModel(),
  userTenant: createMockModel(),
  userOrganization: createMockModel(),
  verificationCode: createMockModel(),
  // 事务和原生 SQL
  $transaction: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
};

// Mock @/lib/prisma 模块，使所有业务代码拿到的都是我们的 mock
vi.mock('@/lib/prisma', () => ({
  db: mockPrisma,
}));

// Mock @/lib/rls 模块，直接执行回调而不连接真实数据库
vi.mock('@/lib/rls', () => ({
  setTenantContext: vi.fn(),
  setAdminContext: vi.fn(),
  withTenantContext: vi.fn(
    (_tenantId: string, _userId: string, _isGlobalAdmin: boolean, fn: () => Promise<any>) => fn()
  ),
}));

// Mock @/lib/pg-pool 模块，防止测试连接真实数据库
vi.mock('@/lib/pg-pool', () => ({
  rlsPool: { connect: vi.fn(), end: vi.fn() },
}));

// Mock pg 客户端，路由的 client.query() 调用会被此 mock 拦截
export const mockPgClient = {
  query: vi.fn(),
  release: vi.fn(),
};

// SQL → Prisma mock 桥接：把 client.query 的 SQL 路由到对应的 Prisma mock
function pgQueryBridge(sql: string, params?: any[]): any {
  const s = sql.trim().toUpperCase();
  const p = params || [];

  // SELECT
  if (s.startsWith('SELECT')) {
    if (s.includes('COUNT(*)')) {
      if (s.includes('FROM APPS')) return wrapCount(mockPrisma.app.count.mock.results[0]?.value ?? 0);
      if (s.includes('FROM USER_TENANTS')) return wrapCount(mockPrisma.userTenant.count.mock.results[0]?.value ?? 0);
      if (s.includes('FROM DEPARTMENTS')) return wrapCount(mockPrisma.department.count.mock.results[0]?.value ?? 0);
      if (s.includes('FROM USER_ORGANIZATIONS')) return wrapCount(mockPrisma.userOrganization.count.mock.results[0]?.value ?? 0);
      return wrapCount(0);
    }
    // 单表查询（LIMIT 1 = findFirst/findUnique）
    if (s.includes('FROM APPS')) {
      const d = s.includes('LIMIT 1') ? mockPrisma.app.findUnique.mock.results[0]?.value : mockPrisma.app.findMany.mock.results[0]?.value;
      return s.includes('LIMIT 1') ? wrap(d ?? null) : wrapMany(d ?? []);
    }
    if (s.includes('FROM TENANTS')) {
      const d = mockPrisma.tenant.findUnique.mock.results[0]?.value;
      return s.includes('LIMIT 1') ? wrap(d ?? null) : wrapMany(d ?? []);
    }
    if (s.includes('FROM USERS') && !s.includes('USER_TENANTS') && !s.includes('USER_PERMISSIONS') && !s.includes('USER_ORGANIZATIONS')) {
      const d = s.includes('LIMIT 1') ? mockPrisma.user.findUnique.mock.results[0]?.value : mockPrisma.user.findMany.mock.results[0]?.value;
      return s.includes('LIMIT 1') ? wrap(d ?? null) : wrapMany(d ?? []);
    }
    if (s.includes('FROM USER_TENANTS')) {
      const d = mockPrisma.userTenant.findUnique.mock.results[0]?.value ?? mockPrisma.userTenant.findFirst.mock.results[0]?.value ?? mockPrisma.userTenant.findMany.mock.results[0]?.value;
      return Array.isArray(d) ? wrapMany(d) : wrap(d ?? null);
    }
    if (s.includes('FROM DEPARTMENTS')) {
      const d = mockPrisma.department.findFirst.mock.results[0]?.value ?? mockPrisma.department.findUnique.mock.results[0]?.value ?? mockPrisma.department.findMany.mock.results[0]?.value;
      return Array.isArray(d) ? wrapMany(d) : wrap(d ?? null);
    }
    if (s.includes('FROM PERMISSIONS')) {
      const d = mockPrisma.permission.findFirst.mock.results[0]?.value ?? mockPrisma.permission.findMany.mock.results[0]?.value;
      return Array.isArray(d) ? wrapMany(d) : wrap(d ?? null);
    }
    if (s.includes('FROM USER_PERMISSIONS')) {
      const d = mockPrisma.userPermission.findFirst.mock.results[0]?.value ?? mockPrisma.userPermission.findMany.mock.results[0]?.value;
      return Array.isArray(d) ? wrapMany(d) : wrap(d ?? null);
    }
    if (s.includes('FROM DEPARTMENT_PERMISSIONS')) {
      const d = mockPrisma.departmentPermission.findFirst.mock.results[0]?.value ?? mockPrisma.departmentPermission.findMany.mock.results[0]?.value;
      return Array.isArray(d) ? wrapMany(d) : wrap(d ?? null);
    }
    if (s.includes('FROM TENANT_PERMISSIONS')) {
      const d = mockPrisma.tenantPermission.findFirst.mock.results[0]?.value ?? mockPrisma.tenantPermission.findMany.mock.results[0]?.value;
      return Array.isArray(d) ? wrapMany(d) : wrap(d ?? null);
    }
    if (s.includes('FROM USER_ORGANIZATIONS')) {
      const d = mockPrisma.userOrganization.findFirst.mock.results[0]?.value ?? mockPrisma.userOrganization.findMany.mock.results[0]?.value;
      return Array.isArray(d) ? wrapMany(d) : wrap(d ?? null);
    }
  }

  // INSERT
  if (s.startsWith('INSERT')) {
    if (s.includes('INTO APPS')) return wrap(mockPrisma.app.create.mock.results[0]?.value ?? { id: 'new-app' });
    if (s.includes('INTO TENANTS')) return wrap(mockPrisma.tenant.create?.mock.results[0]?.value ?? { id: 'new-tenant' });
    if (s.includes('INTO USERS')) return wrap(mockPrisma.user.create.mock.results[0]?.value ?? { id: 'new-user' });
    if (s.includes('INTO USER_TENANTS')) return wrap(mockPrisma.userTenant.create.mock.results[0]?.value ?? { id: 'new-ut' });
    if (s.includes('INTO DEPARTMENTS')) return wrap(mockPrisma.department.create.mock.results[0]?.value ?? { id: 'new-dept' });
    if (s.includes('INTO PERMISSIONS')) return wrap(mockPrisma.permission.create.mock.results[0]?.value ?? { id: 'new-perm' });
    if (s.includes('INTO USER_PERMISSIONS')) return wrap(mockPrisma.userPermission.create?.mock.results[0]?.value ?? { id: 'new-up' });
    if (s.includes('INTO TENANT_PERMISSIONS')) return wrap(mockPrisma.tenantPermission.create?.mock.results[0]?.value ?? { id: 'new-tp' });
    if (s.includes('INTO TENANT_APPS')) return wrap(mockPrisma.tenantApp.create?.mock.results[0]?.value ?? { id: 'new-ta' });
    if (s.includes('INTO USER_ORGANIZATIONS')) return wrap(mockPrisma.userOrganization.create?.mock.results[0]?.value ?? { id: 'new-uo' });
    if (s.includes('ON CONFLICT')) return wrap({ id: 'upserted' });
  }

  // UPDATE
  if (s.startsWith('UPDATE')) {
    if (s.includes('DEPARTMENTS')) return wrap(mockPrisma.department.update.mock.results[0]?.value ?? { id: 'updated' });
    if (s.includes('USER_TENANTS')) return wrap(mockPrisma.userTenant.update.mock.results[0]?.value ?? { id: 'updated' });
    if (s.includes('USERS')) return wrap(mockPrisma.user.update.mock.results[0]?.value ?? { id: 'updated' });
  }

  // DELETE
  if (s.startsWith('DELETE')) return { rows: [], rowCount: 1, command: 'DELETE', oid: 0, fields: [] };

  // SET / RESET / BEGIN / COMMIT / ROLLBACK
  if (s.includes('SET_CONFIG') || s.startsWith('RESET') || s.startsWith('SET ') ||
      s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
    return { rows: [], rowCount: 0, command: s.split(' ')[0], oid: 0, fields: [] };
  }

  return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
}

function wrap(data: any): any {
  if (data === null || data === undefined) return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
  if (data instanceof Promise) return data.then(d => wrap(d));
  return { rows: [data], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
}

function wrapMany(data: any): any {
  if (data instanceof Promise) return data.then(d => wrapMany(d));
  if (!Array.isArray(data)) return { rows: data ? [data] : [], rowCount: data ? 1 : 0, command: 'SELECT', oid: 0, fields: [] };
  return { rows: data, rowCount: data.length, command: 'SELECT', oid: 0, fields: [] };
}

function wrapCount(data: any): any {
  if (data instanceof Promise) return data.then(d => wrapCount(d));
  return { rows: [{ count: String(data ?? 0) }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
}

// Mock @/lib/rls-pg 模块，让 withTenantContext 传入 mockPgClient
const _firstRow = vi.fn((result: any) => result?.rows?.[0] ?? null);
const _allRows = vi.fn((result: any) => result?.rows ?? []);
const _countValue = vi.fn((result: any) => Number(result?.rows?.[0]?.count ?? 0));

vi.mock('@/lib/rls-pg', () => ({
  withTenantContext: vi.fn(
    (_ctx: any, fn: (client: any) => Promise<any>) => fn(mockPgClient)
  ),
  withElevatedContext: vi.fn(
    (fn: (client: any) => Promise<any>) => fn(mockPgClient)
  ),
  firstRow: (result: any) => _firstRow(result),
  allRows: (result: any) => _allRows(result),
  countValue: (result: any) => _countValue(result),
}));

// Mock next/headers 的 cookies()，返回可操作的 Cookie 存储
let mockCookies: Map<string, { value: string; [key: string]: any }>;

function createMockCookiesStore() {
  const store = new Map<string, { value: string; [key: string]: any }>();
  return {
    get: (name: string) => store.get(name),
    set: (name: string, value: string, options?: Record<string, any>) => {
      store.set(name, { value, ...options });
    },
    delete: (name: string) => store.delete(name),
    getAll: () => Array.from(store.entries()).map(([name, v]) => ({ name, ...v })),
    has: (name: string) => store.has(name),
    // 暴露 store 以便测试直接读取
    _store: store,
  };
}

vi.mock('next/headers', () => {
  return {
    cookies: () => createMockCookiesStore(),
    headers: () => new Map(),
  };
});

// Mock @/lib/auth 模块
// 保留真实的 signToken / verifyToken（用于签发和验证 JWT）
// 替换 getAuthUser 为从 Cookie header 提取 token 的版本
vi.mock('@/lib/auth', async () => {
  // 导入真实的 jose 库用于 JWT 操作
  const { SignJWT, jwtVerify } = await import('jose');
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production'
  );
  const COOKIE_NAME = 'hubforge-token';

  return {
    COOKIE_NAME,
    JWT_SECRET: secret,
    isAdmin: (payload: any) => payload?.role === 'owner' || payload?.role === 'admin',
    signToken: async (payload: any) => {
      return new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);
    },
    verifyToken: async (token: string) => {
      try {
        const { payload } = await jwtVerify(token, secret);
        return payload as any;
      } catch {
        return null;
      }
    },
    /**
     * 从请求的 Cookie header 中提取并验证 JWT
     * 解决 NextRequest.cookies 在测试环境中不可用的问题
     */
    getAuthUser: async (request: Request) => {
      const cookieHeader = request.headers.get('Cookie') || '';
      const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
      if (!match) return null;
      const token = match[1];
      try {
        const { payload } = await jwtVerify(token, secret);
        return payload as any;
      } catch {
        return null;
      }
    },
    getCookieOptions: () => ({
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      maxAge: 86400,
      path: '/',
    }),
  };
});

// ============================================================
// 2. 测试辅助函数
// ============================================================

import type { TokenPayload } from '@/lib/auth';

/**
 * 创建测试用户对象
 * @param overrides - 覆盖默认字段
 */
export function createTestUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-test-001',
    email: 'test@example.com',
    name: '测试用户',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

/**
 * 创建测试租户对象
 * @param overrides - 覆盖默认字段
 */
export function createTestTenant(overrides: Record<string, any> = {}) {
  return {
    id: 'tenant-test-001',
    name: '测试租户',
    slug: 'test-tenant',
    status: 'active',
    maxUsers: 100,
    maxApps: 50,
    maxOrgLevels: 5,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

/**
 * 生成测试用 JWT（同步签名，使用 jose）
 * @param userId - 用户 ID
 * @param tenantId - 租户 ID
 * @param isGlobalAdmin - 是否全局管理员（同时映射为 role='owner'）
 */
export async function createAuthToken(
  userId = 'user-test-001',
  tenantId = 'tenant-test-001',
  roleOrAdmin: 'owner' | 'admin' | 'member' | boolean = 'member'
): Promise<string> {
  const role = typeof roleOrAdmin === 'boolean'
    ? (roleOrAdmin ? 'owner' : 'member')
    : roleOrAdmin;
  const { SignJWT } = await import('jose');
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production'
  );
  return new SignJWT({
    userId,
    tenantId,
    email: 'test@example.com',
    role,
  } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}

/**
 * 创建模拟 NextRequest
 * @param url - 请求 URL
 * @param method - HTTP 方法
 * @param body - 请求体
 * @param cookieToken - Cookie 中的 JWT
 */
export function mockRequest(
  url = 'http://localhost:3000/api/test',
  method = 'GET',
  body?: Record<string, any>,
  cookieToken?: string
): Request {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (cookieToken) {
    headers.set('Cookie', `hubforge-token=${cookieToken}`);
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

/**
 * 每个测试前重置所有 mock
 */
export function resetAllMocks() {
  // 重置 Prisma model 方法
  for (const key of Object.keys(mockPrisma)) {
    const model = (mockPrisma as any)[key];
    if (model && typeof model === 'object') {
      for (const method of Object.keys(model)) {
        if (typeof model[method]?.mockReset === 'function') {
          model[method].mockReset();
        }
      }
    }
  }
  // 重置顶层方法
  mockPrisma.$transaction.mockReset();
  mockPrisma.$executeRawUnsafe.mockReset();
  mockPrisma.$queryRaw.mockReset();
  mockPrisma.$queryRawUnsafe.mockReset();
  mockPrisma.$connect.mockReset();
  mockPrisma.$disconnect.mockReset();

  // 重置 pg mock 客户端
  mockPgClient.query.mockReset();
  mockPgClient.query.mockImplementation((sql: string, params?: any[]) => pgQueryBridge(sql, params));
  mockPgClient.release.mockReset();
}

// 每个测试前自动重置 mock
beforeEach(() => {
  resetAllMocks();
});
