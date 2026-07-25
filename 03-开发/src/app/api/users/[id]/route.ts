// ============================================================
// GET    /api/users/:id  — 用户详情
// PUT    /api/users/:id  — 更新用户
// DELETE /api/users/:id  — 删除用户
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
  status: z.enum(["active", "locked", "invited"]).optional(),
  departmentId: z.string().nullable().optional(),
  isGlobalAdmin: z.boolean().optional(),
});

async function requireAdmin(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return { error: unauthorized() };
  if (!payload.isGlobalAdmin) return { error: forbidden("仅限管理员") };
  return { payload };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  return withTenantContext(
    auth.payload.tenantId,
    auth.payload.isGlobalAdmin,
    async () => {
      const user = await db.user.findFirst({
        where: { id: params.id, tenantId: auth.payload.tenantId },
        include: {
          department: { select: { id: true, name: true } },
          grantedPermissions: {
            include: { permission: true },
          },
        },
      });

      if (!user) return notFound("用户不存在");

      // 脱敏返回
      const { passwordHash: _, ...safeUser } = user;
      return success({
        ...safeUser,
        permissions: user.grantedPermissions.map((up) => ({
          key: up.permission.key,
          label: up.permission.label,
          type: up.permission.type,
        })),
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

  return withTenantContext(
    auth.payload.tenantId,
    auth.payload.isGlobalAdmin,
    async () => {
      const user = await db.user.findFirst({
        where: { id: params.id, tenantId: auth.payload.tenantId },
      });
      if (!user) return notFound("用户不存在");

      const data: Record<string, unknown> = { ...parsed.data };
      if (data.password) {
        data.passwordHash = await bcrypt.hash(data.password as string, 12);
        delete data.password;
      }

      const updated = await db.user.update({
        where: { id: params.id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          isGlobalAdmin: true,
          departmentId: true,
          createdAt: true,
        },
      });

      return success(updated);
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

  return withTenantContext(
    auth.payload.tenantId,
    auth.payload.isGlobalAdmin,
    async () => {
      const user = await db.user.findFirst({
        where: { id: params.id, tenantId: auth.payload.tenantId },
      });
      if (!user) return notFound("用户不存在");

      await db.user.delete({ where: { id: params.id } });
      return noContent();
    }
  );
}
