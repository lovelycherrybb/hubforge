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

export interface FetchApiOptions extends RequestInit {
  /** 跳过 401 自动跳转登录页（用于登录接口自身） */
  noAuthRedirect?: boolean;
}

/**
 * 统一的 fetch 封装
 */
export async function fetchApi<T = unknown>(
  url: string,
  options?: FetchApiOptions
): Promise<T> {
  const { noAuthRedirect, ...fetchOptions } = options || {};
  const res = await fetch(url, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions?.headers,
    },
  });

  const json = await res.json();

  if (!res.ok) {
    if (res.status === 401 && !noAuthRedirect && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw json as ApiError;
  }

  return json as T;
}

/**
 * 便捷方法
 */
export const api = {
  get: <T = unknown>(url: string) => fetchApi<T>(url),

  post: <T = unknown>(url: string, body?: unknown, options?: FetchApiOptions) =>
    fetchApi<T>(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
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
