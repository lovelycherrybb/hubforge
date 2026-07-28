// ============================================================
// POST /api/auth/register
// 创建新租户 + 管理员（仅主租户 owner 可用）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, unauthorized } from "@/lib/api-response";

const registerSchema = z.object({
  tenantName: z.string().min(2, "租户名称至少 2 个字符").max(100),
  tenantSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "slug 只能包含小写字母、数字和连字符"),
  adminEmail: z.string().email("邮箱格式不正确"),
  adminName: z.string().min(1, "姓名不能为空").max(50),
  adminPassword: z
    .string()
    .min(8, "密码至少 8 个字符")
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[0-9]/, "密码必须包含数字"),
});

export async function POST(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  // 仅主租户 owner 可创建新租户
  if (payload.role !== "owner") {
    return forbidden("仅限主租户管理员创建新租户");
  }

  const parsed = await parseBody(request, registerSchema);
  if (!parsed.success) {
    return error(parsed.error);
  }

  const { tenantName, tenantSlug, adminEmail, adminName, adminPassword } =
    parsed.data;

  // 检查 slug 是否已存在
  const existingTenant = await db.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (existingTenant) {
    return error("该租户标识已被占用");
  }

  // 创建租户 + 管理员用户（事务）
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const result = await db.$transaction(async (tx) => {
    // 创建租户
    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug: tenantSlug,
        status: "active",
        createdById: payload.userId,
      },
    });

    // 创建或复用全局用户
    let user = await tx.user.findUnique({ where: { email: adminEmail } });
    if (!user) {
      user = await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
        },
      });
    }

    // 创建用户-租户关系
    await tx.userTenant.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        passwordHash,
        role: "owner",
        status: "active",
      },
    });

    return { tenant, user };
  });

  return success(
    {
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
      admin: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
    },
    "租户创建成功"
  );
}
