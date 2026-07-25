// ============================================================
// POST /api/auth/register
// 用户注册（创建租户 + 管理员用户）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { signToken, COOKIE_NAME, getCookieOptions } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";
import { cookies } from "next/headers";

const registerSchema = z.object({
  tenantName: z.string().min(2, "租户名称至少 2 个字符").max(100),
  tenantSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "slug 只能包含小写字母、数字和连字符"),
  email: z.string().email("邮箱格式不正确"),
  password: z
    .string()
    .min(8, "密码至少 8 个字符")
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[0-9]/, "密码必须包含数字"),
  name: z.string().min(1, "姓名不能为空").max(50),
});

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, registerSchema);
  if (!parsed.success) {
    return error(parsed.error);
  }

  const { tenantName, tenantSlug, email, password, name } = parsed.data;

  // 检查 slug 是否已存在
  const existingTenant = await db.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (existingTenant) {
    return error("该租户标识已被占用");
  }

  // 检查邮箱是否已存在（全局）
  const existingUser = await db.user.findFirst({ where: { email } });
  if (existingUser) {
    return error("该邮箱已被注册");
  }

  // 创建租户 + 管理员用户（事务）
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug: tenantSlug,
        status: "active",
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        tenantId: tenant.id,
        isGlobalAdmin: true, // 注册的第一个用户为管理员
        status: "active",
      },
    });

    return { tenant, user };
  });

  // 签发 JWT
  const token = await signToken({
    userId: result.user.id,
    tenantId: result.tenant.id,
    email: result.user.email,
    isGlobalAdmin: true,
  });

  // 设置 httpOnly Cookie
  cookies().set(COOKIE_NAME, token, getCookieOptions());

  return success(
    {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
    },
    "注册成功"
  );
}
