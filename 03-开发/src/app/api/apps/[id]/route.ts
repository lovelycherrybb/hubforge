// GET    /api/apps/:id — 应用详情
// PUT    /api/apps/:id — 更新应用（仅主租户）
// DELETE /api/apps/:id — 删除应用（仅主租户）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, noContent, forbidden, notFound, unauthorized } from "@/lib/api-response";

const updateAppSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["pc", "h5", "both"]).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().url().optional(),
  url: z.string().url().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  const app = await db.app.findUnique({
    where: { id: params.id },
    include: { configs: true },
  });
  if (!app) return notFound("应用不存在");

  return success(app);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限主租户");

  const parsed = await parseBody(request, updateAppSchema);
  if (!parsed.success) return error(parsed.error);

  const app = await db.app.findUnique({ where: { id: params.id } });
  if (!app) return notFound("应用不存在");

  const updated = await db.app.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return success(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限主租户");

  const app = await db.app.findUnique({ where: { id: params.id } });
  if (!app) return notFound("应用不存在");

  await db.app.delete({ where: { id: params.id } });
  return noContent();
}
