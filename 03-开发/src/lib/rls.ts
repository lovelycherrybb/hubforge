// HubForge - RLS 租户隔离工具
// 在每次数据库查询前注入 tenantId 到 PostgreSQL 会话变量

import { db } from "./prisma";

// 安全的标识符正则：只允许字母、数字、连字符
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * 设置当前请求的租户上下文
 * 注意：PostgreSQL SET 命令不支持参数化查询，需手动校验输入
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  if (!SAFE_ID_REGEX.test(tenantId)) {
    throw new Error(`Invalid tenantId format: ${tenantId}`);
  }
  await db.$executeRawUnsafe(`SET app.tenant_id = '${tenantId}'`);
}

/**
 * 设置当前用户的全局管理员状态
 */
export async function setAdminContext(isGlobalAdmin: boolean): Promise<void> {
  await db.$executeRawUnsafe(`SET app.is_global_admin = '${isGlobalAdmin}'`);
}

/**
 * 在租户上下文中执行数据库操作
 * 自动设置租户 ID，操作完成后重置
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
    await db.$executeRawUnsafe(`RESET app.tenant_id`);
    await db.$executeRawUnsafe(`RESET app.is_global_admin`);
  }
}
