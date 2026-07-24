// ============================================================
// GET  /api/users  — 用户列表（租户内）
// POST /api/users  — 创建用户
// 权限要求：当前租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { parseBody, parseQuery, paginationSchema } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, paginated } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(50),
  departmentId: z.string().optional(),
  isGlobalAdmin: z.boolean().default(false),
});

const listQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.string().optional(),
});

/** 验证租户管理员身份 */
async function requireTenantAdmin(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return { error: unauthorized() };
  const payload = await verifyToken(token);
  if (!payload) return { error: unauthorized("登录已过期") };
  if (!payload.isGlobalAdmin) return { error: forbidden("仅限管理员") };
  return { payload };
}

export async function GET(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (auth.error) return auth.error;

  const parsed = parseQuery(request, listQuerySchema);
  if (!parsed.success) return error(parsed.error);
  const { page, pageSize, search, departmentId, status } = parsed.data;

  return withTenantContext(
    auth.payload.tenantId,
    auth.payload.isGlobalAdmin,
    async () => {
      const where = {
        tenantId: auth.payload.tenantId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }),
        ...(departmentId && { departmentId }),
        ...(status && { status }),
      };

      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
            isGlobalAdmin: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
            createdAt: true,
          },
        }),
        db.user.count({ where }),
      ]);

      return paginated(users, total, page, pageSize);
    }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantAdmin(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createUserSchema);
  if (!parsed.success) return error(parsed.error);

  return withTenantContext(
    auth.payload.tenantId,
    auth.payload.isGlobalAdmin,
    async () => {
      const { email, password, name, departmentId, isGlobalAdmin } = parsed.data;

      // 检查邮箱唯一性（租户内）
      const existing = await db.user.findFirst({
        where: { email, tenantId: auth.payload.tenantId },
      });
      if (existing) return error("该邮箱在当前租户中已存在");

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await db.user.create({
        data: {
          email,
          passwordHash,
          name,
          tenantId: auth.payload.tenantId,
          departmentId,
          isGlobalAdmin,
          status: "active",
        },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          isGlobalAdmin: true,
          departmentId: true,
          createdAt: true,
        },
      });

      return created(user);
    }
  );
}
