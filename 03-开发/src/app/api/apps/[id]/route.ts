// GET    /api/apps/:id — 应用详情（需检查租户框架权限）
// PUT    /api/apps/:id — 更新应用
// DELETE /api/apps/:id — 删除应用
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import {
  success,
  error,
  noContent,
  forbidden,
  notFound,
  unauthorized,
} from "@/lib/api-response";

const updateAppSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["pc", "h5", "both"]).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().url().optional(),
  url: z.string().url().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  const app = await db.app.findUnique({
    where: { id: params.id },
  });
  if (!app) return notFound("应用不存在");

  // 检查应用是否属于当前租户
  if (app.tenantId !== payload.tenantId) {
    return forbidden("无权访问该应用");
  }

  // 框架权限检查：检查用户所在租户是否被授予 app.<slug>.access
  const frameworkPermKey = `app.${app.slug}.access`;
  const isGlobalAdmin = payload.role === "owner" || payload.role === "admin";

  if (!isGlobalAdmin) {
    const permission = await db.permission.findFirst({
      where: {
        key: frameworkPermKey,
        type: "framework",
        tenantId: null,
      },
    });

    if (permission) {
      const tenantGrant = await db.tenantPermission.findFirst({
        where: {
          tenantId: payload.tenantId,
          permissionId: permission.id,
        },
      });

      if (!tenantGrant) {
        return forbidden("租户未开通该应用的访问权限");
      }
    }
  }

  return success(app);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  // 需要 admin 或 owner 角色
  if (payload.role !== "admin" && payload.role !== "owner") {
    return forbidden("需要管理员权限");
  }

  const parsed = await parseBody(request, updateAppSchema);
  if (!parsed.success) return error(parsed.error);

  const app = await db.app.findUnique({ where: { id: params.id } });
  if (!app) return notFound("应用不存在");

  // 检查应用是否属于当前租户
  if (app.tenantId !== payload.tenantId) {
    return forbidden("无权修改该应用");
  }

  const updated = await db.app.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return success(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  // 需要 admin 或 owner 角色
  if (payload.role !== "admin" && payload.role !== "owner") {
    return forbidden("需要管理员权限");
  }

  const app = await db.app.findUnique({ where: { id: params.id } });
  if (!app) return notFound("应用不存在");

  // 检查应用是否属于当前租户
  if (app.tenantId !== payload.tenantId) {
    return forbidden("无权删除该应用");
  }

  await db.app.delete({ where: { id: params.id } });
  return noContent();
}
