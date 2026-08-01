// ============================================================
// GET /api/apps/:id/token — 为嵌入式应用签发 Token
// 权限要求：已认证用户 + 有权访问该应用
// Token 有效期 1 小时，包含用户身份和权限信息
// ============================================================

import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { getAuthUser, JWT_SECRET } from "@/lib/auth";
import { withTenantContext, firstRow, allRows } from "@/lib/rls-pg";
import { success, error, forbidden, notFound, unauthorized } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  return withTenantContext({ tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin: payload.role === "owner" }, async (client) => {
    const app = firstRow<{ id: string; slug: string; config: Record<string, unknown> | null }>(
      await client.query("SELECT * FROM apps WHERE id = $1", [params.id])
    );
    if (!app) return notFound("应用不存在");

    // 检查应用访问权限（框架级）
    if (payload.role !== "owner") {
      const permKey = `app.${app.slug}.access`;
      const perm = firstRow(
        await client.query(
          `SELECT * FROM permissions
           WHERE key = $1
             AND ((type = $2 AND "tenantId" IS NULL) OR "tenantId" = $3)
           LIMIT 1`,
          [permKey, "framework", payload.tenantId]
        )
      );

      // 默认拒绝：框架权限记录不存在时拒绝访问
      if (!perm) {
        return forbidden("该应用未配置访问权限");
      }

      const userPerm = firstRow(
        await client.query(
          'SELECT id FROM user_permissions WHERE "userId" = $1 AND "tenantId" = $2 AND "permissionId" = $3',
          [payload.userId, payload.tenantId, perm.id]
        )
      );
      if (!userPerm) return forbidden("无权访问该应用");
    }

    // 获取用户的应用级权限（JOIN user_permissions 取用户已授予的）
    const appPermissionsResult = await client.query(
      `SELECT p.id, p.key, p.label, p.type
       FROM permissions p
       INNER JOIN user_permissions up
         ON up."permissionId" = p.id
        AND up."userId" = $1
        AND up."tenantId" = $2
       WHERE p.type = $3
         AND p."appId" = $4
         AND p."tenantId" = $2`,
      [payload.userId, payload.tenantId, "app", app.id]
    );
    const userPermKeys = allRows<{ key: string }>(appPermissionsResult).map((p) => p.key);

    // 获取用户信息
    const user = firstRow<{ name: string; email: string }>(
      await client.query('SELECT name, email FROM users WHERE id = $1', [payload.userId])
    );

    // 合并权限去重
    const permSet = new Set<string>(userPermKeys);
    const allPermKeys = Array.from(permSet);

    // 从 app.config (Json 字段) 获取应用配置
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
      .sign(JWT_SECRET);

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
  });
}
