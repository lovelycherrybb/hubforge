// ============================================================
// GET  /api/users  — 用户列表（租户内）
// POST /api/users  — 创建用户
// 权限要求：当前租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getAuthUser } from "@/lib/auth";
import { parseBody, parseQuery, paginationSchema } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, paginated } from "@/lib/api-response";
import { withTenantContext, allRows, firstRow, countValue } from "@/lib/rls-pg";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[0-9]/, "密码必须包含数字"),
  name: z.string().min(1).max(50),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

const listQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.string().optional(),
});

/** 验证管理员身份（owner 或 admin 角色） */
async function requireAdmin(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return { error: unauthorized() };
  if (payload.role !== "owner" && payload.role !== "admin")
    return { error: forbidden("仅限管理员") };
  return { payload };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const parsed = parseQuery(request, listQuerySchema);
  if (!parsed.success) return error(parsed.error);
  const { page, pageSize, search, departmentId, status } = parsed.data;

  const isGlobalAdmin = auth.payload.role === "owner";

  return withTenantContext(
    { tenantId: auth.payload.tenantId, userId: auth.payload.userId, isGlobalAdmin },
    async (client) => {
      // 如果按部门筛选，先获取该部门下的用户 ID
      let deptUserIds: string[] | undefined;
      if (departmentId) {
        const userOrgsResult = await client.query(
          `SELECT "userId" FROM user_organizations WHERE "organizationId" = $1`,
          [departmentId]
        );
        deptUserIds = allRows<{ userId: string }>(userOrgsResult).map((uo) => uo.userId);
        if (deptUserIds.length === 0) return paginated([], 0, page, pageSize);
      }

      // 如果按搜索条件筛选，匹配用户名/邮箱
      let searchUserIds: string[] | undefined;
      if (search) {
        const matchingResult = await client.query(
          `SELECT id FROM users WHERE name ILIKE $1 OR email ILIKE $1`,
          [`%${search}%`]
        );
        searchUserIds = allRows<{ id: string }>(matchingResult).map((u) => u.id);
      }

      // 合并筛选条件
      let userIds: string[] | undefined;
      if (deptUserIds && searchUserIds) {
        userIds = deptUserIds.filter((id) => searchUserIds.includes(id));
        if (userIds.length === 0) return paginated([], 0, page, pageSize);
      } else if (deptUserIds) {
        userIds = deptUserIds;
      } else if (searchUserIds) {
        userIds = searchUserIds;
      }

      // 构建 WHERE 条件
      const conditions: string[] = [`ut."tenantId" = $1`];
      const params: unknown[] = [auth.payload.tenantId];
      let paramIdx = 2;

      if (status) {
        conditions.push(`ut.status = $${paramIdx}`);
        params.push(status);
        paramIdx++;
      }

      if (userIds) {
        conditions.push(`ut."userId" = ANY($${paramIdx})`);
        params.push(userIds);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // 查询总数
      const countResult = await client.query(
        `SELECT count(*) FROM user_tenants ut ${whereClause}`,
        params
      );
      const total = countValue(countResult);

      // 查询用户列表（JOIN users 获取用户信息）
      const offset = (page - 1) * pageSize;
      const listResult = await client.query(
        `SELECT u.id, u.email, u.name, u."avatarUrl", u."createdAt",
                ut.role, ut.status, ut."joinedAt"
         FROM user_tenants ut
         INNER JOIN users u ON u.id = ut."userId"
         ${whereClause}
         ORDER BY ut."joinedAt" DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, pageSize, offset]
      );
      const users = allRows(listResult);

      return paginated(users, total, page, pageSize);
    }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, createUserSchema);
  if (!parsed.success) return error(parsed.error);

  const isGlobalAdmin = auth.payload.role === "owner";

  return withTenantContext(
    { tenantId: auth.payload.tenantId, userId: auth.payload.userId, isGlobalAdmin },
    async (client) => {
      const { email, password, name, role } = parsed.data;

      // 检查用户是否已在当前租户中
      const existingUserResult = await client.query(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [email]
      );
      const existingUser = firstRow<{ id: string }>(existingUserResult);
      if (existingUser) {
        const existingMembershipResult = await client.query(
          `SELECT id FROM user_tenants WHERE "userId" = $1 AND "tenantId" = $2 LIMIT 1`,
          [existingUser.id, auth.payload.tenantId]
        );
        if (firstRow(existingMembershipResult)) return error("该用户已在当前租户中");
      }

      // 检查用户配额
      const tenantResult = await client.query(
        `SELECT * FROM tenants WHERE id = $1 LIMIT 1`,
        [auth.payload.tenantId]
      );
      const tenant = firstRow<{ id: string; maxUsers: number }>(tenantResult);
      if (!tenant) return error("租户不存在");

      const userCountResult = await client.query(
        `SELECT count(*) FROM user_tenants WHERE "tenantId" = $1`,
        [auth.payload.tenantId]
      );
      const userCount = countValue(userCountResult);
      if (userCount >= tenant.maxUsers) {
        return error(`已达到用户数量上限 (${tenant.maxUsers})`);
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // 创建或复用全局用户 + 创建 UserTenant（事务）
      await client.query("BEGIN");
      try {
        // 查找或创建用户
        let userResult = await client.query(
          `SELECT * FROM users WHERE email = $1 LIMIT 1`,
          [email]
        );
        let user = firstRow<{ id: string; email: string; name: string }>(userResult);

        if (!user) {
          const createUserResult = await client.query(
            `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *`,
            [email, name]
          );
          user = firstRow<{ id: string; email: string; name: string }>(createUserResult)!;
        }

        // 创建 UserTenant
        const userTenantResult = await client.query(
          `INSERT INTO user_tenants ("userId", "tenantId", "passwordHash", role, status)
           VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
          [user.id, auth.payload.tenantId, passwordHash, role]
        );
        const userTenant = firstRow<{ role: string; status: string }>(userTenantResult)!;

        await client.query("COMMIT");

        return created({
          id: user.id,
          email: user.email,
          name: user.name,
          role: userTenant.role,
          status: userTenant.status,
        });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  );
}
