// ============================================================
// GET /api/tenants      — 租户列表
// POST /api/tenants     — 创建租户
// 权限要求：全局管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { parseBody, parseQuery, paginationSchema } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, paginated } from "@/lib/api-response";

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  quotaUsers: z.number().int().min(1).default(100),
  quotaApps: z.number().int().min(1).default(50),
  quotaOrgLevels: z.number().int().min(1).default(5),
});

/** 验证全局管理员身份 */
async function requireGlobalAdmin(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return { error: unauthorized() };
  const payload = await verifyToken(token);
  if (!payload) return { error: unauthorized("登录已过期") };
  if (!payload.isGlobalAdmin) return { error: forbidden("仅限平台管理员") };
  return { payload };
}

export async function GET(request: NextRequest) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return auth.error;

  const parsed = parseQuery(request, paginationSchema);
  if (!parsed.success) return error(parsed.error);
  const { page, pageSize } = parsed.data;

  const [tenants, total] = await Promise.all([
    db.tenant.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, apps: true } } },
    }),
    db.tenant.count(),
  ]);

  return paginated(tenants, total, page, pageSize);
}

export async function POST(request: NextRequest) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createTenantSchema);
  if (!parsed.success) return error(parsed.error);

  const { name, slug, quotaUsers, quotaApps, quotaOrgLevels } = parsed.data;

  // 检查 slug 唯一性
  const existing = await db.tenant.findUnique({ where: { slug } });
  if (existing) return error("该租户标识已被占用");

  const tenant = await db.tenant.create({
    data: { name, slug, quotaUsers, quotaApps, quotaOrgLevels },
  });

  return created(tenant);
}
