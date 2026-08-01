// ============================================================
// GET /api/permissions — 权限列表（区分框架权限和应用权限）
// 权限要求：已认证用户
// 返回数据包含 tenantGrants（哪些租户被授予了框架权限）
// ============================================================

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";
import { withTenantContext, allRows } from "@/lib/rls-pg";

export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  const isGlobalAdmin = payload.role === "owner";

  return withTenantContext(
    { tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin },
    async (client) => {
      // 获取当前租户的应用权限
      const appPermissionsResult = await client.query(
        `SELECT p.*,
                json_agg(DISTINCT jsonb_build_object(
                  'id', tp2.id, 'tenantId', tp2."tenantId", 'grantedAt', tp2."grantedAt",
                  'tenant', jsonb_build_object('id', t2.id, 'name', t2.name, 'slug', t2.slug)
                )) FILTER (WHERE tp2.id IS NOT NULL) AS "tenantGrants"
         FROM permissions p
         LEFT JOIN tenant_permissions tp2 ON tp2."permissionId" = p.id
         LEFT JOIN tenants t2 ON t2.id = tp2."tenantId"
         WHERE p."tenantId" = $1
         GROUP BY p.id
         ORDER BY p.key ASC`,
        [payload.tenantId]
      );
      const appPermissions = allRows(appPermissionsResult);

      // 框架权限：owner 看全部，非 owner 只看当前租户已授予的
      let frameworkPermissions;
      if (payload.role === "owner") {
        const fpResult = await client.query(
          `SELECT p.*,
                  json_agg(DISTINCT jsonb_build_object(
                    'id', tp2.id, 'tenantId', tp2."tenantId", 'grantedAt', tp2."grantedAt",
                    'tenant', jsonb_build_object('id', t2.id, 'name', t2.name, 'slug', t2.slug)
                  )) FILTER (WHERE tp2.id IS NOT NULL) AS "tenantGrants"
           FROM permissions p
           LEFT JOIN tenant_permissions tp2 ON tp2."permissionId" = p.id
           LEFT JOIN tenants t2 ON t2.id = tp2."tenantId"
           WHERE p.type = 'framework' AND p."tenantId" IS NULL
           GROUP BY p.id
           ORDER BY p.key ASC`
        );
        frameworkPermissions = allRows(fpResult);
      } else {
        const grantsResult = await client.query(
          `SELECT p.*,
                  json_agg(DISTINCT jsonb_build_object(
                    'id', tp2.id, 'tenantId', tp2."tenantId", 'grantedAt', tp2."grantedAt",
                    'tenant', jsonb_build_object('id', t2.id, 'name', t2.name, 'slug', t2.slug)
                  )) FILTER (WHERE tp2.id IS NOT NULL) AS "tenantGrants"
           FROM tenant_permissions tp
           INNER JOIN permissions p ON p.id = tp."permissionId"
           LEFT JOIN tenant_permissions tp2 ON tp2."permissionId" = p.id
           LEFT JOIN tenants t2 ON t2.id = tp2."tenantId"
           WHERE tp."tenantId" = $1
           GROUP BY p.id
           ORDER BY p.key ASC`,
          [payload.tenantId]
        );
        frameworkPermissions = allRows(grantsResult);
      }

      const permissions = [...frameworkPermissions, ...appPermissions];

      // 分组返回
      const framework = permissions.filter((p: any) => p.type === "framework");
      const app = permissions.filter((p: any) => p.type === "app");

      return success({ framework, app, all: permissions });
    }
  );
}
