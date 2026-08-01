// ============================================================
// POST /api/permissions/assign — 分配权限（用户/部门/租户框架权限）
// 权限要求：租户管理员（owner 或 admin）
// 类型隔离：租户管理员不能分配框架权限
// 框架权限可通过 tenantId 参数授予给租户
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, unauthorized } from "@/lib/api-response";
import { withTenantContext, firstRow } from "@/lib/rls-pg";

const assignPermissionSchema = z.object({
  permissionId: z.string().min(1),
  userId: z.string().optional(),
  departmentId: z.string().optional(),
  tenantId: z.string().optional(), // 目标租户 ID（框架权限授予租户）
  action: z.enum(["grant", "revoke"]),
}).refine(
  (data) => data.userId || data.departmentId || data.tenantId,
  { message: "必须指定 userId、departmentId 或 tenantId" }
);

export async function POST(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "owner" && payload.role !== "admin")
    return forbidden("仅限管理员");

  const parsed = await parseBody(request, assignPermissionSchema);
  if (!parsed.success) return error(parsed.error);

  const isGlobalAdmin = payload.role === "owner";

  return withTenantContext(
    { tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin },
    async (client) => {
      const { permissionId, userId, departmentId, tenantId, action } = parsed.data;

      // 验证权限存在
      const permResult = await client.query(
        `SELECT * FROM permissions
         WHERE id = $1 AND (
           (type = 'framework' AND "tenantId" IS NULL)
           OR "tenantId" = $2
         )
         LIMIT 1`,
        [permissionId, payload.tenantId]
      );
      const permission = firstRow(permResult);
      if (!permission) return error("权限不存在");

      // 类型隔离：非 owner 不能操作框架权限
      if ((permission as any).type === "framework" && payload.role !== "owner") {
        return forbidden("租户管理员不能分配框架权限");
      }

      // ============================================================
      // 框架权限授予/撤销租户（TenantPermission）
      // ============================================================
      if (tenantId && (permission as any).type === "framework") {
        if (action === "grant") {
          await client.query(
            `INSERT INTO tenant_permissions ("tenantId", "permissionId", "grantedBy")
             VALUES ($1, $2, $3)
             ON CONFLICT ("tenantId", "permissionId") DO NOTHING`,
            [tenantId, permissionId, payload.userId]
          );
          return success(null, "框架权限已授予租户");
        }

        if (action === "revoke") {
          await client.query(
            `DELETE FROM tenant_permissions WHERE "tenantId" = $1 AND "permissionId" = $2`,
            [tenantId, permissionId]
          );
          return success(null, "已撤销租户框架权限");
        }
      }

      if (action === "grant") {
        if (userId) {
          // 分配权限给用户（含 tenantId 三元唯一约束）
          await client.query(
            `INSERT INTO user_permissions ("userId", "tenantId", "permissionId", "grantedBy")
             VALUES ($1, $2, $3, $4)
             ON CONFLICT ("userId", "tenantId", "permissionId") DO NOTHING`,
            [userId, payload.tenantId, permissionId, payload.userId]
          );
          return success(null, "权限已授予用户");
        }

        if (departmentId) {
          // 分配权限给部门
          await client.query(
            `INSERT INTO department_permissions ("departmentId", "permissionId", "grantedBy")
             VALUES ($1, $2, $3)
             ON CONFLICT ("departmentId", "permissionId") DO NOTHING`,
            [departmentId, permissionId, payload.userId]
          );
          return success(null, "权限已授予部门");
        }
      }

      if (action === "revoke") {
        if (userId) {
          await client.query(
            `DELETE FROM user_permissions WHERE "userId" = $1 AND "permissionId" = $2 AND "tenantId" = $3`,
            [userId, permissionId, payload.tenantId]
          );
          return success(null, "已撤销用户权限");
        }

        if (departmentId) {
          await client.query(
            `DELETE FROM department_permissions WHERE "departmentId" = $1 AND "permissionId" = $2`,
            [departmentId, permissionId]
          );
          return success(null, "已撤销部门权限");
        }
      }

      return error("未知操作");
    }
  );
}
