// ============================================================
// HubForge - 统一 API 响应格式
// ============================================================

import { NextResponse } from "next/server";

/** 标准 API 响应结构 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** 分页响应结构 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** 成功响应 */
export function success<T>(data: T, message?: string, status = 200) {
  return NextResponse.json(
    { success: true, data, message } satisfies ApiResponse<T>,
    { status }
  );
}

/** 创建成功响应 */
export function created<T>(data: T, message = "创建成功") {
  return success(data, message, 201);
}

/** 无内容响应 */
export function noContent() {
  return new NextResponse(null, { status: 204 });
}

/** 错误响应 */
export function error(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message } satisfies ApiResponse,
    { status }
  );
}

/** 未授权响应 */
export function unauthorized(message = "请先登录") {
  return error(message, 401);
}

/** 禁止访问响应 */
export function forbidden(message = "权限不足") {
  return error(message, 403);
}

/** 资源未找到响应 */
export function notFound(message = "资源不存在") {
  return error(message, 404);
}

/** 分页响应 */
export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  } satisfies PaginatedResponse<T>);
}
