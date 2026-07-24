// ============================================================
// HubForge - 请求验证工具
// 使用 Zod 进行请求体/查询参数验证
// ============================================================

import { z } from "zod";
import { NextRequest } from "next/server";

/**
 * 解析并验证请求 JSON body
 * @param request - Next.js 请求对象
 * @param schema - Zod schema
 * @returns 验证结果
 */
export async function parseBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (result.success) {
      return { success: true, data: result.data };
    }
    const errorMessages = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { success: false, error: errorMessages };
  } catch {
    return { success: false, error: "请求体格式错误" };
  }
}

/**
 * 解析 URL 查询参数
 * @param request - Next.js 请求对象
 * @param schema - Zod schema
 * @returns 验证结果
 */
export function parseQuery<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const { searchParams } = new URL(request.url);
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const result = schema.safeParse(params);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { success: false, error: errorMessages };
}

// ============================================================
// 通用 Schema 定义
// ============================================================

/** 分页查询参数 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** ID 参数 */
export const idParamSchema = z.object({
  id: z.string().min(1, "ID 不能为空"),
});
