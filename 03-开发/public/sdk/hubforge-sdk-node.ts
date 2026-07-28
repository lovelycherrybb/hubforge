/**
 * HubForge Node.js SDK
 * 供嵌入式应用的服务端验证 Token、检查权限
 *
 * 用法：
 *   import { HubForgeClient } from './hubforge-sdk-node';
 *
 *   const hubforge = new HubForgeClient({
 *     portalUrl: 'https://portal.example.com',
 *     appSlug: 'my-app',
 *   });
 *
 *   // 在 Express/Koa/Next.js 中间件中验证 Token
 *   app.use(async (req, res, next) => {
 *     const token = req.headers['x-hubforge-token'] || req.query.token;
 *     if (!token) return res.status(401).json({ error: 'Missing token' });
 *
 *     const auth = await hubforge.verifyToken(token);
 *     if (!auth.valid) return res.status(401).json({ error: auth.error });
 *
 *     req.user = auth;
 *     next();
 *   });
 */

export interface AuthResult {
  valid: boolean;
  userId?: string;
  tenantId?: string;
  email?: string;
  name?: string;
  appSlug?: string;
  appId?: string;
  permissions?: string[];
  config?: Record<string, string>;
  expiresAt?: string;
  error?: string;
}

export interface HubForgeClientOptions {
  /** HubForge Portal 的 URL，如 https://portal.example.com */
  portalUrl: string;
  /** 当前应用的 slug */
  appSlug: string;
  /** 请求超时（毫秒），默认 5000 */
  timeout?: number;
}

export class HubForgeClient {
  private portalUrl: string;
  private appSlug: string;
  private timeout: number;

  constructor(options: HubForgeClientOptions) {
    this.portalUrl = options.portalUrl.replace(/\/+$/, "");
    this.appSlug = options.appSlug;
    this.timeout = options.timeout || 5000;
  }

  /**
   * 验证应用 Token
   * 调用 HubForge 的 /api/apps/verify-token 接口验证
   */
  async verifyToken(token: string): Promise<AuthResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.portalUrl}/api/apps/verify-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, appSlug: this.appSlug }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      if (!data.success) {
        return { valid: false, error: data.error || "验证失败" };
      }

      return data.data as AuthResult;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "网络错误";
      return { valid: false, error: message };
    }
  }

  /**
   * 本地解码 Token（不验证签名，仅用于读取信息）
   * 注意：不要用此方法做权限判断，仅用于调试或日志
   */
  decodeToken(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf-8")
      );
      return payload as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * 检查 Token 中的权限（本地检查，需要先 verifyToken）
   */
  hasPermission(authResult: AuthResult, permissionKey: string): boolean {
    if (!authResult.valid || !authResult.permissions) return false;
    return authResult.permissions.includes(permissionKey);
  }
}
