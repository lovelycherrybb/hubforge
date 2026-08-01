// ============================================================
// GET /api/auth/me
// 获取当前登录用户信息（含权限列表）
// ============================================================

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { withTenantContext, firstRow, allRows } from "@/lib/rls-pg";
import { success, unauthorized } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) {
    return unauthorized();
  }

  return withTenantContext({ tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin: payload.role === "owner" }, async (client) => {
    // 获取用户基本信息
    const user = firstRow<{ id: string; email: string; name: string; avatarUrl: string | null }>(
      await client.query(
        'SELECT id, email, name, "avatarUrl" FROM users WHERE id = $1',
        [payload.userId]
      )
    );

    if (!user) {
      return unauthorized("用户不存在");
    }

    // 获取当前租户信息
    const tenant = firstRow<{ id: string; name: string; slug: string; logoUrl: string | null }>(
      await client.query(
        'SELECT id, name, slug, "logoUrl" FROM tenants WHERE id = $1',
        [payload.tenantId]
      )
    );

    if (!tenant) {
      return unauthorized("租户不存在");
    }

    // 获取用户在当前租户下的角色
    const userTenant = firstRow<{ role: string; status: string }>(
      await client.query(
        'SELECT role, status FROM user_tenants WHERE "userId" = $1 AND "tenantId" = $2',
        [payload.userId, payload.tenantId]
      )
    );

    // 获取用户在当前租户下的权限（JOIN permissions 表）
    const permissionsResult = await client.query(
      `SELECT p.key, p.label, p.type
       FROM user_permissions up
       INNER JOIN permissions p ON p.id = up."permissionId"
       WHERE up."userId" = $1 AND up."tenantId" = $2`,
      [payload.userId, payload.tenantId]
    );

    // 获取部门权限（如果用户属于某个部门）
    const userOrg = firstRow<{ organizationId: string }>(
      await client.query(
        'SELECT "organizationId" FROM user_organizations WHERE "userId" = $1 LIMIT 1',
        [payload.userId]
      )
    );

    let departmentPermissions: { key: string; label: string; type: string }[] = [];
    if (userOrg) {
      const deptPermsResult = await client.query(
        `SELECT p.key, p.label, p.type
         FROM department_permissions dp
         INNER JOIN permissions p ON p.id = dp."permissionId"
         WHERE dp."departmentId" = $1`,
        [userOrg.organizationId]
      );
      departmentPermissions = allRows<{ key: string; label: string; type: string }>(deptPermsResult);
    }

    // 合并个人权限 + 部门权限（取并集）
    const personalPermissions = allRows<{ key: string; label: string; type: string }>(permissionsResult);

    const permMap = new Map<string, { key: string; label: string; type: string }>();
    for (const p of [...personalPermissions, ...departmentPermissions]) {
      permMap.set(p.key, p);
    }

    return success({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      tenant,
      role: userTenant?.role || "member",
      status: userTenant?.status || "active",
      permissions: Array.from(permMap.values()),
    });
  });
}
