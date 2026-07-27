// GET  /api/tenants/[id]/users — 获取租户用户列表
// POST /api/tenants/[id]/users — 给租户添加用户
// 权限要求：主租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { hashSync } from "bcryptjs";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, notFound } from "@/lib/api-response";

const createUserSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  name: z.string().min(1, "姓名不能为空").max(100),
  password: z
    .string()
    .min(8, "密码至少8位")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[0-9]/, "密码必须包含数字"),
});

// GET — 获取租户用户列表
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限主租户");

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return notFound("租户不存在");

  const users = await db.user.findMany({
    where: { tenantId: params.id },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      isGlobalAdmin: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return success(users);
}

// POST — 给租户添加用户
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限主租户");

  const tenant = await db.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return notFound("租户不存在");

  // 检查用户配额
  const userCount = await db.user.count({ where: { tenantId: params.id } });
  if (userCount >= tenant.quotaUsers) {
    return error(`已达到用户数量上限 (${tenant.quotaUsers})`);
  }

  const parsed = await parseBody(request, createUserSchema);
  if (!parsed.success) return error(parsed.error);

  const { email, name, password } = parsed.data;

  // 检查邮箱在租户内唯一
  const existing = await db.user.findFirst({
    where: { email, tenantId: params.id },
  });
  if (existing) return error("该邮箱在当前租户中已存在");

  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash: hashSync(password, 10),
      tenantId: params.id,
      status: "active",
    },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      isGlobalAdmin: true,
    },
  });

  return created(user);
}
