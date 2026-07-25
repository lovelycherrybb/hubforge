// ============================================================
// GET    /api/tenants/:id   — 租户详情
// PUT    /api/tenants/:id   — 更新租户
// DELETE /api/tenants/:id   — 软删除租户
// 权限要求：全局管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, noContent, forbidden, notFound, unauthorized } from "@/lib/api-response";

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  quotaUsers: z.number().int().min(1).optional(),
  quotaApps: z.number().int().min(1).optional(),
  quotaOrgLevels: z.number().int().min(1).optional(),
});

async function requireGlobalAdmin(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return { error: unauthorized() };
  if (!payload.isGlobalAdmin) return { error: forbidden("仅限平台管理员") };
  return { payload };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return auth.error;

  const tenant = await db.tenant.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { users: true, apps: true, departments: true } },
      configs: true,
    },
  });

  if (!tenant || tenant.status === "deleted") return notFound("租户不存在");
  return success(tenant);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, updateTenantSchema);
  if (!parsed.success) return error(parsed.error);

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant || tenant.status === "deleted") return notFound("租户不存在");

  const updated = await db.tenant.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return success(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return auth.error;

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant || tenant.status === "deleted") return notFound("租户不存在");

  // 软删除：标记为 deleted
  await db.tenant.update({
    where: { id: params.id },
    data: { status: "deleted" },
  });

  return noContent();
}
