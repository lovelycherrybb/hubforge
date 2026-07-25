// ============================================================
// HubForge - RLS 租户隔离工具
// 在每次数据库查询前注入 tenantId 到 PostgreSQL 会话变量
// ============================================================

import { db } from "./prisma";

/**
 * 设置当前请求的租户上下文
 * 通过 Prisma 执行原生 SQL 设置 PostgreSQL 会话变量
 * RLS 策略会自动读取此变量进行数据隔离
 *
 * @param tenantId - 当前租户 ID
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  await db.$executeRawUnsafe('SET app.tenant_id = $1', tenantId);
}

/**
 * 设置当前用户的全局管理员状态
 * 全局管理员可以绕过 RLS 策略
 *
 * @param isGlobalAdmin - 是否为全局管理员
 */
export async function setAdminContext(isGlobalAdmin: boolean): Promise<void> {
  await db.$executeRawUnsafe('SET app.is_global_admin = $1', String(isGlobalAdmin));
}

/**
 * 在租户上下文中执行数据库操作
 * 自动设置租户 ID，操作完成后重置
 *
 * @param tenantId - 租户 ID
 * @param isGlobalAdmin - 是否为全局管理员
 * @param fn - 要执行的数据库操作
 * @returns 操作结果
 */
export async function withTenantContext<T>(
  tenantId: string,
  isGlobalAdmin: boolean,
  fn: () => Promise<T>
): Promise<T> {
  await setTenantContext(tenantId);
  await setAdminContext(isGlobalAdmin);
  try {
    return await fn();
  } finally {
    // 重置会话变量，防止连接复用时泄漏
    await db.$executeRawUnsafe(`RESET app.tenant_id`);
    await db.$executeRawUnsafe(`RESET app.is_global_admin`);
  }
}
