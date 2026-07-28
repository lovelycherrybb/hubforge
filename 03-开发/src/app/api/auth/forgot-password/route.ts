// ============================================================
// POST /api/auth/forgot-password
// 忘记密码 - 两步流程：1) 输入邮箱获取租户列表 2) 选择租户后发送验证码
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { parseBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";

// 步骤1: 查询租户列表
const step1Schema = z.object({
  email: z.string().email("邮箱格式不正确"),
  step: z.literal(1),
});

// 步骤2: 发送验证码
const step2Schema = z.object({
  email: z.string().email("邮箱格式不正确"),
  tenantId: z.string().min(1, "请选择租户"),
  step: z.literal(2),
});

export async function POST(request: NextRequest) {
  const body = await request.json();

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

  const userWithTenants = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      tenantMemberships: {
        select: {
          tenantId: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
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

  const activeTenants = userWithTenants.tenantMemberships.filter(
    (m) => m.tenant !== null
  );

  if (activeTenants.length === 0) {
    return error("该邮箱未被任何有效租户邀请", 404);
  }

  return success(
    {
      tenants: activeTenants.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
      })),
      singleTenant: activeTenants.length === 1,
    },
    "查询成功"
  );
}

// ============================================================
// 步骤2: 选择租户后发送验证码
// ============================================================
async function handleStep2(body: {
  email: string;
  tenantId: string;
  step: 2;
}) {
  const parsed = step2Schema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message || "参数错误");
  }

  const { email, tenantId } = parsed.data;

  // 查找用户-租户关系
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return error("用户不存在", 404);
  }

  const userTenant = await db.userTenant.findUnique({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId,
      },
    },
    include: { tenant: true },
  });

  if (!userTenant) {
    return error("用户不属于该租户", 404);
  }

  // 检查租户状态
  if (userTenant.tenant.status === "suspended") {
    return error("租户已被停用", 403);
  }

  // 生成6位验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15分钟有效

  // 标记旧验证码为已使用
  await db.verificationCode.updateMany({
    where: {
      email,
      tenantId,
      type: "reset_password",
      used: false,
    },
    data: { used: true },
  });

  // 存储新验证码（取用户第一个有效租户）
  const membership = await db.userTenant.findFirst({
    where: { userId: user.id, status: "active" },
    select: { tenantId: true },
  });

  if (!membership) {
    return error("用户未关联任何有效租户");
  }

  await db.verificationCode.create({
    data: {
      email,
      code,
      tenantId: membership.tenantId,
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
