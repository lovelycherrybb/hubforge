// ============================================================
// GET  /api/users  — 用户列表（租户内）
// POST /api/users  — 创建用户
// 权限要求：当前租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody, parseQuery, paginationSchema } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, paginated } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[0-9]/, "密码必须包含数字"),
  name: z.string().min(1).max(50),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

const listQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.string().optional(),
});

/** 验证管理员身份（owner 或 admin 角色） */
async function requireAdmin(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return { error: unauthorized() };
  if (payload.role !== "owner" && payload.role !== "admin")
    return { error: forbidden("仅限管理员") };
  return { payload };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const parsed = parseQuery(request, listQuerySchema);
  if (!parsed.success) return error(parsed.error);
  const { page, pageSize, search, departmentId, status } = parsed.data;

  const isGlobalAdmin = auth.payload.role === "owner" || auth.payload.role === "admin";

  return withTenantContext(
    auth.payload.tenantId,
    isGlobalAdmin,
    async () => {
      // 构建 UserTenant 查询条件
      const where: Record<string, unknown> = {
        tenantId: auth.payload.tenantId,
        ...(status && { status }),
      };

      // 如果按部门筛选，先获取该部门下的用户 ID
      let deptUserIds: string[] | undefined;
      if (departmentId) {
        const userOrgs = await db.userOrganization.findMany({
          where: { organizationId: departmentId },
          select: { userId: true },
        });
        deptUserIds = userOrgs.map((uo) => uo.userId);
        if (deptUserIds.length === 0) return paginated([], 0, page, pageSize);
      }

      // 如果按搜索条件筛选，匹配用户名/邮箱
      let searchUserIds: string[] | undefined;
      if (search) {
        const matchingUsers = await db.user.findMany({
          where: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          },
          select: { id: true },
        });
        searchUserIds = matchingUsers.map((u) => u.id);
      }

      // 合并筛选条件
      let userIds: string[] | undefined;
      if (deptUserIds && searchUserIds) {
        userIds = deptUserIds.filter((id) => searchUserIds.includes(id));
        if (userIds.length === 0) return paginated([], 0, page, pageSize);
      } else if (deptUserIds) {
        userIds = deptUserIds;
      } else if (searchUserIds) {
        userIds = searchUserIds;
      }

      if (userIds) {
        where.userId = { in: userIds };
      }

      const [userTenants, total] = await Promise.all([
        db.userTenant.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { joinedAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                createdAt: true,
              },
            },
          },
        }),
        db.userTenant.count({ where }),
      ]);

      const users = userTenants.map((ut) => ({
        id: ut.user.id,
        email: ut.user.email,
        name: ut.user.name,
        avatarUrl: ut.user.avatarUrl,
        role: ut.role,
        status: ut.status,
        joinedAt: ut.joinedAt,
        createdAt: ut.user.createdAt,
      }));

      return paginated(users, total, page, pageSize);
    }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createUserSchema);
  if (!parsed.success) return error(parsed.error);

  const isGlobalAdmin = auth.payload.role === "owner" || auth.payload.role === "admin";

  return withTenantContext(
    auth.payload.tenantId,
    isGlobalAdmin,
    async () => {
      const { email, password, name, role } = parsed.data;

      // 检查用户是否已在当前租户中
      const existingUser = await db.user.findUnique({ where: { email } });
      if (existingUser) {
        const existingMembership = await db.userTenant.findUnique({
          where: {
            userId_tenantId: {
              userId: existingUser.id,
              tenantId: auth.payload.tenantId,
            },
          },
        });
        if (existingMembership) return error("该用户已在当前租户中");
      }

      // 检查用户配额
      const tenant = await db.tenant.findUnique({
        where: { id: auth.payload.tenantId },
      });
      if (!tenant) return error("租户不存在");

      const userCount = await db.userTenant.count({
        where: { tenantId: auth.payload.tenantId },
      });
      if (userCount >= tenant.maxUsers) {
        return error(`已达到用户数量上限 (${tenant.maxUsers})`);
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // 创建或复用全局用户 + 创建 UserTenant（事务）
      const result = await db.$transaction(async (tx) => {
        let user = await tx.user.findUnique({ where: { email } });
        if (!user) {
          user = await tx.user.create({
            data: { email, name },
          });
        }

        const userTenant = await tx.userTenant.create({
          data: {
            userId: user.id,
            tenantId: auth.payload.tenantId,
            passwordHash,
            role,
            status: "active",
          },
        });

        return { user, userTenant };
      });

      return created({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.userTenant.role,
        status: result.userTenant.status,
      });
    }
  );
}
