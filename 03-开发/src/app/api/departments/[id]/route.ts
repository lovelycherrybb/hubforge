// ============================================================
// PUT    /api/departments/:id  — 更新部门
// DELETE /api/departments/:id  — 删除部门
// 权限要求：租户管理员（owner 或 admin）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, noContent, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { withTenantContext, firstRow, countValue } from "@/lib/rls-pg";

const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "owner" && payload.role !== "admin")
    return forbidden("仅限管理员");

  const parsed = await parseBody(request, updateDepartmentSchema);
  if (!parsed.success) return error(parsed.error);

  const isGlobalAdmin = payload.role === "owner";

  return withTenantContext(
    { tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin },
    async (client) => {
      const deptResult = await client.query(
        'SELECT * FROM departments WHERE id = $1 AND "tenantId" = $2 LIMIT 1',
        [params.id, payload.tenantId]
      );
      if (!firstRow(deptResult)) return notFound("部门不存在");

      // 动态构建 SET 子句
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (parsed.data.name !== undefined) {
        setClauses.push(`name = $${idx++}`);
        values.push(parsed.data.name);
      }
      if (parsed.data.sortOrder !== undefined) {
        setClauses.push(`"sortOrder" = $${idx++}`);
        values.push(parsed.data.sortOrder);
      }

      // 如果没有可更新字段，直接返回当前记录
      if (setClauses.length === 0) {
        return success(firstRow(deptResult));
      }

      setClauses.push(`"updatedAt" = NOW()`);
      values.push(params.id);

      const updatedResult = await client.query(
        `UPDATE departments SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );

      return success(firstRow(updatedResult));
    }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "owner" && payload.role !== "admin")
    return forbidden("仅限管理员");

  const isGlobalAdmin = payload.role === "owner";

  return withTenantContext(
    { tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin },
    async (client) => {
      const deptResult = await client.query(
        'SELECT * FROM departments WHERE id = $1 AND "tenantId" = $2 LIMIT 1',
        [params.id, payload.tenantId]
      );
      if (!firstRow(deptResult)) return notFound("部门不存在");

      // 检查是否有子部门
      const childResult = await client.query(
        'SELECT count(*) FROM departments WHERE "parentId" = $1',
        [params.id]
      );
      const childCount = countValue(childResult);
      if (childCount > 0) {
        return error("请先删除或移走子部门");
      }

      // 检查是否有用户（通过 UserOrganization）
      const userResult = await client.query(
        'SELECT count(*) FROM user_organizations WHERE "organizationId" = $1',
        [params.id]
      );
      const userCount = countValue(userResult);
      if (userCount > 0) {
        return error(`该部门下还有 ${userCount} 个用户，请先移除`);
      }

      await client.query('DELETE FROM departments WHERE id = $1', [params.id]);
      return noContent();
    }
  );
}
