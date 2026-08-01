// HubForge - RLS 租户隔离工具
// 在每次数据库查询前注入租户/用户上下文到 PostgreSQL 会话变量

import { db } from "./prisma";

// 安全的标识符正则：只允许字母、数字、连字符
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/** 设置当前请求的租户上下文 */
export async function setTenantContext(tenantId: string): Promise<void> {
  if (!SAFE_ID_REGEX.test(tenantId)) {
    throw new Error(`Invalid tenantId format: ${tenantId}`);
  }
  await db.$executeRawUnsafe(`SET app.tenant_id = '${tenantId}'`);
}

/** 设置当前用户 ID（供 RLS current_user_id() 使用） */
export async function setUserContext(userId: string): Promise<void> {
  if (!SAFE_ID_REGEX.test(userId)) {
    throw new Error(`Invalid userId format: ${userId}`);
  }
  await db.$executeRawUnsafe(`SET app.user_id = '${userId}'`);
}

/** 设置当前用户是否为全局管理员（仅 owner 角色） */
export async function setAdminContext(isGlobalAdmin: boolean): Promise<void> {
  await db.$executeRawUnsafe(`SET app.is_global_admin = '${isGlobalAdmin}'`);
}

/**
 * 在租户上下文中执行数据库操作
 * 自动设置租户 ID、用户 ID、管理员状态，操作完成后重置
 */
export async function withTenantContext<T>(
  tenantId: string,
  userId: string,
  isGlobalAdmin: boolean,
  fn: () => Promise<T>
): Promise<T> {
  await setTenantContext(tenantId);
  await setUserContext(userId);
  await setAdminContext(isGlobalAdmin);
  try {
    return await fn();
  } finally {
    await db.$executeRawUnsafe(`RESET app.tenant_id`);
    await db.$executeRawUnsafe(`RESET app.user_id`);
    await db.$executeRawUnsafe(`RESET app.is_global_admin`);
  }
}
