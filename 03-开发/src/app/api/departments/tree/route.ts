// ============================================================
// GET /api/departments/tree — 部门树
// 权限要求：已认证用户
// ============================================================

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";
import { withTenantContext, allRows } from "@/lib/rls-pg";

interface DepartmentNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  userCount: number;
  children: DepartmentNode[];
}

/** 递归构建部门树 */
function buildTree(
  departments: DepartmentNode[],
  parentId: string | null = null
): DepartmentNode[] {
  return departments
    .filter((d) => d.parentId === parentId)
    .map((d) => ({
      ...d,
      children: buildTree(departments, d.id),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function GET(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();

  const isGlobalAdmin = payload.role === "owner";

  return withTenantContext(
    { tenantId: payload.tenantId, userId: payload.userId, isGlobalAdmin },
    async (client) => {
      const departmentsResult = await client.query(
        `SELECT d.id, d.name, d."parentId", d."sortOrder",
                coalesce(uc.cnt, 0)::int AS "userCount"
         FROM departments d
         LEFT JOIN (
           SELECT "organizationId", count(*) AS cnt
           FROM user_organizations
           GROUP BY "organizationId"
         ) uc ON uc."organizationId" = d.id
         WHERE d."tenantId" = $1
         ORDER BY d."sortOrder" ASC, d.id ASC`,
        [payload.tenantId]
      );

      const flat = allRows<DepartmentNode>(departmentsResult).map((d) => ({
        ...d,
        children: [] as DepartmentNode[],
      }));

      const tree = buildTree(flat);
      return success(tree);
    }
  );
}
