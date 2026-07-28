// ============================================================
// HubForge - 输入校验工具测试
// 测试 parseBody / parseQuery 正反向用例
// ============================================================

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseBody, parseQuery, paginationSchema } from '@/lib/validate';

// ============================================================
// parseBody — 请求体校验
// ============================================================
describe('parseBody — 请求体校验', () => {
  const testSchema = z.object({
    name: z.string().min(1, '名称不能为空'),
    age: z.number().int().min(0),
  });

  it('合法 JSON body → 返回 success + data', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '张三', age: 25 }),
    }) as any;

    const result = await parseBody(request, testSchema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('张三');
      expect(result.data.age).toBe(25);
    }
  });

  it('字段缺失 → 返回 success:false + error', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ age: 25 }),
    }) as any;

    const result = await parseBody(request, testSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('name');
    }
  });

  it('字段类型错误 → 返回 success:false', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '张三', age: '不是数字' }),
    }) as any;

    const result = await parseBody(request, testSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('age');
    }
  });

  it('空字符串字段 → 返回 success:false', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', age: 25 }),
    }) as any;

    const result = await parseBody(request, testSchema);

    expect(result.success).toBe(false);
  });

  it('非法 JSON（非 JSON 格式）→ 返回 success:false', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '这不是JSON',
    }) as any;

    const result = await parseBody(request, testSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('请求体格式错误');
    }
  });
});

// ============================================================
// parseQuery — 查询参数校验
// ============================================================
describe('parseQuery — 分页参数校验', () => {
  it('合法分页参数 → 返回解析后的数值', () => {
    const request = new Request('http://localhost/api/test?page=2&pageSize=10', {
      method: 'GET',
    }) as any;

    const result = parseQuery(request, paginationSchema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it('无分页参数 → 使用默认值', () => {
    const request = new Request('http://localhost/api/test', {
      method: 'GET',
    }) as any;

    const result = parseQuery(request, paginationSchema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('page=0 → 校验失败（最小值为 1）', () => {
    const request = new Request('http://localhost/api/test?page=0', {
      method: 'GET',
    }) as any;

    const result = parseQuery(request, paginationSchema);

    expect(result.success).toBe(false);
  });

  it('pageSize 超过 100 → 校验失败', () => {
    const request = new Request('http://localhost/api/test?pageSize=200', {
      method: 'GET',
    }) as any;

    const result = parseQuery(request, paginationSchema);

    expect(result.success).toBe(false);
  });

  it('pageSize 为负数 → 校验失败', () => {
    const request = new Request('http://localhost/api/test?pageSize=-1', {
      method: 'GET',
    }) as any;

    const result = parseQuery(request, paginationSchema);

    expect(result.success).toBe(false);
  });
});
