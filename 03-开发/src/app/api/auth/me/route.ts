// ============================================================
// GET /api/auth/me
// 获取当前登录用户信息
// ============================================================

import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return unauthorized();
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return unauthorized("登录已过期，请重新登录");
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      tenant: true,
      department: true,
      grantedPermissions: {
        include: { permission: true },
      },
    },
  });

  if (!user) {
    return unauthorized("用户不存在");
  }

  return success({
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    isGlobalAdmin: user.isGlobalAdmin,
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
    },
    department: user.department
      ? { id: user.department.id, name: user.department.name }
      : null,
    permissions: user.grantedPermissions.map((up) => ({
      key: up.permission.key,
      label: up.permission.label,
      type: up.permission.type,
    })),
  });
}
