// ============================================================
// HubForge - JWT 工具函数
// 使用 jose 库处理 JWT（Edge Runtime 兼容）
// ============================================================

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { NextRequest } from "next/server";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET 环境变量未设置，服务无法启动");
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const COOKIE_NAME = process.env.COOKIE_NAME || "hubforge-token";

/** JWT 中携带的用户信息 */
export interface TokenPayload extends JWTPayload {
  userId: string;
  tenantId: string;
  email: string;
  isGlobalAdmin: boolean;
}

/**
 * 签发 JWT
 * @param payload - 要写入 token 的用户信息
 * @returns 签名后的 JWT 字符串
 */
export async function signToken(payload: Omit<TokenPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

/**
 * 验证并解码 JWT
 * @param token - JWT 字符串
 * @returns 解码后的 payload，验证失败返回 null
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * 从请求中提取并验证当前用户
 * @param request - Next.js 请求对象
 * @returns 解码后的 payload，未认证返回 null
 */
export async function getAuthUser(request: NextRequest): Promise<TokenPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Cookie 配置（登录时使用）
 */
export function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 86400, // 24 小时
    path: "/",
  };
}

export { COOKIE_NAME };
