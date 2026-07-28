// ============================================================
// GET    /api/tenants/:id   — 租户详情
// PUT    /api/tenants/:id   — 更新租户
// DELETE /api/tenants/:id   — 删除租户
// 权限要求：owner 角色（平台管理员）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, noContent, forbidden, notFound, unauthorized } from "@/lib/api-response";

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  maxUsers: z.number().int().min(1).optional(),
  maxApps: z.number().int().min(1).optional(),
  maxOrgLevels: z.number().int().min(1).optional(),
});

async function requireGlobalAdmin(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return { error: unauthorized() };
  if (payload.role !== "owner") return { error: forbidden("仅限平台管理员") };
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
      _count: { select: { users: true, tenantApps: true, departments: true } },
    },
  });

  if (!tenant) return notFound("租户不存在");
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
  if (!tenant) return notFound("租户不存在");

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
  if (!tenant) return notFound("租户不存在");

  // 硬删除租户（级联删除关联数据）
  await db.tenant.delete({ where: { id: params.id } });

  return noContent();
}
