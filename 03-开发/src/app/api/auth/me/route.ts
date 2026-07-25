// ============================================================
// GET /api/auth/me
// 获取当前登录用户信息（含权限列表）
// ============================================================

import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) {
    return unauthorized();
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

  // 合并个人权限 + 部门权限
  const personalPermissions = user.grantedPermissions.map((up) => ({
    key: up.permission.key,
    label: up.permission.label,
    type: up.permission.type,
  }));

  let departmentPermissions: { key: string; label: string; type: string }[] = [];
  if (user.departmentId) {
    const deptPerms = await db.departmentPermission.findMany({
      where: { departmentId: user.departmentId },
      include: { permission: true },
    });
    departmentPermissions = deptPerms.map((dp) => ({
      key: dp.permission.key,
      label: dp.permission.label,
      type: dp.permission.type,
    }));
  }

  // 去重合并（个人权限 ∪ 部门权限）
  const permMap = new Map<string, { key: string; label: string; type: string }>();
  for (const p of [...personalPermissions, ...departmentPermissions]) {
    permMap.set(p.key, p);
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
    permissions: Array.from(permMap.values()),
  });
}
