// ============================================================
// HubForge - JWT 工具函数
// 使用 jose 库处理 JWT（Edge Runtime 兼容）
// ============================================================

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-do-not-use-in-production"
);

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
    .setExpirationTime("7d") // 7 天过期
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

export { COOKIE_NAME };
