// ============================================================
// POST /api/auth/forgot-password
// 忘记密码 — 生成 6 位验证码（15 分钟有效）
// V1: 验证码直接返回到响应中（邮件发送延后）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";

const forgotPasswordSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
});

/** 生成 6 位数字验证码 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, forgotPasswordSchema);
  if (!parsed.success) {
    return error(parsed.error);
  }

  const { email } = parsed.data;

  // 查找用户（不暴露用户是否存在 — 但 V1 先返回验证码，所以可以提示）
  const user = await db.user.findFirst({ where: { email } });

  if (!user) {
    return success(null, "如果该邮箱已注册，验证码已发送");
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 分钟

  // 使该邮箱之前的同类验证码失效
  await db.verificationCode.updateMany({
    where: {
      email,
      type: "reset_password",
      used: false,
    },
    data: { used: true },
  });

  // 存储新验证码
  await db.verificationCode.create({
    data: {
      email,
      code,
      type: "reset_password",
      expiresAt,
    },
  });

  // TODO: 发送验证码邮件
  // V1 直接在响应中返回验证码
  return success(
    {
      code, // V1 临时返回，后续版本通过邮件发送后移除
      expiresAt: expiresAt.toISOString(),
    },
    "验证码已生成（V1: 直接返回，后续将通过邮件发送）"
  );
}
