// ============================================================
// GET /api/permissions — 权限列表
// 权限要求：已认证用户
// ============================================================

import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return unauthorized();
  const payload = await verifyToken(token);
  if (!payload) return unauthorized("登录已过期");

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

      return success(permissions);
    }
  );
}
