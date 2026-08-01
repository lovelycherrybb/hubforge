// ============================================================
// POST /api/departments — 创建部门
// 权限要求：租户管理员（owner 或 admin）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized } from "@/lib/api-response";
import { withTenantContext, firstRow } from "@/lib/rls-pg";
import pg from "pg";

const createDepartmentSchema = z.object({
  name: z.string().min(1, "部门名称不能为空").max(100),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

/** 查询部门的 parentId（提取为独立函数打破 TS7022 循环推断） */
async function getParentId(client: pg.PoolClient, deptId: string): Promise<string | null> {
  const result = await client.query(
    'SELECT "parentId" FROM departments WHERE id = $1',
    [deptId]
  );
  const row = firstRow<{ parentId: string | null }>(result);
  return row?.parentId ?? null;
}

export async function POST(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "owner" && payload.role !== "admin")
    return forbidden("仅限管理员");

  const parsed = await parseBody(request, createDepartmentSchema);
  if (!parsed.success) return error(parsed.error);

  const isGlobalAdmin = payload.role === "owner";

  return withTenantContext(
    { tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin },
    async (client) => {
      const { name, parentId, sortOrder } = parsed.data;

      // 如果有父部门，检查层级限制
      if (parentId) {
        const tenantResult = await client.query(
          'SELECT "maxOrgLevels" FROM tenants WHERE id = $1',
          [payload.tenantId]
        );
        const tenant = firstRow<{ maxOrgLevels: number }>(tenantResult);
        if (!tenant) return error("租户不存在");

        let level = 1;
        let currentParentId: string | null = parentId;
        while (currentParentId) {
          const found = await client.query(
            'SELECT id FROM departments WHERE id = $1',
            [currentParentId]
          );
          if (!firstRow(found)) return error("父部门不存在");
          currentParentId = await getParentId(client, currentParentId);
          level++;
        }

        if (level >= tenant.maxOrgLevels) {
          return error(`组织层级不能超过 ${tenant.maxOrgLevels} 层`);
        }
      }

      const deptResult = await client.query(
        'INSERT INTO departments (id, name, "parentId", "sortOrder", "tenantId") VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING *',
        [name, parentId ?? null, sortOrder, payload.tenantId]
      );
      const department = firstRow(deptResult);

      return created(department);
    }
  );
}
