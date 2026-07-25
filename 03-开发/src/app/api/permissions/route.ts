// ============================================================
// GET /api/permissions — 权限列表（区分框架权限和应用权限）
// 权限要求：已认证用户
// ============================================================

import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      // 获取框架权限（全局）+ 当前租户的应用权限
      const permissions = await db.permission.findMany({
        where: {
          OR: [
            { type: "framework", tenantId: null },
            { tenantId: payload.tenantId },
          ],
        },
        include: {
          app: { select: { id: true, name: true } },
        },
        orderBy: [{ type: "asc" }, { key: "asc" }],
      });

      // 分组返回
      const framework = permissions.filter((p) => p.type === "framework");
      const app = permissions.filter((p) => p.type === "app");

      return success({ framework, app, all: permissions });
    }
  );
}
