// ============================================================
// HubForge - Lib/Auth 单元测试
// 测试 JWT 签发、验证、过期逻辑
// ============================================================

import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '@/lib/auth';

describe('JWT 工具函数', () => {
  // ============================================================
  // signToken 测试
  // ============================================================
  describe('signToken — 签发 JWT', () => {
    it('签发的 JWT 包含正确的字段', async () => {
      // 准备：构造 payload
      const payload = {
        userId: 'user-001',
        tenantId: 'tenant-001',
        email: 'admin@test.com',
        isGlobalAdmin: true,
      };

      // 执行
      const token = await signToken(payload);

      // 验证：token 是非空字符串，格式为 xxx.yyy.zzz
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('签发的 JWT 验证后包含正确的 payload 字段', async () => {
      const payload = {
        userId: 'user-002',
        tenantId: 'tenant-002',
        email: 'user@test.com',
        isGlobalAdmin: false,
      };

      const token = await signToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe('user-002');
      expect(decoded!.tenantId).toBe('tenant-002');
      expect(decoded!.email).toBe('user@test.com');
      expect(decoded!.isGlobalAdmin).toBe(false);
    });

    it('签发的 JWT 包含 iat 和 exp 字段', async () => {
      const payload = {
        userId: 'user-003',
        tenantId: 'tenant-003',
        email: 'test@test.com',
        isGlobalAdmin: false,
      };

      const token = await signToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded!.iat).toBeDefined();
      expect(decoded!.exp).toBeDefined();
      // exp 应大于 iat（有效期 24h）
      expect(decoded!.exp!).toBeGreaterThan(decoded!.iat!);
    });
  });

  // ============================================================
  // verifyToken 测试
  // ============================================================
  describe('verifyToken — 验证 JWT', () => {
    it('验证有效 JWT 返回 payload', async () => {
      const payload = {
        userId: 'user-valid',
        tenantId: 'tenant-valid',
        email: 'valid@test.com',
        isGlobalAdmin: true,
      };

      const token = await signToken(payload);
      const result = await verifyToken(token);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-valid');
      expect(result!.tenantId).toBe('tenant-valid');
    });

    it('验证无效 JWT 返回 null', async () => {
      const result = await verifyToken('invalid.token.string');
      expect(result).toBeNull();
    });

    it('验证被篡改的 JWT 返回 null', async () => {
      const token = await signToken({
        userId: 'user-tamper',
        tenantId: 'tenant-tamper',
        email: 'tamper@test.com',
        isGlobalAdmin: false,
      });

      // 篡改 payload 部分
      const parts = token.split('.');
      const tamperedPayload = Buffer.from('{"userId":"hacked"}').toString('base64url');
      const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const result = await verifyToken(tampered);
      expect(result).toBeNull();
    });

    it('验证过期 JWT 返回 null', async () => {
      // 使用 jose 签发一个已过期的 token
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production'
      );

      const expiredToken = await new SignJWT({
        userId: 'user-expired',
        tenantId: 'tenant-expired',
        email: 'expired@test.com',
        isGlobalAdmin: false,
      } as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('0s') // 立即过期
        .sign(secret);

      // 等待一小段时间确保过期
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await verifyToken(expiredToken);
      expect(result).toBeNull();
    });
  });
});
