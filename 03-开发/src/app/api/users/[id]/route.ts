// ============================================================
// GET    /api/users/:id  — 用户详情
// PUT    /api/users/:id  — 更新用户
// DELETE /api/users/:id  — 删除用户（从租户移除）
// 权限要求：当前租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, noContent, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { withTenantContext, firstRow, allRows } from "@/lib/rls-pg";

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z
    .string()
    .min(8)
    .regex(/[a-z]/, "密码必须包含小写字母")
    .regex(/[A-Z]/, "密码必须包含大写字母")
    .regex(/[0-9]/, "密码必须包含数字")
    .optional(),
  name: z.string().min(1).max(50).optional(),
  status: z.enum(["active", "suspended", "invited"]).optional(),
  role: z.enum(["owner", "admin", "member"]).optional(),
});

async function requireAdmin(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return { error: unauthorized() };
  if (payload.role !== "owner" && payload.role !== "admin")
    return { error: forbidden("仅限管理员") };
  return { payload };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const isGlobalAdmin = auth.payload.role === "owner";

  return withTenantContext(
    { tenantId: auth.payload.tenantId, userId: auth.payload.userId, isGlobalAdmin },
    async (client) => {
      // 通过 UserTenant 查找用户在当前租户的信息
      const utResult = await client.query(
        `SELECT ut.*, u.id AS "uId", u.email AS "uEmail", u.name AS "uName",
                u."avatarUrl" AS "uAvatarUrl", u."emailVerified" AS "uEmailVerified",
                u."createdAt" AS "uCreatedAt", u."updatedAt" AS "uUpdatedAt"
         FROM user_tenants ut
         INNER JOIN users u ON u.id = ut."userId"
         WHERE ut."userId" = $1 AND ut."tenantId" = $2
         LIMIT 1`,
        [params.id, auth.payload.tenantId]
      );
      const userTenant = firstRow<any>(utResult);

      if (!userTenant) return notFound("用户不存在");

      // 获取用户在当前租户下的权限
      const permsResult = await client.query(
        `SELECT up."permissionId", p.key, p.label, p.type
         FROM user_permissions up
         INNER JOIN permissions p ON p.id = up."permissionId"
         WHERE up."userId" = $1 AND up."tenantId" = $2`,
        [params.id, auth.payload.tenantId]
      );
      const permissions = allRows<any>(permsResult);

      // 获取用户的部门信息
      const userOrgsResult = await client.query(
        `SELECT d.id, d.name, uo."isPrimary"
         FROM user_organizations uo
         INNER JOIN departments d ON d.id = uo."organizationId"
         WHERE uo."userId" = $1`,
        [params.id]
      );
      const userOrgs = allRows<any>(userOrgsResult);

      return success({
        id: userTenant.uId,
        email: userTenant.uEmail,
        name: userTenant.uName,
        avatarUrl: userTenant.uAvatarUrl,
        emailVerified: userTenant.uEmailVerified,
        role: userTenant.role,
        status: userTenant.status,
        departments: userOrgs.map((uo) => ({
          id: uo.id,
          name: uo.name,
          isPrimary: uo.isPrimary,
        })),
        permissions: permissions.map((up) => ({
          permissionId: up.permissionId,
          key: up.key,
          label: up.label,
          type: up.type,
        })),
        createdAt: userTenant.uCreatedAt,
        joinedAt: userTenant.joinedAt,
      });
    }
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const parsed = await parseBody(request, updateUserSchema);
  if (!parsed.success) return error(parsed.error);

  const isGlobalAdmin = auth.payload.role === "owner";

  return withTenantContext(
    { tenantId: auth.payload.tenantId, userId: auth.payload.userId, isGlobalAdmin },
    async (client) => {
      const utResult = await client.query(
        `SELECT * FROM user_tenants WHERE "userId" = $1 AND "tenantId" = $2 LIMIT 1`,
        [params.id, auth.payload.tenantId]
      );
      const userTenant = firstRow<any>(utResult);
      if (!userTenant) return notFound("用户不存在");

      const { email, password, name, status, role } = parsed.data;

      // 更新 UserTenant（角色、状态、密码）
      const utSetClauses: string[] = [];
      const utParams: unknown[] = [];
      let utIdx = 1;

      if (role) {
        utSetClauses.push(`role = $${utIdx}`);
        utParams.push(role);
        utIdx++;
      }
      if (status) {
        utSetClauses.push(`status = $${utIdx}`);
        utParams.push(status);
        utIdx++;
      }
      if (password) {
        const passwordHash = await bcrypt.hash(password, 12);
        utSetClauses.push(`"passwordHash" = $${utIdx}`);
        utParams.push(passwordHash);
        utIdx++;
        utSetClauses.push(`"passwordUpdatedAt" = NOW()`);
      }

      if (utSetClauses.length > 0) {
        await client.query(
          `UPDATE user_tenants SET ${utSetClauses.join(", ")} WHERE id = $${utIdx}`,
          [...utParams, userTenant.id]
        );
      }

      // 更新 User 全局信息（邮箱、姓名）
      const userSetClauses: string[] = [];
      const userParams: unknown[] = [];
      let userIdx = 1;

      if (email) {
        userSetClauses.push(`email = $${userIdx}`);
        userParams.push(email);
        userIdx++;
      }
      if (name) {
        userSetClauses.push(`name = $${userIdx}`);
        userParams.push(name);
        userIdx++;
      }

      if (userSetClauses.length > 0) {
        await client.query(
          `UPDATE users SET ${userSetClauses.join(", ")} WHERE id = $${userIdx}`,
          [...userParams, params.id]
        );
      }

      // 返回更新后的信息
      const updatedUserResult = await client.query(
        `SELECT id, email, name, "avatarUrl" FROM users WHERE id = $1 LIMIT 1`,
        [params.id]
      );
      const updatedUser = firstRow<any>(updatedUserResult);

      const updatedUtResult = await client.query(
        `SELECT role, status FROM user_tenants WHERE id = $1 LIMIT 1`,
        [userTenant.id]
      );
      const updatedUserTenant = firstRow<any>(updatedUtResult);

      return success({
        ...updatedUser,
        role: updatedUserTenant?.role,
        status: updatedUserTenant?.status,
      });
    }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  // 不能删除自己
  if (params.id === auth.payload.userId) {
    return error("不能删除当前登录用户");
  }

  const isGlobalAdmin = auth.payload.role === "owner";

  return withTenantContext(
    { tenantId: auth.payload.tenantId, userId: auth.payload.userId, isGlobalAdmin },
    async (client) => {
      const utResult = await client.query(
        `SELECT * FROM user_tenants WHERE "userId" = $1 AND "tenantId" = $2 LIMIT 1`,
        [params.id, auth.payload.tenantId]
      );
      const userTenant = firstRow<any>(utResult);
      if (!userTenant) return notFound("用户不存在");

      // 删除 UserTenant 记录（从租户移除）
      await client.query(`DELETE FROM user_tenants WHERE id = $1`, [userTenant.id]);

      // 清理该用户在当前租户的权限
      await client.query(
        `DELETE FROM user_permissions WHERE "userId" = $1 AND "tenantId" = $2`,
        [params.id, auth.payload.tenantId]
      );

      return noContent();
    }
  );
}
