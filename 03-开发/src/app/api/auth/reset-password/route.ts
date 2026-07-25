// ============================================================
// POST /api/auth/reset-password
// 重置密码（邮箱 + 验证码 + 新密码）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { COOKIE_NAME } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";
import { cookies } from "next/headers";

const resetPasswordSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  code: z.string().length(6, "验证码必须为 6 位"),
  password: z
    .string()
    .min(8, "密码至少 8 个字符")
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[0-9]/, "密码必须包含数字"),
});

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, resetPasswordSchema);
  if (!parsed.success) {
    return error(parsed.error);
  }

  const { email, code, password } = parsed.data;

  // 查找用户（限定租户隔离：先通过邮箱获取用户及其租户ID）
  const user = await db.user.findFirst({ where: { email } });
  if (!user) {
    return error("用户不存在");
  }

  // 二次校验：确保验证码确实关联到该用户的邮箱（租户内）
  const verificationCheck = await db.verificationCode.findFirst({
    where: {
      email: user.email,
      code,
      type: "reset_password",
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verificationCheck) {
    return error("验证码无效或已过期");
  }

  const verification = verificationCheck;

  // 标记验证码已使用 + 更新密码（事务）
  const passwordHash = await bcrypt.hash(password, 12);

  await db.$transaction(async (tx) => {
    await tx.verificationCode.update({
      where: { id: verification.id },
      data: { used: true },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  });

  // 清除旧 Cookie
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return success(null, "密码已重置，请重新登录");
}
