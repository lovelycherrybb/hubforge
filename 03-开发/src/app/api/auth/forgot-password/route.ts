// ============================================================
// POST /api/auth/forgot-password
// 忘记密码（发送重置邮件）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";

const forgotPasswordSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
});

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, forgotPasswordSchema);
  if (!parsed.success) {
    return error(parsed.error);
  }

  const { email } = parsed.data;

  // 查找用户（不暴露用户是否存在）
  const user = await db.user.findFirst({ where: { email } });

  // 即使用户不存在也返回成功（安全考虑）
  if (!user) {
    return success(null, "如果该邮箱已注册，重置链接已发送");
  }

  // TODO: 生成重置令牌并发送邮件
  // 1. 生成带过期时间的重置令牌
  // 2. 存储到数据库或 Redis
  // 3. 发送包含重置链接的邮件

  console.log(`[TODO] 发送密码重置邮件到: ${email}`);

  return success(null, "如果该邮箱已注册，重置链接已发送");
}
