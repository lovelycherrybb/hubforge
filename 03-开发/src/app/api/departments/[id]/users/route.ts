// ============================================================
// POST /api/departments/:id/users — 分配用户到部门
// 权限要求：租户管理员
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
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
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return unauthorized();
  const payload = await verifyToken(token);
  if (!payload) return unauthorized("登录已过期");
  if (!payload.isGlobalAdmin) return forbidden("仅限管理员");

  const parsed = await parseBody(request, assignUsersSchema);
  if (!parsed.success) return error(parsed.error);

  return withTenantContext(
    payload.tenantId,
    payload.isGlobalAdmin,
    async () => {
      const dept = await db.department.findFirst({
        where: { id: params.id, tenantId: payload.tenantId },
      });
      if (!dept) return notFound("部门不存在");

      // 批量更新用户的部门
      await db.user.updateMany({
        where: {
          id: { in: parsed.data.userIds },
          tenantId: payload.tenantId,
        },
        data: { departmentId: params.id },
      });

      return success(null, `已将 ${parsed.data.userIds.length} 个用户分配到 ${dept.name}`);
    }
  );
}
