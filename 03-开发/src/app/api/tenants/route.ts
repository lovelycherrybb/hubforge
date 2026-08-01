// ============================================================
// GET /api/tenants      — 租户列表
// POST /api/tenants     — 创建租户（自动生成管理员账号）
// 权限要求：owner 角色（平台管理员）
// 使用 pg 直连 + withElevatedContext（admin 操作）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getAuthUser } from "@/lib/auth";
import { withElevatedContext, firstRow, allRows, countValue } from "@/lib/rls-pg";
import { parseBody, parseQuery, paginationSchema } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, paginated } from "@/lib/api-response";

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2, "标识至少2个字符")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "标识只能用小写字母、数字和连字符"),
  maxUsers: z.number().int().min(1).default(100),
  maxApps: z.number().int().min(1).default(50),
  maxOrgLevels: z.number().int().min(1).default(5),
  adminEmail: z.string().email("管理员邮箱格式不正确"),
  adminName: z.string().min(1).max(50).default("管理员"),
});

/** 验证平台管理员身份（owner 角色） */
async function requireGlobalAdmin(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return { error: unauthorized() };
  if (payload.role !== "owner") return { error: forbidden("仅限平台管理员") };
  return { payload };
}

/** 生成临时密码（使用 crypto 安全随机数） */
function generateTempPassword(): string {
  const crypto = require("crypto");
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const all = upper + lower + digits;
  const bytes = crypto.randomBytes(24);
  // 确保满足密码强度要求（含大小写+数字）
  let pwd =
    upper[bytes[0] % upper.length] +
    lower[bytes[1] % lower.length] +
    digits[bytes[2] % digits.length];
  for (let i = 3; i < 12; i++) {
    pwd += all[bytes[i] % all.length];
  }
  // 用 Fisher-Yates 洗牌（基于 crypto 随机数）
  const arr = pwd.split("");
  const shuffleBytes = crypto.randomBytes(arr.length);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export async function GET(request: NextRequest) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return auth.error;

  const parsed = parseQuery(request, paginationSchema);
  if (!parsed.success) return error(parsed.error);
  const { page, pageSize } = parsed.data;

  return withElevatedContext(async (client) => {
    const offset = (page - 1) * pageSize;

    // 查询租户列表（带用户数和应用数统计）
    const tenantsResult = await client.query(
      `SELECT t.*,
              (SELECT count(*) FROM user_tenants ut WHERE ut."tenantId" = t.id) as "userCount",
              (SELECT count(*) FROM tenant_apps ta WHERE ta."tenantId" = t.id) as "appCount"
       FROM tenants t
       ORDER BY t."createdAt" DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    const countResult = await client.query('SELECT count(*) FROM tenants');
    const total = countValue(countResult);
    const tenants = allRows(tenantsResult);

    return paginated(tenants, total, page, pageSize);
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createTenantSchema);
  if (!parsed.success) return error(parsed.error);

  const { name, slug, maxUsers, maxApps, maxOrgLevels, adminEmail, adminName } =
    parsed.data;

  return withElevatedContext(async (client) => {
    // 检查 slug 唯一性
    const existing = firstRow(
      await client.query('SELECT id FROM tenants WHERE slug = $1', [slug])
    );
    if (existing) return error("该租户标识已被占用");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // 事务：创建租户 + 管理员账号
    await client.query('BEGIN');
    try {
      // 创建租户
      const tenantResult = await client.query(
        `INSERT INTO tenants (id, name, slug, "maxUsers", "maxApps", "maxOrgLevels", status, "createdById", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'active', $6, NOW(), NOW())
         RETURNING *`,
        [name, slug, maxUsers, maxApps, maxOrgLevels, auth.payload.userId]
      );
      const tenant = firstRow(tenantResult);

      // 创建或复用全局用户
      let admin = firstRow(
        await client.query('SELECT id, email, name FROM users WHERE email = $1', [adminEmail])
      );
      if (!admin) {
        const adminResult = await client.query(
          'INSERT INTO users (id, email, name, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) RETURNING id, email, name',
          [adminEmail, adminName]
        );
        admin = firstRow(adminResult);
      }

      // 创建用户-租户关系（owner 角色）
      await client.query(
        `INSERT INTO user_tenants (id, "userId", "tenantId", "passwordHash", role, status, "failedAttempts", "joinedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'owner', 'active', 0, NOW())`,
        [(admin as any).id, (tenant as any).id, passwordHash]
      );

      await client.query('COMMIT');

      return created(
        {
          tenant,
          admin: {
            id: (admin as any).id,
            email: (admin as any).email,
            name: (admin as any).name,
            tempPassword,
          },
        },
        "租户创建成功，管理员临时密码已生成"
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });
}
