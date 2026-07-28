// ============================================================
// POST /api/auth/login
// 两步登录：1) 输入邮箱获取租户列表 2) 选择租户后验证密码
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
  const body = await request.json();

  // 判断是哪个步骤
  if (body.step === 1) {
    return handleStep1(body);
  } else if (body.step === 2) {
    return handleStep2(body);
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

  // 查询用户所属的所有租户
  const userWithTenants = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      tenantMemberships: {
        select: {
          id: true,
          tenantId: true,
          role: true,
          status: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              status: true,
            },
          },
        },
        where: {
          status: { in: ["active", "invited"] },
        },
      },
    },
  });

  if (!userWithTenants) {
    return error("该邮箱未被任何租户邀请", 404);
  }

  // 过滤掉已停用的租户
  const activeTenants = userWithTenants.tenantMemberships.filter(
    (m) => m.tenant.status === "active"
  );

  if (activeTenants.length === 0) {
    return error("该邮箱未被任何有效租户邀请", 404);
  }

  // 如果只有一个租户，直接返回（前端可自动选择）
  return success(
    {
      userId: userWithTenants.id,
      email: userWithTenants.email,
      name: userWithTenants.name,
      tenants: activeTenants.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        logoUrl: m.tenant.logoUrl,
        role: m.role,
      })),
      singleTenant: activeTenants.length === 1,
    },
    "查询成功"
  );
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

  // 查找用户-租户关系
  const userTenant = await db.userTenant.findUnique({
    where: {
      userId_tenantId: {
        userId: (
          await db.user.findUnique({ where: { email }, select: { id: true } })
        )?.id || "",
        tenantId,
      },
    },
    include: {
      user: true,
      tenant: true,
    },
  });

  if (!userTenant) {
    return error("用户不属于该租户", 404);
  }

  // 检查租户状态
  if (userTenant.tenant.status === "suspended") {
    return error("租户已被停用，请联系平台管理员", 403);
  }

  // 检查用户在该租户下的状态
  if (userTenant.status === "suspended") {
    return error("账号已被该租户停用", 403);
  }

  // 检查是否被锁定（单租户锁定）
  if (userTenant.lockedUntil && userTenant.lockedUntil > new Date()) {
    const remainMinutes = Math.ceil(
      (userTenant.lockedUntil.getTime() - Date.now()) / 60000
    );
    return error(
      `密码错误次数过多，请 ${remainMinutes} 分钟后再试`,
      403
    );
  }

  // 验证密码（该租户独立密码）
  const isValidPassword = await bcrypt.compare(
    password,
    userTenant.passwordHash
  );

  if (!isValidPassword) {
    // 密码错误，增加失败次数
    const newAttempts = userTenant.failedAttempts + 1;
    const updateData: {
      failedAttempts: number;
      lockedUntil?: Date;
    } = {
      failedAttempts: newAttempts,
    };

    // 达到最大失败次数，锁定该租户下的账号
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }

    await db.userTenant.update({
      where: { id: userTenant.id },
      data: updateData,
    });

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      return error(
        `密码错误次数过多，账号已被锁定 15 分钟`,
        403
      );
    }

    return error(
      `密码错误（还剩 ${MAX_FAILED_ATTEMPTS - newAttempts} 次尝试机会）`,
      401
    );
  }

  // 密码正确，重置失败次数
  if (userTenant.failedAttempts > 0 || userTenant.lockedUntil) {
    await db.userTenant.update({
      where: { id: userTenant.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  // 签发 JWT
  const token = await signToken({
    userId: userTenant.user.id,
    tenantId: userTenant.tenantId,
    email: userTenant.user.email,
    role: userTenant.role,
  });

  // 设置 httpOnly Cookie
  const cookieOptions = getCookieOptions();
  if (remember) {
    // 记住我的选择：30天有效期
    cookieOptions.maxAge = 30 * 24 * 60 * 60;
  }
  cookies().set(COOKIE_NAME, token, cookieOptions);

  return success(
    {
      user: {
        id: userTenant.user.id,
        email: userTenant.user.email,
        name: userTenant.user.name,
      },
      tenant: {
        id: userTenant.tenant.id,
        name: userTenant.tenant.name,
        slug: userTenant.tenant.slug,
      },
      role: userTenant.role,
    },
    "登录成功"
  );
}
