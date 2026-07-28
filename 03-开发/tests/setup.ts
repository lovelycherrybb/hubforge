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
    (_tenantId: string, _isGlobalAdmin: boolean, fn: () => Promise<any>) => fn()
  ),
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
}

// 每个测试前自动重置 mock
beforeEach(() => {
  resetAllMocks();
});
