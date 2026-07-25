// ============================================================
// POST /api/departments — 创建部门
// 权限要求：租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, created, error, forbidden, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

const createDepartmentSchema = z.object({
  name: z.string().min(1, "部门名称不能为空").max(100),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export async function POST(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload) return unauthorized();
  if (!payload.isGlobalAdmin) return forbidden("仅限管理员");

  const parsed = await parseBody(request, createDepartmentSchema);
  if (!parsed.success) return error(parsed.error);

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      const { name, parentId, sortOrder } = parsed.data;

      // 如果有父部门，检查层级限制
      if (parentId) {
        const tenant = await db.tenant.findUnique({
          where: { id: payload.tenantId },
        });
        if (!tenant) return error("租户不存在");

        let level = 1;
        let currentParentId: string | null = parentId;
        while (currentParentId) {
          const parent: { id: string; parentId: string | null } | null =
            await db.department.findUnique({
              where: { id: currentParentId },
            });
          if (!parent) return error("父部门不存在");
          currentParentId = parent.parentId;
          level++;
        }

        if (level >= tenant.quotaOrgLevels) {
          return error(`组织层级不能超过 ${tenant.quotaOrgLevels} 层`);
        }
      }

      const department = await db.department.create({
        data: {
          name,
          parentId,
          sortOrder,
          tenantId: payload.tenantId,
        },
      });

      return created(department);
    }
  );
}
