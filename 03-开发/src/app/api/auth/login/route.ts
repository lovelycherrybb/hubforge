// ============================================================
// POST /api/auth/login
// 两步登录：1) 输入邮箱获取租户列表 2) 选择租户后验证密码
// 使用 pg 直连 + elevated context 绕过 RLS（登录是公开端点）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signToken, COOKIE_NAME, getCookieOptions } from "@/lib/auth";
import { withElevatedContext, firstRow, allRows } from "@/lib/rls-pg";
import { parseBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";
import { cookies } from "next/headers";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 分钟

// 步骤1: 查询租户列表
const step1Schema = z.object({
  email: z.string().email("邮箱格式不正确"),
  step: z.literal(1),
});

// 步骤2: 验证密码登录
const step2Schema = z.object({
  email: z.string().email("邮箱格式不正确"),
  tenantId: z.string().min(1, "请选择租户"),
  password: z.string().min(1, "密码不能为空"),
  step: z.literal(2),
  remember: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("请求体格式错误", 400);
  }

  if (typeof body !== "object" || body === null) {
    return error("请求体格式错误", 400);
  }

  const { step } = body as { step?: number };

  if (step === 1) {
    return handleStep1(body as { email: string; step: 1 });
  } else if (step === 2) {
    return handleStep2(body as { email: string; tenantId: string; password: string; step: 2; remember?: boolean });
  } else {
    return error("无效的请求参数", 400);
  }
}

// ============================================================
// 步骤1: 根据邮箱查询用户所属的租户列表
// ============================================================
async function handleStep1(body: { email: string; step: 1 }) {
  const parsed = step1Schema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message || "参数错误");
  }

  const { email } = parsed.data;

  return withElevatedContext(async (client) => {
    // 查询用户
    const userResult = await client.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email]
    );
    const user = firstRow<{ id: string; email: string; name: string }>(userResult);

    if (!user) {
      return error("该邮箱未被任何租户邀请", 404);
    }

    // 查询用户所属的活跃租户
    const membershipResult = await client.query(
      `SELECT ut.id, ut."tenantId", ut.role, ut.status,
              t.id as "t_id", t.name as "t_name", t.slug as "t_slug",
              t."logoUrl" as "t_logoUrl", t.status as "t_status"
       FROM user_tenants ut
       JOIN tenants t ON t.id = ut."tenantId"
       WHERE ut."userId" = $1
         AND ut.status IN ('active', 'invited')
         AND t.status = 'active'`,
      [user.id]
    );
    const memberships = allRows<{
      id: string; tenantId: string; role: string; status: string;
      t_id: string; t_name: string; t_slug: string; t_logoUrl: string | null; t_status: string;
    }>(membershipResult);

    if (memberships.length === 0) {
      return error("该邮箱未被任何有效租户邀请", 404);
    }

    return success(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        tenants: memberships.map((m) => ({
          id: m.t_id,
          name: m.t_name,
          slug: m.t_slug,
          logoUrl: m.t_logoUrl,
          role: m.role,
        })),
        singleTenant: memberships.length === 1,
      },
      "查询成功"
    );
  });
}

// ============================================================
// 步骤2: 选择租户后验证密码
// ============================================================
async function handleStep2(body: {
  email: string;
  tenantId: string;
  password: string;
  step: 2;
  remember?: boolean;
}) {
  const parsed = step2Schema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues.map(i => i.message).join("; "));
  }

  const { email, tenantId, password, remember } = parsed.data;

  return withElevatedContext(async (client) => {
    // 查找用户-租户关系（含用户和租户信息）
    const utResult = await client.query(
      `SELECT ut.id, ut."userId", ut."tenantId", ut."passwordHash", ut.role, ut.status,
              ut."failedAttempts", ut."lockedUntil",
              u.id as "u_id", u.email as "u_email", u.name as "u_name",
              t.id as "t_id", t.name as "t_name", t.slug as "t_slug", t.status as "t_status"
       FROM user_tenants ut
       JOIN users u ON u.id = ut."userId"
       JOIN tenants t ON t.id = ut."tenantId"
       WHERE u.email = $1 AND ut."tenantId" = $2`,
      [email, tenantId]
    );
    const ut = firstRow<{
      id: string; userId: string; tenantId: string; passwordHash: string;
      role: string; status: string; failedAttempts: number; lockedUntil: string | null;
      u_id: string; u_email: string; u_name: string;
      t_id: string; t_name: string; t_slug: string; t_status: string;
    }>(utResult);

    if (!ut) {
      return error("用户不属于该租户", 404);
    }

    // 检查租户状态
    if (ut.t_status === "suspended") {
      return error("租户已被停用，请联系平台管理员", 403);
    }

    // 检查用户在该租户下的状态
    if (ut.status === "suspended") {
      return error("账号已被该租户停用", 403);
    }

    // 检查是否被锁定
    if (ut.lockedUntil && new Date(ut.lockedUntil) > new Date()) {
      const remainMinutes = Math.ceil(
        (new Date(ut.lockedUntil).getTime() - Date.now()) / 60000
      );
      return error(`密码错误次数过多，请 ${remainMinutes} 分钟后再试`, 403);
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, ut.passwordHash);

    if (!isValidPassword) {
      // 密码错误，增加失败次数
      const newAttempts = ut.failedAttempts + 1;
      const lockedUntil = newAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
        : null;

      await client.query(
        'UPDATE user_tenants SET "failedAttempts" = $1, "lockedUntil" = $2 WHERE id = $3',
        [newAttempts, lockedUntil, ut.id]
      );

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        return error("密码错误次数过多，账号已被锁定 15 分钟", 403);
      }

      return error(
        `密码错误（还剩 ${MAX_FAILED_ATTEMPTS - newAttempts} 次尝试机会）`,
        401
      );
    }

    // 密码正确，重置失败次数
    if (ut.failedAttempts > 0 || ut.lockedUntil) {
      await client.query(
        'UPDATE user_tenants SET "failedAttempts" = 0, "lockedUntil" = NULL WHERE id = $1',
        [ut.id]
      );
    }

    // 签发 JWT
    const token = await signToken({
      userId: ut.u_id,
      tenantId: ut.tenantId,
      email: ut.u_email,
      role: ut.role as "owner" | "admin" | "member",
    });

    // 设置 httpOnly Cookie
    const cookieOptions = getCookieOptions();
    if (remember) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60;
    }
    cookies().set(COOKIE_NAME, token, cookieOptions);

    return success(
      {
        user: {
          id: ut.u_id,
          email: ut.u_email,
          name: ut.u_name,
        },
        tenant: {
          id: ut.t_id,
          name: ut.t_name,
          slug: ut.t_slug,
        },
        role: ut.role,
      },
      "登录成功"
    );
  });
}
