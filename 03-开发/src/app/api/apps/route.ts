// ============================================================
// GET  /api/apps — 应用列表
// POST /api/apps — 注册应用
// 权限要求：租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { parseBody, parseQuery, paginationSchema } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, paginated } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

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

async function requireTenantAdmin(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return { error: unauthorized() };
  const payload = await verifyToken(token);
  if (!payload) return { error: unauthorized("登录已过期") };
  if (!payload.isGlobalAdmin) return { error: forbidden("仅限管理员") };
  return { payload };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return unauthorized();
  const payload = await verifyToken(token);
  if (!payload) return unauthorized("登录已过期");

  const parsed = parseQuery(request, listQuerySchema);
  if (!parsed.success) return error(parsed.error);
  const { page, pageSize, search, type, status } = parsed.data;

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      const where = {
        tenantId: payload.tenantId,
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
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createAppSchema);
  if (!parsed.success) return error(parsed.error);

  return withTenantContext(
    auth.payload.tenantId,
    auth.payload.isGlobalAdmin,
    async () => {
      const { name, slug, type, description, icon, url, sortOrder } = parsed.data;

      // 检查 slug 唯一性（租户内）
      const existing = await db.app.findFirst({
        where: { slug, tenantId: auth.payload.tenantId },
      });
      if (existing) return error("该应用标识在当前租户中已存在");

      // 检查配额
      const tenant = await db.tenant.findUnique({
        where: { id: auth.payload.tenantId },
      });
      if (!tenant) return error("租户不存在");

      const appCount = await db.app.count({
        where: { tenantId: auth.payload.tenantId },
      });
      if (appCount >= tenant.quotaApps) {
        return error(`已达到应用数量上限 (${tenant.quotaApps})`);
      }

      const app = await db.app.create({
        data: {
          name,
          slug,
          type,
          description,
          icon,
          url,
          sortOrder,
          tenantId: auth.payload.tenantId,
        },
      });

      return created(app);
    }
  );
}
