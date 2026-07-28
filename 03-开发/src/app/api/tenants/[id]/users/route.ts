// GET  /api/tenants/[id]/users — 获取租户用户列表
// POST /api/tenants/[id]/users — 给租户添加用户
// 权限要求：owner 角色（平台管理员）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, notFound } from "@/lib/api-response";

const createUserSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  name: z.string().min(1, "姓名不能为空").max(100),
  password: z
    .string()
    .min(8, "密码至少8位")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[0-9]/, "密码必须包含数字"),
  role: z.enum(["admin", "member"]).default("member"),
});

// GET — 获取租户用户列表
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "owner") return forbidden("仅限平台管理员");

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return notFound("租户不存在");

  // 通过 UserTenant 获取租户用户列表
  const userTenants = await db.userTenant.findMany({
    where: { tenantId: params.id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const users = userTenants.map((ut) => ({
    id: ut.user.id,
    email: ut.user.email,
    name: ut.user.name,
    avatarUrl: ut.user.avatarUrl,
    role: ut.role,
    status: ut.status,
    joinedAt: ut.joinedAt,
  }));

  return success(users);
}

// POST — 给租户添加用户
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "owner") return forbidden("仅限平台管理员");

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return notFound("租户不存在");

  // 检查用户配额
  const userCount = await db.userTenant.count({ where: { tenantId: params.id } });
  if (userCount >= tenant.maxUsers) {
    return error(`已达到用户数量上限 (${tenant.maxUsers})`);
  }

  const parsed = await parseBody(request, createUserSchema);
  if (!parsed.success) return error(parsed.error);

  const { email, name, password, role } = parsed.data;

  // 检查用户是否已在该租户中
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await db.userTenant.findUnique({
      where: {
        userId_tenantId: { userId: existingUser.id, tenantId: params.id },
      },
    });
    if (existingMembership) return error("该用户已在当前租户中");
  }

  const passwordHash = await hash(password, 12);

  // 创建或复用全局用户 + UserTenant（事务）
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
        tenantId: params.id,
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
