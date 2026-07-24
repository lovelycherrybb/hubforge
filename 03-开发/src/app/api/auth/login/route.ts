// ============================================================
// POST /api/auth/login
// 用户登录（返回 httpOnly Cookie）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";
import { cookies } from "next/headers";

const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "密码不能为空"),
  tenantSlug: z.string().optional(), // 可选，多租户场景下指定租户
});

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, loginSchema);
  if (!parsed.success) {
    return error(parsed.error);
  }

  const { email, password, tenantSlug } = parsed.data;

  // 查找用户（可选按租户过滤）
  const user = await db.user.findFirst({
    where: {
      email,
      ...(tenantSlug
        ? { tenant: { slug: tenantSlug } }
        : {}),
    },
    include: { tenant: true },
  });

  if (!user) {
    return error("邮箱或密码错误", 401);
  }

  // 检查用户状态
  if (user.status === "locked") {
    return error("账号已被锁定，请联系管理员", 403);
  }

  if (user.status === "invited") {
    return error("请先激活账号", 403);
  }

  // 检查租户状态
  if (user.tenant.status === "suspended") {
    return error("租户已被停用，请联系平台管理员", 403);
  }

  // 验证密码
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    return error("邮箱或密码错误", 401);
  }

  // 签发 JWT
  const token = await signToken({
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    isGlobalAdmin: user.isGlobalAdmin,
  });

  // 设置 httpOnly Cookie
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 天
    path: "/",
  });

  return success(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isGlobalAdmin: user.isGlobalAdmin,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
    },
    "登录成功"
  );
}
