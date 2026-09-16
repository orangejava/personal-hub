import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertSameOrigin } from '../src/modules/auth/origin';

const USER_ORIGIN = 'http://localhost:8000';
const ADMIN_ORIGIN = 'http://localhost:8001';
const ALLOWED = [USER_ORIGIN, ADMIN_ORIGIN];

describe('assertSameOrigin', () => {
  it('允许用户端 Origin', () => {
    expect(() => assertSameOrigin(USER_ORIGIN, undefined, ALLOWED)).not.toThrow();
  });

  it('允许管理端 Origin', () => {
    expect(() => assertSameOrigin(ADMIN_ORIGIN, undefined, ALLOWED)).not.toThrow();
  });

  it('Origin 缺失时回退 Referer 的 origin', () => {
    expect(() =>
      assertSameOrigin(undefined, `${USER_ORIGIN}/workspace`, ALLOWED),
    ).not.toThrow();
  });

  it('代理改写 Origin 后，只要 Referer 仍是前端页就放行', () => {
    expect(() =>
      assertSameOrigin(
        'http://127.0.0.1:3001',
        `${ADMIN_ORIGIN}/admin/dashboard`,
        ALLOWED,
      ),
    ).not.toThrow();
  });

  it('代理改写后的 Origin 与白名单不一致且没有合法 Referer 时拒绝', () => {
    try {
      assertSameOrigin('http://127.0.0.1:3001', undefined, ALLOWED);
      throw new Error('应当抛出 AUTH_ORIGIN_FORBIDDEN');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const body = (error as HttpException).getResponse() as {
        code: string;
        details: Array<{ received: string; allowed: string[] }>;
      };
      expect(body.code).toBe('AUTH_ORIGIN_FORBIDDEN');
      expect(body.details[0]).toEqual({
        received: 'http://127.0.0.1:3001',
        allowed: ALLOWED,
      });
    }
  });
});
