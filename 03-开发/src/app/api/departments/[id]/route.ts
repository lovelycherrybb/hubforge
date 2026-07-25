// ============================================================
// PUT    /api/departments/:id  — 更新部门
// DELETE /api/departments/:id  — 删除部门
// 权限要求：租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, noContent, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

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
  if (!payload.isGlobalAdmin) return forbidden("仅限管理员");

  const parsed = await parseBody(request, updateDepartmentSchema);
  if (!parsed.success) return error(parsed.error);

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      const dept = await db.department.findFirst({
        where: { id: params.id, tenantId: payload.tenantId },
      });
      if (!dept) return notFound("部门不存在");

      const updated = await db.department.update({
        where: { id: params.id },
        data: parsed.data,
      });

      return success(updated);
    }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限管理员");

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      const dept = await db.department.findFirst({
        where: { id: params.id, tenantId: payload.tenantId },
      });
      if (!dept) return notFound("部门不存在");

      // 检查是否有子部门
      const childCount = await db.department.count({
        where: { parentId: params.id },
      });
      if (childCount > 0) {
        return error("请先删除或移走子部门");
      }

      // 检查是否有用户
      const userCount = await db.user.count({
        where: { departmentId: params.id },
      });
      if (userCount > 0) {
        return error(`该部门下还有 ${userCount} 个用户，请先移除`);
      }

      await db.department.delete({ where: { id: params.id } });
      return noContent();
    }
  );
}
