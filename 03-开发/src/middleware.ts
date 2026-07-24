// ============================================================
// HubForge - Next.js 中间件
// 处理认证、租户识别、权限校验
// 运行在 Edge Runtime
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME, type TokenPayload } from "@/lib/auth";

/** 不需要认证的公开路径 */
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

/** 需要全局管理员权限的路径 */
const ADMIN_PATHS = ["/api/tenants", "/admin"];

/**
 * 检查路径是否匹配公开路由
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * 检查路径是否为管理员路由
 */
function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * 从请求中提取并验证 JWT
 */
async function extractToken(
  request: NextRequest
): Promise<TokenPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 静态资源和公开路径直接放行
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    isPublicPath(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. 认证中间件 - 解析 JWT
  const tokenPayload = await extractToken(request);

  // API 路由：未认证返回 401
  if (pathname.startsWith("/api/") && !tokenPayload) {
    return NextResponse.json(
      { success: false, error: "请先登录" },
      { status: 401 }
    );
  }

  // 页面路由：未认证重定向到登录页
  if (!pathname.startsWith("/api/") && !tokenPayload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. 租户中间件 - 注入租户信息到请求头
  const requestHeaders = new Headers(request.headers);
  if (tokenPayload) {
    requestHeaders.set("x-tenant-id", tokenPayload.tenantId);
    requestHeaders.set("x-user-id", tokenPayload.userId);
    requestHeaders.set("x-user-email", tokenPayload.email);
    requestHeaders.set(
      "x-is-global-admin",
      String(tokenPayload.isGlobalAdmin)
    );
  }

  // 4. 权限中间件 - 管理员路由检查
  if (isAdminPath(pathname) && tokenPayload && !tokenPayload.isGlobalAdmin) {
    // API 路由返回 403
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "权限不足" },
        { status: 403 }
      );
    }
    // 页面路由重定向到首页
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 5. 继续处理请求，附加自定义头
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static（静态文件）
     * - _next/image（图片优化）
     * - favicon.ico（网站图标）
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
