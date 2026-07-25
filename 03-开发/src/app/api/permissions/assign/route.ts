// ============================================================
// POST /api/permissions/assign — 分配权限（用户/部门）
// 权限要求：租户管理员
// 类型隔离：租户管理员不能分配框架权限
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

const assignPermissionSchema = z.object({
  permissionId: z.string().min(1),
  userId: z.string().optional(),
  departmentId: z.string().optional(),
  action: z.enum(["grant", "revoke"]),
}).refine(
  (data) => data.userId || data.departmentId,
  { message: "必须指定 userId 或 departmentId" }
);

export async function POST(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限管理员");

  const parsed = await parseBody(request, assignPermissionSchema);
  if (!parsed.success) return error(parsed.error);

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      const { permissionId, userId, departmentId, action } = parsed.data;

      // 验证权限存在
      const permission = await db.permission.findFirst({
        where: {
          id: permissionId,
          OR: [
            { type: "framework", tenantId: null },
            { tenantId: payload.tenantId },
          ],
        },
      });
      if (!permission) return error("权限不存在");

      // 类型隔离：非平台管理员不能操作框架权限
      if (permission.type === "framework" && !payload.isGlobalAdmin) {
        return forbidden("租户管理员不能分配框架权限");
      }

      if (action === "grant") {
        if (userId) {
          // 分配权限给用户
          await db.userPermission.upsert({
            where: {
              userId_permissionId: { userId, permissionId },
            },
            create: {
              userId,
              permissionId,
              grantedBy: payload.userId,
            },
            update: {}, // 已存在则跳过
          });
          return success(null, "权限已授予用户");
        }

        if (departmentId) {
          // 分配权限给部门
          await db.departmentPermission.upsert({
            where: {
              departmentId_permissionId: { departmentId, permissionId },
            },
            create: {
              departmentId,
              permissionId,
              grantedBy: payload.userId,
            },
            update: {},
          });
          return success(null, "权限已授予部门");
        }
      }

      if (action === "revoke") {
        if (userId) {
          await db.userPermission.deleteMany({
            where: { userId, permissionId },
          });
          return success(null, "已撤销用户权限");
        }

        if (departmentId) {
          await db.departmentPermission.deleteMany({
            where: { departmentId, permissionId },
          });
          return success(null, "已撤销部门权限");
        }
      }

      return error("未知操作");
    }
  );
}
