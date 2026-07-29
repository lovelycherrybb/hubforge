// ============================================================
// GET    /api/users/:id  — 用户详情
// PUT    /api/users/:id  — 更新用户
// DELETE /api/users/:id  — 删除用户（从租户移除）
// 权限要求：当前租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, noContent, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

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

  const isGlobalAdmin = auth.payload.role === "owner" || auth.payload.role === "admin";

  return withTenantContext(
    auth.payload.tenantId,
    isGlobalAdmin,
    async () => {
      // 通过 UserTenant 查找用户在当前租户的信息
      const userTenant = await db.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: params.id,
            tenantId: auth.payload.tenantId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
              emailVerified: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!userTenant) return notFound("用户不存在");

      // 获取用户在当前租户下的权限
      const permissions = await db.userPermission.findMany({
        where: {
          userId: params.id,
          tenantId: auth.payload.tenantId,
        },
        include: {
          permission: { select: { key: true, label: true, type: true } },
        },
      });

      // 获取用户的部门信息
      const userOrgs = await db.userOrganization.findMany({
        where: { userId: params.id },
        include: {
          department: { select: { id: true, name: true } },
        },
      });

      return success({
        id: userTenant.user.id,
        email: userTenant.user.email,
        name: userTenant.user.name,
        avatarUrl: userTenant.user.avatarUrl,
        emailVerified: userTenant.user.emailVerified,
        role: userTenant.role,
        status: userTenant.status,
        departments: userOrgs.map((uo) => ({
          id: uo.department.id,
          name: uo.department.name,
          isPrimary: uo.isPrimary,
        })),
        permissions: permissions.map((up) => ({
          permissionId: up.permissionId,
          key: up.permission.key,
          label: up.permission.label,
          type: up.permission.type,
        })),
        createdAt: userTenant.user.createdAt,
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

  const isGlobalAdmin = auth.payload.role === "owner" || auth.payload.role === "admin";

  return withTenantContext(
    auth.payload.tenantId,
    isGlobalAdmin,
    async () => {
      const userTenant = await db.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: params.id,
            tenantId: auth.payload.tenantId,
          },
        },
      });
      if (!userTenant) return notFound("用户不存在");

      const { email, password, name, status, role } = parsed.data;

      // 更新 UserTenant（角色、状态、密码）
      const userTenantData: Record<string, unknown> = {};
      if (role) userTenantData.role = role;
      if (status) userTenantData.status = status;
      if (password) {
        userTenantData.passwordHash = await bcrypt.hash(password, 12);
        userTenantData.passwordUpdatedAt = new Date();
      }

      if (Object.keys(userTenantData).length > 0) {
        await db.userTenant.update({
          where: { id: userTenant.id },
          data: userTenantData,
        });
      }

      // 更新 User 全局信息（邮箱、姓名）
      const userData: Record<string, unknown> = {};
      if (email) userData.email = email;
      if (name) userData.name = name;

      if (Object.keys(userData).length > 0) {
        await db.user.update({
          where: { id: params.id },
          data: userData,
        });
      }

      // 返回更新后的信息
      const updatedUser = await db.user.findUnique({
        where: { id: params.id },
        select: { id: true, email: true, name: true, avatarUrl: true },
      });

      const updatedUserTenant = await db.userTenant.findUnique({
        where: { id: userTenant.id },
        select: { role: true, status: true },
      });

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

  const isGlobalAdmin = auth.payload.role === "owner" || auth.payload.role === "admin";

  return withTenantContext(
    auth.payload.tenantId,
    isGlobalAdmin,
    async () => {
      const userTenant = await db.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: params.id,
            tenantId: auth.payload.tenantId,
          },
        },
      });
      if (!userTenant) return notFound("用户不存在");

      // 删除 UserTenant 记录（从租户移除）
      await db.userTenant.delete({ where: { id: userTenant.id } });

      // 清理该用户在当前租户的权限
      await db.userPermission.deleteMany({
        where: { userId: params.id, tenantId: auth.payload.tenantId },
      });

      return noContent();
    }
  );
}
