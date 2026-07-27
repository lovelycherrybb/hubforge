// ============================================================
// GET /api/tenants      — 租户列表
// POST /api/tenants     — 创建租户（自动生成管理员账号）
// 权限要求：全局管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody, parseQuery, paginationSchema } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, paginated } from "@/lib/api-response";

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  quotaUsers: z.number().int().min(1).default(100),
  quotaApps: z.number().int().min(1).default(50),
  quotaOrgLevels: z.number().int().min(1).default(5),
  adminEmail: z.string().email("管理员邮箱格式不正确"),
  adminName: z.string().min(1).max(50).default("管理员"),
});

/** 验证全局管理员身份 */
async function requireGlobalAdmin(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return { error: unauthorized() };
  if (!payload.isGlobalAdmin) return { error: forbidden("仅限平台管理员") };
  return { payload };
}

/** 生成临时密码 */
function generateTempPassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const all = upper + lower + digits;
  // 确保满足密码强度要求
  let pwd =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)];
  for (let i = 3; i < 12; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  // 打乱顺序
  return pwd
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export async function GET(request: NextRequest) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return auth.error;

  const parsed = parseQuery(request, paginationSchema);
  if (!parsed.success) return error(parsed.error);
  const { page, pageSize } = parsed.data;

  const [tenants, total] = await Promise.all([
    db.tenant.findMany({
      where: { status: { not: "deleted" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, tenantApps: true } } },
    }),
    db.tenant.count({ where: { status: { not: "deleted" } } }),
  ]);

  return paginated(tenants, total, page, pageSize);
}

export async function POST(request: NextRequest) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createTenantSchema);
  if (!parsed.success) return error(parsed.error);

  const { name, slug, quotaUsers, quotaApps, quotaOrgLevels, adminEmail, adminName } =
    parsed.data;

  // 检查 slug 唯一性
  const existing = await db.tenant.findUnique({ where: { slug } });
  if (existing) return error("该租户标识已被占用");

  // 检查管理员邮箱唯一性
  const existingUser = await db.user.findFirst({ where: { email: adminEmail } });
  if (existingUser) return error("该管理员邮箱已被使用");

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // 事务：创建租户 + 管理员账号
  const result = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name,
        slug,
        quotaUsers,
        quotaApps,
        quotaOrgLevels,
        status: "active",
      },
    });

    const admin = await tx.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: adminName,
        tenantId: tenant.id,
        isGlobalAdmin: false, // 租户管理员，非平台管理员
        status: "invited",
      },
    });

    return { tenant, admin };
  });

  return created(
    {
      tenant: result.tenant,
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        name: result.admin.name,
        status: result.admin.status,
        tempPassword, // 管理员首次登录后应修改密码
      },
    },
    "租户创建成功，管理员临时密码已生成"
  );
}
