// ============================================================
// GET /api/permissions — 权限列表（区分框架权限和应用权限）
// 权限要求：已认证用户
// 返回数据包含 tenantGrants（哪些租户被授予了框架权限）
// ============================================================

import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  const isGlobalAdmin = payload.role === "owner" || payload.role === "admin";

  return withTenantContext(
    payload.tenantId,
    isGlobalAdmin,
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
          tenantGrants: {
            select: {
              id: true,
              tenantId: true,
              grantedAt: true,
              tenant: { select: { id: true, name: true, slug: true } },
            },
          },
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
