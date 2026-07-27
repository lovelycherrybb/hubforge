// GET  /api/apps — 应用列表（当前租户已分配的应用）
// POST /api/apps — 注册应用（仅主租户）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody, parseQuery, paginationSchema } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, paginated } from "@/lib/api-response";

const createAppSchema = z.object({
  name: z.string().min(1, "应用名称不能为空").max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "slug 只能包含小写字母、数字和连字符"),
  type: z.enum(["pc", "h5", "both"]).default("pc"),
  description: z.string().max(500).optional(),
  icon: z.string().url().optional(),
  url: z.string().url("应用 URL 格式不正确"),
  sortOrder: z.number().int().default(0),
});

const listQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
});

// GET — 获取当前租户已分配的应用列表
export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  const parsed = parseQuery(request, listQuerySchema);
  if (!parsed.success) return error(parsed.error);
  const { page, pageSize, search, type, status } = parsed.data;

  // 主租户看所有应用，普通租户只看已分配的应用
  if (payload.isGlobalAdmin) {
    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(type && { type }),
      ...(status && { status }),
    };

    const [apps, total] = await Promise.all([
      db.app.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      db.app.count({ where }),
    ]);

    return paginated(apps, total, page, pageSize);
  }

  // 普通租户：只返回已分配且启用的应用
  const where = {
    tenantId: payload.tenantId,
    enabled: true,
    app: {
      status: "active",
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(type && { type }),
    },
  };

  const [tenantApps, total] = await Promise.all([
    db.tenantApp.findMany({
      where,
      include: { app: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { app: { sortOrder: "asc" } },
    }),
    db.tenantApp.count({ where }),
  ]);

  const apps = tenantApps.map((ta) => ta.app);
  return paginated(apps, total, page, pageSize);
}

// POST — 注册新应用（仅主租户）
export async function POST(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限主租户创建应用");

  const parsed = await parseBody(request, createAppSchema);
  if (!parsed.success) return error(parsed.error);

  const { name, slug, type, description, icon, url, sortOrder } = parsed.data;

  // 检查 slug 全局唯一
  const existing = await db.app.findFirst({ where: { slug } });
  if (existing) return error("该应用标识已存在");

  const app = await db.app.create({
    data: { name, slug, type, description, icon, url, sortOrder },
  });

  // 自动分配给主租户
  await db.tenantApp.create({
    data: { tenantId: payload.tenantId, appId: app.id, enabled: true },
  });

  return created(app);
}
