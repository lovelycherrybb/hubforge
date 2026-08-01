// ============================================================
// HubForge - RLS 租户隔离 (pg 版)
// 用 pg.Pool 独占连接保证 SET → 查询 → RESET 全程同一连接
// set_config($1, true) 参数化，无 SQL 注入风险
// ============================================================

import pg from "pg";
import { rlsPool } from "./pg-pool";

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

interface TenantContext {
  tenantId: string;
  userId: string;
  isGlobalAdmin: boolean;
}

/**
 * 在租户上下文中执行数据库操作
 * pool.connect() 独占连接，release 前所有查询保证在同一连接上
 *
 * @example
 * const result = await withTenantContext(
 *   { tenantId: 't1', userId: 'u1', isGlobalAdmin: false },
 *   async (client) => {
 *     const { rows } = await client.query(
 *       'SELECT * FROM apps WHERE tenant_id = $1', [tenantId]
 *     );
 *     return rows;
 *   }
 * );
 */
export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const { tenantId, userId, isGlobalAdmin } = ctx;

  if (!SAFE_ID_REGEX.test(tenantId))
    throw new Error(`Invalid tenantId: ${tenantId}`);
  if (!SAFE_ID_REGEX.test(userId))
    throw new Error(`Invalid userId: ${userId}`);

  const client = await rlsPool.connect();
  try {
    // set_config 第三个参数 is_local=true：
    //   事务内 → COMMIT/ROLLBACK 后自动清除
    //   非事务 → 变量在连接上持续到显式 RESET
    // 参数化查询防注入
    await client.query(
      "SELECT set_config('app.tenant_id', $1, false)",
      [tenantId]
    );
    await client.query(
      "SELECT set_config('app.user_id', $1, false)",
      [userId]
    );
    await client.query(
      "SELECT set_config('app.is_global_admin', $1, false)",
      [String(isGlobalAdmin)]
    );

    return await fn(client);
  } finally {
    // 双重保险：显式 RESET + 释放连接
    await client.query("RESET app.tenant_id").catch(() => {});
    await client.query("RESET app.user_id").catch(() => {});
    await client.query("RESET app.is_global_admin").catch(() => {});
    client.release();
  }
}

/**
 * 提升权限上下文（用于公开端点如登录）
 * 设置 is_global_admin=true + user_id=system，绕过 RLS 限制
 * 不需要 tenantId，适用于登录前的查询
 */
export async function withElevatedContext<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await rlsPool.connect();
  try {
    await client.query(
      "SELECT set_config('app.user_id', $1, false)",
      ["system"]
    );
    await client.query(
      "SELECT set_config('app.is_global_admin', $1, false)",
      ["true"]
    );
    return await fn(client);
  } finally {
    await client.query("RESET app.user_id").catch(() => {});
    await client.query("RESET app.is_global_admin").catch(() => {});
    client.release();
  }
}

/**
 * 从 pg 查询结果中取第一行
 */
export function firstRow<T = Record<string, unknown>>(
  result: pg.QueryResult
): T | null {
  return (result.rows[0] as T) ?? null;
}

/**
 * 从 pg 查询结果中取所有行
 */
export function allRows<T = Record<string, unknown>>(
  result: pg.QueryResult
): T[] {
  return result.rows as T[];
}

/**
 * 从 count(*) 查询中取总数
 */
export function countValue(result: pg.QueryResult): number {
  return Number(result.rows[0]?.count ?? 0);
}
