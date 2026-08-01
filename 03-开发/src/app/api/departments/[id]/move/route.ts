// ============================================================
// PUT /api/departments/:id/move — 移动部门（变更父级）
// 权限要求：租户管理员（owner 或 admin）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { withTenantContext, firstRow } from "@/lib/rls-pg";
import pg from "pg";

const moveDepartmentSchema = z.object({
  parentId: z.string().nullable(), // null 表示移到根级别
});

/** 查询部门的 id 和 parentId（提取为独立函数打破 TS7022 循环推断） */
async function getDeptParent(
  client: pg.PoolClient,
  deptId: string
): Promise<{ id: string; parentId: string | null } | null> {
  const result = await client.query(
    'SELECT id, "parentId" FROM departments WHERE id = $1',
    [deptId]
  );
  return firstRow<{ id: string; parentId: string | null }>(result);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "owner" && payload.role !== "admin")
    return forbidden("仅限管理员");

  const parsed = await parseBody(request, moveDepartmentSchema);
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

      const { parentId } = parsed.data;

      // 不能移动到自己下面
      if (parentId === params.id) {
        return error("不能将部门移动到自身下");
      }

      // 不能移动到自己的子孙节点下
      if (parentId) {
        let currentParentId: string | null = parentId;
        while (currentParentId) {
          if (currentParentId === params.id) {
            return error("不能将部门移动到其子孙节点下");
          }
          const parent = await getDeptParent(client, currentParentId);
          if (!parent) return error("目标父部门不存在");
          currentParentId = parent.parentId;
        }
      }

      const updatedResult = await client.query(
        'UPDATE departments SET "parentId" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *',
        [parentId, params.id]
      );

      return success(firstRow(updatedResult), "部门已移动");
    }
  );
}
