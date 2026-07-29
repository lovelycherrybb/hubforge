// ============================================================
// HubForge - Next.js 中间件
// 处理认证、租户识别、权限校验
// 运行在 Edge Runtime
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME, type TokenPayload } from "@/lib/auth";

/** 不需要认证的公开路径（前缀匹配） */
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/health",
  "/api/apps/verify-token",
  "/login",
  "/forgot-password",
  "/reset-password",
];

/** 不需要认证的公开路径（精确匹配） */
const PUBLIC_PATHS_EXACT = ["/", "/about"];

/** 需要主租户管理员权限的路径（owner 角色） */
const OWNER_PATHS = ["/api/tenants", "/admin/tenants"];

/**
 * 检查路径是否匹配公开路由
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS_EXACT.includes(pathname) || 
         PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * 检查路径是否需要 owner 权限
 */
function isOwnerPath(pathname: string): boolean {
  return OWNER_PATHS.some((path) => pathname.startsWith(path));
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
    pathname.startsWith("/logo") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.startsWith("/sdk/") ||
    isPublicPath(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. 认证中间件 - 解析 JWT
  const tokenPayload = await extractToken(request);

  // 已登录用户访问登录/注册/忘记密码页 → 重定向到首页
  const AUTH_PAGES = ["/login", "/register", "/forgot-password"];
  if (tokenPayload && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

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
    requestHeaders.set("x-user-role", tokenPayload.role || "member");
  }

  // 4. 权限中间件 - owner 路由检查
  if (isOwnerPath(pathname) && tokenPayload) {
    const isOwner = tokenPayload.role === "owner";

    // 仅限 owner 角色
    if (!isOwner) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "仅限主租户管理员" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
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
