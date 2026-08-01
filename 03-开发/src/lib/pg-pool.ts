// ============================================================
// HubForge - pg Pool for RLS tenant isolation
// 与 Prisma 共存，仅用于需要 SET 会话变量的 RLS 路由
// pool.connect() 保证 release 前所有查询在同一连接上
// ============================================================

import pg from "pg";

const globalForPg = globalThis as unknown as {
  pgPool: pg.Pool | undefined;
};

function createPool(): pg.Pool {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_RLS_POOL_SIZE ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

// 开发环境热重载复用
export const rlsPool: pg.Pool = globalForPg.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = rlsPool;
}
