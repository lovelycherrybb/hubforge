// ============================================================
// POST /api/departments/:id/users — 分配用户到部门
// 权限要求：租户管理员（owner 或 admin）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { withTenantContext, firstRow, allRows } from "@/lib/rls-pg";

const assignUsersSchema = z.object({
  userIds: z.array(z.string()).min(1, "至少选择一个用户"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "owner" && payload.role !== "admin")
    return forbidden("仅限管理员");

  const parsed = await parseBody(request, assignUsersSchema);
  if (!parsed.success) return error(parsed.error);

  const isGlobalAdmin = payload.role === "owner";

  return withTenantContext(
    { tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin },
    async (client) => {
      const deptResult = await client.query(
        'SELECT * FROM departments WHERE id = $1 AND "tenantId" = $2 LIMIT 1',
        [params.id, payload.tenantId]
      );
      const dept = firstRow<{ id: string; name: string }>(deptResult);
      if (!dept) return notFound("部门不存在");

      // 验证用户属于当前租户
      const membershipsResult = await client.query(
        'SELECT "userId" FROM user_tenants WHERE "userId" = ANY($1) AND "tenantId" = $2',
        [parsed.data.userIds, payload.tenantId]
      );
      const memberships = allRows<{ userId: string }>(membershipsResult);
      const validUserIds = memberships.map((m) => m.userId);

      // 通过 UserOrganization 关联用户到部门（upsert）
      let count = 0;
      for (const userId of validUserIds) {
        try {
          await client.query(
            `INSERT INTO user_organizations (id, "userId", "organizationId", "isPrimary")
             VALUES (gen_random_uuid(), $1, $2, true)
             ON CONFLICT ("userId", "organizationId") DO NOTHING`,
            [userId, params.id]
          );
          count++;
        } catch {
          // 跳过重复
        }
      }

      return success(
        { updatedCount: count },
        `已将 ${count} 个用户分配到 ${dept.name}`
      );
    }
  );
}
