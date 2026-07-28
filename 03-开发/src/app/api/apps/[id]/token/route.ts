// ============================================================
// GET /api/apps/:id/token — 为嵌入式应用签发 Token
// 权限要求：已认证用户 + 有权访问该应用
// Token 有效期 1 小时，包含用户身份和权限信息
// ============================================================

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { success, error, forbidden, notFound, unauthorized } from "@/lib/api-response";

const APP_TOKEN_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-do-not-use-in-production"
);

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

  // 检查应用访问权限（框架级）
  if (payload.role !== "owner") {
    const permKey = `app.${app.slug}.access`;
    const perm = await db.permission.findFirst({
      where: {
        key: permKey,
        OR: [
          { type: "framework", tenantId: null },
          { tenantId: payload.tenantId },
        ],
      },
    });

    if (perm) {
      const userPerm = await db.userPermission.findFirst({
        where: {
          userId: payload.userId,
          tenantId: payload.tenantId,
          permissionId: perm.id,
        },
      });
      if (!userPerm) return forbidden("无权访问该应用");
    }
  }

  // 获取用户的应用级权限
  const appPermissions = await db.permission.findMany({
    where: {
      type: "app",
      appId: app.id,
      tenantId: payload.tenantId,
    },
    include: {
      userGrants: {
        where: { userId: payload.userId, tenantId: payload.tenantId },
      },
    },
  });

  const userPermKeys = appPermissions
    .filter((p) => p.userGrants.length > 0)
    .map((p) => p.key);

  // 获取用户信息
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { name: true, email: true },
  });

  // 合并权限去重
  const permSet = new Set<string>(userPermKeys);
  const allPermKeys = Array.from(permSet);

  // 从 App.config (Json 字段) 获取应用配置
  const config: Record<string, string> = {};
  if (app.config && typeof app.config === "object") {
    Object.assign(config, app.config);
  }

  // 签发应用 Token
  const appToken = await new SignJWT({
    sub: payload.userId,
    userId: payload.userId,
    tenantId: payload.tenantId,
    email: payload.email,
    name: user?.name || "",
    appSlug: app.slug,
    appId: app.id,
    permissions: allPermKeys,
    config,
  } as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .setIssuer("hubforge")
    .setAudience(app.slug)
    .sign(APP_TOKEN_SECRET);

  return success({
    token: appToken,
    user: {
      id: payload.userId,
      email: payload.email,
      name: user?.name || "",
      tenantId: payload.tenantId,
    },
    permissions: allPermKeys,
    config,
  });
}
