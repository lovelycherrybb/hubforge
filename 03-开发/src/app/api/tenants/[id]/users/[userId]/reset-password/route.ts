// POST /api/tenants/[id]/users/[userId]/reset-password — 重置用户密码
// 权限要求：owner 角色（平台管理员）
// 默认密码：1234Aa78，可通过 body 自定义
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, unauthorized, notFound } from "@/lib/api-response";

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "密码至少8位")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[0-9]/, "密码必须包含数字")
    .optional()
    .default("1234Aa78"),
});

export async function POST(
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

  const parsed = await parseBody(request, resetPasswordSchema);
  if (!parsed.success) return error(parsed.error);

  const { password } = parsed.data;
  const passwordHash = await hash(password, 12);

  await db.userTenant.update({
    where: { id: userTenant.id },
    data: {
      passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
      status: "active",
      passwordUpdatedAt: new Date(),
    },
  });

  return success({ message: "密码已重置" });
}
