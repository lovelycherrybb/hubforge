// ============================================================
// GET  /api/apps — 应用列表（当前租户的应用）
// POST /api/apps — 注册应用
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { withTenantContext, firstRow, allRows, countValue } from "@/lib/rls-pg";
import { parseBody, parseQuery, paginationSchema } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized, paginated } from "@/lib/api-response";

const createAppSchema = z.object({
  name: z.string().min(1, "应用名称不能为空").max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "slug 只能包含小写字母、数字和连字符"),
  type: z.enum(["pc", "h5", "both"]).default("pc"),
  description: z.string().max(500).optional(),
  icon: z.string().url().optional(),
  url: z.string().url("应用 URL 格式不正确"),
});

const listQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
});

// GET — 获取当前租户的应用列表
export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  const parsed = parseQuery(request, listQuerySchema);
  if (!parsed.success) return error(parsed.error);
  const { page, pageSize, search, type, status } = parsed.data;

  const isAdmin = payload.role === "owner" || payload.role === "admin";

  return withTenantContext({ tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin: payload.role === "owner" }, async (client) => {
    // 构建 WHERE 子句
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 0;

    // tenantId
    idx++;
    conditions.push(`"tenantId" = $${idx}`);
    params.push(payload.tenantId);

    // status：管理员可按指定 status 过滤，普通成员只看 active
    if (isAdmin && status) {
      idx++;
      conditions.push(`status = $${idx}`);
      params.push(status);
    } else if (!isAdmin) {
      idx++;
      conditions.push(`status = $${idx}`);
      params.push("active");
    }

    // search：名称或描述模糊匹配
    if (search) {
      idx++;
      conditions.push(`("name" ILIKE $${idx} OR description ILIKE $${idx})`);
      params.push(`%${search}%`);
    }

    // type 过滤
    if (type) {
      idx++;
      conditions.push(`type = $${idx}`);
      params.push(type);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const offset = (page - 1) * pageSize;

    const [appsResult, totalResult] = await Promise.all([
      client.query(
        `SELECT * FROM apps ${whereClause} ORDER BY "createdAt" DESC LIMIT $${idx + 1} OFFSET $${idx + 2}`,
        [...params, pageSize, offset]
      ),
      client.query(
        `SELECT count(*) FROM apps ${whereClause}`,
        params
      ),
    ]);

    return paginated(allRows(appsResult), countValue(totalResult), page, pageSize);
  });
}

// POST — 注册新应用（需要 admin 或 owner 角色）
export async function POST(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "admin" && payload.role !== "owner") {
    return forbidden("需要管理员权限");
  }

  const parsed = await parseBody(request, createAppSchema);
  if (!parsed.success) return error(parsed.error);

  const { name, slug, type, description, icon, url } = parsed.data;

  return withTenantContext({ tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin: payload.role === "owner" }, async (client) => {
    // 检查 slug 在当前租户下唯一
    const existing = firstRow(
      await client.query(
        'SELECT id FROM apps WHERE slug = $1 AND "tenantId" = $2',
        [slug, payload.tenantId]
      )
    );
    if (existing) return error("该应用标识已存在");

    const app = firstRow(
      await client.query(
        `INSERT INTO apps (name, slug, type, description, icon, url, "tenantId", "createdBy")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [name, slug, type, description ?? null, icon ?? null, url, payload.tenantId, payload.userId]
      )
    );

    // 自动分配应用给当前租户
    await client.query(
      'INSERT INTO tenant_apps ("tenantId", "appId", enabled) VALUES ($1, $2, true)',
      [payload.tenantId, app!.id]
    );

    // 框架权限处理（取决于角色）
    const permKey = `app.${slug}.access`;

    if (payload.role === "owner") {
      // owner：创建全局框架权限 + 授予当前租户
      const existingPerm = firstRow(
        await client.query(
          'SELECT id FROM permissions WHERE key = $1 AND type = $2 AND "tenantId" IS NULL',
          [permKey, "framework"]
        )
      );
      if (!existingPerm) {
        const perm = firstRow(
          await client.query(
            `INSERT INTO permissions (key, label, type)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [permKey, `访问 ${name}`, "framework"]
          )
        );
        // 授予当前租户
        await client.query(
          'INSERT INTO tenant_permissions ("tenantId", "permissionId") VALUES ($1, $2)',
          [payload.tenantId, perm!.id]
        );
      } else {
        // 框架权限已存在，确保当前租户已获得授予
        const existingGrant = firstRow(
          await client.query(
            'SELECT id FROM tenant_permissions WHERE "tenantId" = $1 AND "permissionId" = $2',
            [payload.tenantId, existingPerm.id]
          )
        );
        if (!existingGrant) {
          await client.query(
            'INSERT INTO tenant_permissions ("tenantId", "permissionId") VALUES ($1, $2)',
            [payload.tenantId, existingPerm.id]
          );
        }
      }
    } else {
      // admin：不创建全局框架权限（应由 owner 管理）
      // 如果框架权限已存在，确保当前租户已获得授予
      const existingPerm = firstRow(
        await client.query(
          'SELECT id FROM permissions WHERE key = $1 AND type = $2 AND "tenantId" IS NULL',
          [permKey, "framework"]
        )
      );
      if (existingPerm) {
        const existingGrant = firstRow(
          await client.query(
            'SELECT id FROM tenant_permissions WHERE "tenantId" = $1 AND "permissionId" = $2',
            [payload.tenantId, existingPerm.id]
          )
        );
        if (!existingGrant) {
          await client.query(
            'INSERT INTO tenant_permissions ("tenantId", "permissionId") VALUES ($1, $2)',
            [payload.tenantId, existingPerm.id]
          );
        }
      }
      // 如果框架权限不存在，admin 无法创建——需要 owner 后续补充
    }

    return created(app);
  });
}
