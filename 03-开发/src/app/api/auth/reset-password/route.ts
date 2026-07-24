// ============================================================
// POST /api/auth/reset-password
// 重置密码
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "重置令牌不能为空"),
  password: z.string().min(8, "密码至少 8 个字符"),
});

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, resetPasswordSchema);
  if (!parsed.success) {
    return error(parsed.error);
  }

  const { token, password } = parsed.data;

  // TODO: 验证重置令牌
  // 1. 从数据库/Redis 查找令牌
  // 2. 检查是否过期
  // 3. 获取关联的用户 ID

  // 临时实现：令牌验证逻辑待实现
  console.log(`[TODO] 验证重置令牌: ${token}`);

  // 示例：假设令牌有效，更新密码
  // const userId = await verifyResetToken(token);
  // const passwordHash = await bcrypt.hash(password, 12);
  // await db.user.update({
  //   where: { id: userId },
  //   data: { passwordHash },
  // });

  return success(null, "密码已重置，请重新登录");
}
