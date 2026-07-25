// ============================================================
// PUT /api/tenants/:id/status
// 停用/启用租户
// 权限要求：全局管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, notFound, unauthorized } from "@/lib/api-response";

const updateStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限平台管理员");

  const parsed = await parseBody(request, updateStatusSchema);
  if (!parsed.success) return error(parsed.error);

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant || tenant.status === "deleted") return notFound("租户不存在");

  const updated = await db.tenant.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });

  return success(updated, `租户已${parsed.data.status === "active" ? "启用" : "停用"}`);
}
