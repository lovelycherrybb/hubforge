// GET  /api/tenants/[id]/apps — 获取租户已分配的应用
// POST /api/tenants/[id]/apps — 给租户分配/取消应用
// 权限要求：主租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, unauthorized, notFound } from "@/lib/api-response";

const assignAppSchema = z.object({
  appId: z.string(),
  enabled: z.boolean().default(true),
});

const unassignAppSchema = z.object({
  appId: z.string(),
});

// GET — 获取租户已分配的应用列表
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限主租户");

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return notFound("租户不存在");

  const tenantApps = await db.tenantApp.findMany({
    where: { tenantId: params.id },
    include: { app: true },
    orderBy: { app: { name: "asc" } },
  });

  return success(tenantApps);
}

// POST — 给租户分配应用
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限主租户");

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return notFound("租户不存在");

  const parsed = await parseBody(request, assignAppSchema);
  if (!parsed.success) return error(parsed.error);

  const { appId, enabled } = parsed.data;

  // 检查应用是否存在
  const app = await db.app.findUnique({ where: { id: appId } });
  if (!app) return notFound("应用不存在");

  // 检查是否已分配
  const existing = await db.tenantApp.findUnique({
    where: { tenantId_appId: { tenantId: params.id, appId } },
  });

  if (existing) {
    // 更新状态
    const updated = await db.tenantApp.update({
      where: { id: existing.id },
      data: { enabled },
    });
    return success(updated);
  }

  // 新增分配
  const tenantApp = await db.tenantApp.create({
    data: { tenantId: params.id, appId, enabled },
  });

  return success(tenantApp);
}

// DELETE — 取消租户的应用分配（通过 body 传 appId）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限主租户");

  const appId = request.nextUrl.searchParams.get("appId");
  if (!appId) return error("缺少 appId 参数");

  const existing = await db.tenantApp.findUnique({
    where: { tenantId_appId: { tenantId: params.id, appId } },
  });
  if (!existing) return notFound("未找到该租户的应用分配");

  await db.tenantApp.delete({ where: { id: existing.id } });

  return success({ message: "已取消分配" });
}
