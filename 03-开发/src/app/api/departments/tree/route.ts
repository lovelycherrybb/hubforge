// ============================================================
// GET /api/departments/tree — 部门树
// 权限要求：已认证用户
// ============================================================

import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

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
  departments: (DepartmentNode & { children?: DepartmentNode[] })[],
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
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return unauthorized();
  const payload = await verifyToken(token);
  if (!payload) return unauthorized("登录已过期");

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      const departments = await db.department.findMany({
        where: { tenantId: payload.tenantId },
        include: {
          _count: { select: { users: true } },
        },
        orderBy: { sortOrder: "asc" },
      });

      // 转换为树形结构
      const flat = departments.map((d) => ({
        id: d.id,
        name: d.name,
        parentId: d.parentId,
        sortOrder: d.sortOrder,
        userCount: d._count.users,
        children: [] as DepartmentNode[],
      }));

      const tree = buildTree(flat);
      return success(tree);
    }
  );
}
