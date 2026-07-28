// ============================================================
// POST /api/departments/:id/users — 分配用户到部门
// 权限要求：租户管理员（owner 或 admin）
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { withTenantContext } from "@/lib/rls";

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

  const isGlobalAdmin = payload.role === "owner" || payload.role === "admin";

  return withTenantContext(
    payload.tenantId,
    isGlobalAdmin,
    async () => {
      const dept = await db.department.findFirst({
        where: { id: params.id, tenantId: payload.tenantId },
      });
      if (!dept) return notFound("部门不存在");

      // 验证用户属于当前租户
      const memberships = await db.userTenant.findMany({
        where: {
          userId: { in: parsed.data.userIds },
          tenantId: payload.tenantId,
        },
        select: { userId: true },
      });
      const validUserIds = memberships.map((m) => m.userId);

      // 通过 UserOrganization 关联用户到部门
      let count = 0;
      for (const userId of validUserIds) {
        try {
          await db.userOrganization.upsert({
            where: {
              userId_organizationId: { userId, organizationId: params.id },
            },
            create: { userId, organizationId: params.id },
            update: {},
          });
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
