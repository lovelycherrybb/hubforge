// ============================================================
// POST /api/apps/[id]/register-permissions — 应用注册权限声明
// 应用通过此接口声明自己需要哪些权限，HubForge 自动创建权限定义
// 权限要求：admin 或 owner 角色
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, notFound, unauthorized } from "@/lib/api-response";

const permissionDeclareSchema = z.object({
  permissions: z
    .array(
      z.object({
        key: z
          .string()
          .min(1)
          .max(100)
          .regex(
            /^[a-z][a-z0-9._-]*$/,
            "权限 key 只能包含小写字母、数字、点、下划线和连字符"
          ),
        label: z.string().min(1).max(255),
      })
    )
    .min(1, "至少声明一个权限")
    .max(50, "单次最多声明 50 个权限"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "admin" && payload.role !== "owner") {
    return forbidden("需要管理员权限");
  }

  const app = await db.app.findUnique({ where: { id: params.id } });
  if (!app) return notFound("应用不存在");

  // 只能给自己租户的应用注册权限
  if (app.tenantId !== payload.tenantId) {
    return forbidden("不能操作其他租户的应用");
  }

  const parsed = await parseBody(request, permissionDeclareSchema);
  if (!parsed.success) return error(parsed.error);

  const { permissions } = parsed.data;
  const results: { key: string; label: string; status: "created" | "exists" }[] = [];

  for (const perm of permissions) {
    // 检查是否已存在
    const existing = await db.permission.findFirst({
      where: {
        key: perm.key,
        appId: app.id,
      },
    });

    if (existing) {
      if (existing.label !== perm.label) {
        await db.permission.update({
          where: { id: existing.id },
          data: { label: perm.label },
        });
      }
      results.push({ key: perm.key, label: perm.label, status: "exists" });
    } else {
      await db.permission.create({
        data: {
          key: perm.key,
          label: perm.label,
          type: "app",
          appId: app.id,
          tenantId: payload.tenantId,
        },
      });
      results.push({ key: perm.key, label: perm.label, status: "created" });
    }
  }

  return success({
    appId: app.id,
    appSlug: app.slug,
    permissions: results,
    summary: {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      exists: results.filter((r) => r.status === "exists").length,
    },
  });
}
