// ============================================================
// GET /api/permissions/check — 检查当前用户权限
// 权限要求：已认证用户
// 检查逻辑：个人权限 ∪ 组织权限
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

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      const { key } = parsed.data;

      // 全局管理员拥有所有权限
      if (payload.isGlobalAdmin) {
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

      // 检查用户直接权限
      const userPerm = await db.userPermission.findFirst({
        where: {
          userId: payload.userId,
          permissionId: permission.id,
        },
      });

      if (userPerm) {
        return success({ hasPermission: true, key, source: "user" });
      }

      // 检查用户所在部门的权限
      const user = await db.user.findUnique({
        where: { id: payload.userId },
        select: { departmentId: true },
      });

      if (user?.departmentId) {
        const deptPerm = await db.departmentPermission.findFirst({
          where: {
            departmentId: user.departmentId,
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
