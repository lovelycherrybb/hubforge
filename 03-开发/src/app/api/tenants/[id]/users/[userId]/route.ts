// PUT /api/tenants/[id]/users/[userId] — 更新用户（设置/取消管理员）
// 权限要求：主租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, unauthorized, notFound } from "@/lib/api-response";

const updateUserSchema = z.object({
  isGlobalAdmin: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
  status: z.enum(["active", "locked"]).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限主租户");

  const user = await db.user.findFirst({
    where: { id: params.userId, tenantId: params.id },
  });
  if (!user) return notFound("用户不存在");

  const parsed = await parseBody(request, updateUserSchema);
  if (!parsed.success) return error(parsed.error);

  const updated = await db.user.update({
    where: { id: params.userId },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      isGlobalAdmin: true,
      department: { select: { id: true, name: true } },
    },
  });

  return success(updated);
}
