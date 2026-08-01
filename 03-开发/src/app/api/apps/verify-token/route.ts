// ============================================================
// POST /api/apps/verify-token — 验证应用 Token（供嵌入式应用的服务端调用）
// 公开端点，无需 HubForge 认证
// 请求体: { token: string, appSlug: string }
// 返回: 解码后的用户信息和权限
// ============================================================

import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { z } from "zod";
import { JWT_SECRET } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";

const verifySchema = z.object({
  token: z.string().min(1),
  appSlug: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, verifySchema);
  if (!parsed.success) return error(parsed.error);

  const { token, appSlug } = parsed.data;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: "hubforge",
      audience: appSlug,
    });

    return success({
      valid: true,
      userId: payload.userId as string,
      tenantId: payload.tenantId as string,
      email: payload.email as string,
      name: payload.name as string,
      appSlug: payload.appSlug as string,
      appId: payload.appId as string,
      permissions: (payload.permissions as string[]) || [],
      config: (payload.config as Record<string, string>) || {},
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Token 验证失败";
    return success({ valid: false, error: message });
  }
}
