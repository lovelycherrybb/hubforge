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

  // 获取用户基本信息
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    return unauthorized("用户不存在");
  }

  // 获取当前租户信息
  const tenant = await db.tenant.findUnique({
    where: { id: payload.tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
    },
  });

  if (!tenant) {
    return unauthorized("租户不存在");
  }

  // 获取用户在当前租户下的角色
  const userTenant = await db.userTenant.findUnique({
    where: {
      userId_tenantId: {
        userId: payload.userId,
        tenantId: payload.tenantId,
      },
    },
    select: {
      role: true,
      status: true,
    },
  });

  // 获取用户在当前租户下的权限
  const permissions = await db.userPermission.findMany({
    where: {
      userId: payload.userId,
      tenantId: payload.tenantId,
    },
    include: {
      permission: {
        select: {
          key: true,
          label: true,
          type: true,
        },
      },
    },
  });

  // 获取部门权限（如果用户属于某个部门）
  const userOrg = await db.userOrganization.findFirst({
    where: { userId: payload.userId },
    select: { organizationId: true },
  });

  let departmentPermissions: { key: string; label: string; type: string }[] =
    [];
  if (userOrg) {
    const deptPerms = await db.departmentPermission.findMany({
      where: { departmentId: userOrg.organizationId },
      include: {
        permission: {
          select: {
            key: true,
            label: true,
            type: true,
          },
        },
      },
    });
    departmentPermissions = deptPerms.map((dp) => ({
      key: dp.permission.key,
      label: dp.permission.label,
      type: dp.permission.type,
    }));
  }

  // 合并个人权限 + 部门权限（取并集）
  const personalPermissions = permissions.map((up) => ({
    key: up.permission.key,
    label: up.permission.label,
    type: up.permission.type,
  }));

  const permMap = new Map<string, { key: string; label: string; type: string }>();
  for (const p of [...personalPermissions, ...departmentPermissions]) {
    permMap.set(p.key, p);
  }

  return success({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    tenant,
    role: userTenant?.role || "member",
    status: userTenant?.status || "active",
    permissions: Array.from(permMap.values()),
  });
}
