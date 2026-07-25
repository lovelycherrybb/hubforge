// ============================================================
// GET    /api/apps/:id — 应用详情
// PUT    /api/apps/:id — 更新应用
// DELETE /api/apps/:id — 删除应用
// 权限要求：租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, noContent, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

const updateAppSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["pc", "h5", "both"]).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().url().optional(),
  url: z.string().url().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  sortOrder: z.number().int().optional(),
});

async function requireTenantAdmin(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return { error: unauthorized() };
  if (!payload.isGlobalAdmin) return { error: forbidden("仅限管理员") };
  return { payload };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      const app = await db.app.findFirst({
        where: { id: params.id, tenantId: payload.tenantId },
        include: { configs: true },
      });
      if (!app) return notFound("应用不存在");
      return success(app);
    }
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenantAdmin(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, updateAppSchema);
  if (!parsed.success) return error(parsed.error);

  return withTenantContext(
    auth.payload.tenantId,
    auth.payload.isGlobalAdmin,
    async () => {
      const app = await db.app.findFirst({
        where: { id: params.id, tenantId: auth.payload.tenantId },
      });
      if (!app) return notFound("应用不存在");

      const updated = await db.app.update({
        where: { id: params.id },
        data: parsed.data,
      });

      return success(updated);
    }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenantAdmin(request);
  if (auth.error) return auth.error;

  return withTenantContext(
    auth.payload.tenantId,
    auth.payload.isGlobalAdmin,
    async () => {
      const app = await db.app.findFirst({
        where: { id: params.id, tenantId: auth.payload.tenantId },
      });
      if (!app) return notFound("应用不存在");

      await db.app.delete({ where: { id: params.id } });
      return noContent();
    }
  );
}
