// ============================================================
// POST /api/auth/login
// 用户登录（含失败次数锁定机制）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { signToken, COOKIE_NAME, getCookieOptions } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";
import { cookies } from "next/headers";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 分钟

const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "密码不能为空"),
  tenantSlug: z.string().optional(),
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

  // 检查账号是否被锁定（时间窗口已过则自动解锁）
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remainMinutes = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000
    );
    return error(
      `账号已被锁定，请 ${remainMinutes} 分钟后再试`,
      403
    );
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

  if (user.tenant.status === "deleted") {
    return error("租户已注销", 403);
  }

  // 验证密码
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    // 密码错误，增加失败次数
    const newAttempts = user.failedLoginAttempts + 1;
    const updateData: {
      failedLoginAttempts: number;
      lockedUntil?: Date;
    } = {
      failedLoginAttempts: newAttempts,
    };

    // 达到最大失败次数，锁定账号
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }

    await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      return error(
        `密码错误次数过多，账号已被锁定 15 分钟`,
        403
      );
    }

    return error(
      `邮箱或密码错误（还剩 ${MAX_FAILED_ATTEMPTS - newAttempts} 次尝试机会）`,
      401
    );
  }

  // 密码正确，重置失败次数
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  // 签发 JWT
  const token = await signToken({
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    isGlobalAdmin: user.isGlobalAdmin,
  });

  // 设置 httpOnly Cookie
  cookies().set(COOKIE_NAME, token, getCookieOptions());

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
