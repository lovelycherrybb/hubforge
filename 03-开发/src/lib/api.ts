// ============================================================
// HubForge - 客户端 API 工具
// ============================================================

export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/**
 * 统一的 fetch 封装
 */
export async function fetchApi<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const json = await res.json();

  if (!res.ok) {
    throw json as ApiError;
  }

  return json as T;
}

/**
 * 便捷方法
 */
export const api = {
  get: <T = unknown>(url: string) => fetchApi<T>(url),

  post: <T = unknown>(url: string, body?: unknown) =>
    fetchApi<T>(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(url: string, body?: unknown) =>
    fetchApi<T>(url, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(url: string, body?: unknown) =>
    fetchApi<T>(url, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(url: string) =>
    fetchApi<T>(url, { method: "DELETE" }),
};
