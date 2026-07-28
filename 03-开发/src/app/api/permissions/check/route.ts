// ============================================================
// GET /api/permissions/check — 检查当前用户权限
// 权限要求：已认证用户
// 检查逻辑：
//   - 框架权限：先查 TenantPermission（租户是否被授予），再查用户/部门权限
//   - 应用权限：查用户/部门权限
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { success, error, unauthorized } from "@/lib/api-response";
import { parseQuery } from "@/lib/validate";
import { withTenantContext } from "@/lib/rls";

const checkQuerySchema = z.object({
  key: z.string().min(1, "权限标识不能为空"),
});

export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  const parsed = parseQuery(request, checkQuerySchema);
  if (!parsed.success) return error(parsed.error);

  const isGlobalAdmin = payload.role === "owner" || payload.role === "admin";

  return withTenantContext(
    payload.tenantId,
    isGlobalAdmin,
    async () => {
      const { key } = parsed.data;

      // owner/admin 拥有所有权限
      if (isGlobalAdmin) {
        return success({ hasPermission: true, key, source: "admin" });
      }

      // 查找权限定义
      const permission = await db.permission.findFirst({
        where: {
          key,
          OR: [
            { type: "framework", tenantId: null },
            { tenantId: payload.tenantId },
          ],
        },
      });

      if (!permission) {
        return success({ hasPermission: false, key });
      }

      // ============================================================
      // 框架权限：先检查租户是否被授予（TenantPermission）
      // ============================================================
      if (permission.type === "framework") {
        const tenantGrant = await db.tenantPermission.findFirst({
          where: {
            tenantId: payload.tenantId,
            permissionId: permission.id,
          },
        });

        if (!tenantGrant) {
          // 租户未被授予该框架权限，直接拒绝
          return success({ hasPermission: false, key });
        }
      }

      // 检查用户直接权限
      const userPerm = await db.userPermission.findFirst({
        where: {
          userId: payload.userId,
          tenantId: payload.tenantId,
          permissionId: permission.id,
        },
      });

      if (userPerm) {
        return success({ hasPermission: true, key, source: "user" });
      }

      // 检查用户所在部门及祖先部门的权限（并集）
      const userOrg = await db.userOrganization.findFirst({
        where: { userId: payload.userId },
        select: { organizationId: true },
      });

      if (userOrg) {
        // 收集当前部门及所有祖先部门 ID
        const deptIds: string[] = [];
        let deptId: string | null = userOrg.organizationId;
        while (deptId) {
          deptIds.push(deptId);
          const result: { parentId: string | null } | null = await db.department.findUnique({
            where: { id: deptId },
            select: { parentId: true },
          });
          deptId = result?.parentId ?? null;
        }

        const deptPerm = await db.departmentPermission.findFirst({
          where: {
            departmentId: { in: deptIds },
            permissionId: permission.id,
          },
        });

        if (deptPerm) {
          return success({ hasPermission: true, key, source: "department" });
        }
      }

      return success({ hasPermission: false, key });
    }
  );
}
