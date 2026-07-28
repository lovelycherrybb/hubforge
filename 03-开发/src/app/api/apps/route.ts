// ============================================================
// GET  /api/apps — 应用列表（当前租户的应用）
// POST /api/apps — 注册应用
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
});

const listQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
});

// GET — 获取当前租户的应用列表
export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  const parsed = parseQuery(request, listQuerySchema);
  if (!parsed.success) return error(parsed.error);
  const { page, pageSize, search, type, status } = parsed.data;

  const isAdmin = payload.role === "owner" || payload.role === "admin";

  // 管理员可以看到所有状态的应用，普通成员只能看到活跃应用
  const where = {
    tenantId: payload.tenantId,
    ...(isAdmin && status ? { status } : {}),
    ...(!isAdmin ? { status: "active" } : {}),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(type && { type }),
  };

  const [apps, total] = await Promise.all([
    db.app.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    db.app.count({ where }),
  ]);

  return paginated(apps, total, page, pageSize);
}

// POST — 注册新应用（需要 admin 或 owner 角色）
export async function POST(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "admin" && payload.role !== "owner") {
    return forbidden("需要管理员权限");
  }

  const parsed = await parseBody(request, createAppSchema);
  if (!parsed.success) return error(parsed.error);

  const { name, slug, type, description, icon, url } = parsed.data;

  // 检查 slug 在当前租户下唯一
  const existing = await db.app.findFirst({
    where: { slug, tenantId: payload.tenantId },
  });
  if (existing) return error("该应用标识已存在");

  const app = await db.app.create({
    data: {
      name,
      slug,
      type,
      description,
      icon,
      url,
      tenantId: payload.tenantId,
      createdBy: payload.userId,
    },
  });

  // 自动创建框架级访问权限
  const permKey = `app.${slug}.access`;
  const existingPerm = await db.permission.findFirst({
    where: { key: permKey, type: "framework", tenantId: null },
  });
  if (!existingPerm) {
    await db.permission.create({
      data: {
        key: permKey,
        label: `访问 ${name}`,
        type: "framework",
        // tenantId 和 appId 均为 null → 全局框架权限
      },
    });
  }

  // 自动分配给当前租户
  await db.tenantApp.create({
    data: { tenantId: payload.tenantId, appId: app.id, enabled: true },
  });

  return created(app);
}
