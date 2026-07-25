// ============================================================
// PUT /api/departments/:id/move — 移动部门（变更父级）
// 权限要求：租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

const moveDepartmentSchema = z.object({
  parentId: z.string().nullable(), // null 表示移到根级别
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限管理员");

  const parsed = await parseBody(request, moveDepartmentSchema);
  if (!parsed.success) return error(parsed.error);

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      const dept = await db.department.findFirst({
        where: { id: params.id, tenantId: payload.tenantId },
      });
      if (!dept) return notFound("部门不存在");

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
          const parent: { id: string; parentId: string | null } | null =
            await db.department.findUnique({
              where: { id: currentParentId },
            });
          if (!parent) return error("目标父部门不存在");
          currentParentId = parent.parentId;
        }
      }

      const updated = await db.department.update({
        where: { id: params.id },
        data: { parentId },
      });

      return success(updated, "部门已移动");
    }
  );
}
