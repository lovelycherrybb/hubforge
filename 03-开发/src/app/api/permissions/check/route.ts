// ============================================================
// GET /api/permissions/check — 检查当前用户权限
// 权限要求：已认证用户
// 检查逻辑：
//   - 框架权限：先查 TenantPermission（租户是否被授予），再查用户/部门权限
//   - 应用权限：查用户/部门权限
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { success, error, unauthorized } from "@/lib/api-response";
import { parseQuery } from "@/lib/validate";
import { withTenantContext, firstRow } from "@/lib/rls-pg";

const checkQuerySchema = z.object({
  key: z.string().min(1, "权限标识不能为空"),
});

export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  const parsed = parseQuery(request, checkQuerySchema);
  if (!parsed.success) return error(parsed.error);

  const isGlobalAdmin = payload.role === "owner";

  return withTenantContext(
    { tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin },
    async (client) => {
      const { key } = parsed.data;

      // owner/admin 拥有所有权限
      if (isGlobalAdmin) {
        return success({ hasPermission: true, key, source: "admin" });
      }

      // 查找权限定义
      const permResult = await client.query(
        `SELECT * FROM permissions
         WHERE key = $1 AND (
           (type = 'framework' AND "tenantId" IS NULL)
           OR "tenantId" = $2
         )
         LIMIT 1`,
        [key, payload.tenantId]
      );
      const permission = firstRow(permResult);

      if (!permission) {
        return success({ hasPermission: false, key });
      }

      // ============================================================
      // 框架权限：先检查租户是否被授予（TenantPermission）
      // ============================================================
      if ((permission as any).type === "framework") {
        const tgResult = await client.query(
          `SELECT id FROM tenant_permissions
           WHERE "tenantId" = $1 AND "permissionId" = $2
           LIMIT 1`,
          [payload.tenantId, (permission as any).id]
        );
        const tenantGrant = firstRow(tgResult);

        if (!tenantGrant) {
          // 租户未被授予该框架权限，直接拒绝
          return success({ hasPermission: false, key });
        }
      }

      // 检查用户直接权限
      const upResult = await client.query(
        `SELECT id FROM user_permissions
         WHERE "userId" = $1 AND "tenantId" = $2 AND "permissionId" = $3
         LIMIT 1`,
        [payload.userId, payload.tenantId, (permission as any).id]
      );
      const userPerm = firstRow(upResult);

      if (userPerm) {
        return success({ hasPermission: true, key, source: "user" });
      }

      // 检查用户所在部门及祖先部门的权限（并集）
      const userOrgResult = await client.query(
        `SELECT "organizationId" FROM user_organizations WHERE "userId" = $1 LIMIT 1`,
        [payload.userId]
      );
      const userOrg = firstRow(userOrgResult);

      if (userOrg) {
        // 收集当前部门及所有祖先部门 ID
        const deptIds: string[] = [];
        let deptId: string | null = (userOrg as any).organizationId;
        while (deptId) {
          deptIds.push(deptId);
          const deptResult = await client.query(
            `SELECT "parentId" FROM departments WHERE id = $1`,
            [deptId]
          );
          const dept = firstRow<{ parentId: string | null }>(deptResult);
          deptId = dept?.parentId ?? null;
        }

        const dpResult = await client.query(
          `SELECT id FROM department_permissions
           WHERE "departmentId" = ANY($1) AND "permissionId" = $2
           LIMIT 1`,
          [deptIds, (permission as any).id]
        );
        const deptPerm = firstRow(dpResult);

        if (deptPerm) {
          return success({ hasPermission: true, key, source: "department" });
        }
      }

      return success({ hasPermission: false, key });
    }
  );
}
