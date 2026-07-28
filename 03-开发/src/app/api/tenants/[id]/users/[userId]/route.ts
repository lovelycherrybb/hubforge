// PUT /api/tenants/[id]/users/[userId] — 更新用户（设置/取消管理员）
// 权限要求：owner 角色（平台管理员）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, unauthorized, notFound } from "@/lib/api-response";

const updateUserSchema = z.object({
  role: z.enum(["admin", "member"]).optional(),
  name: z.string().min(1).max(100).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "owner") return forbidden("仅限平台管理员");

  // 查找用户在该租户的 UserTenant 记录
  const userTenant = await db.userTenant.findUnique({
    where: {
      userId_tenantId: { userId: params.userId, tenantId: params.id },
    },
  });
  if (!userTenant) return notFound("用户不存在");

  const parsed = await parseBody(request, updateUserSchema);
  if (!parsed.success) return error(parsed.error);

  const { role, name, status } = parsed.data;

  // 更新 UserTenant（角色、状态）
  const userTenantData: Record<string, unknown> = {};
  if (role) userTenantData.role = role;
  if (status) userTenantData.status = status;

  if (Object.keys(userTenantData).length > 0) {
    await db.userTenant.update({
      where: { id: userTenant.id },
      data: userTenantData,
    });
  }

  // 更新 User 全局信息（姓名）
  if (name) {
    await db.user.update({
      where: { id: params.userId },
      data: { name },
    });
  }

  // 返回更新后的信息
  const updatedUser = await db.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, name: true },
  });

  const updatedUserTenant = await db.userTenant.findUnique({
    where: { id: userTenant.id },
    select: { role: true, status: true },
  });

  return success({
    ...updatedUser,
    role: updatedUserTenant?.role,
    status: updatedUserTenant?.status,
  });
}
