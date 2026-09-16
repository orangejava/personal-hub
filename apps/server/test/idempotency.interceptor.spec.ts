import { HttpStatus, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { IdempotencyRecordState } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { lastValueFrom, of, throwError } from 'rxjs';
import {
  IdempotencyInterceptor,
  stableJsonStringify,
} from '../src/common/idempotency/idempotency.interceptor';
import type { IdempotencyRepository } from '../src/common/idempotency/idempotency.repository';

describe('IdempotencyInterceptor', () => {
  it('为语义相同但字段顺序不同的 JSON 生成相同指纹', () => {
    expect(
      stableJsonStringify({
        payload: { title: '文章', tags: ['Nest', 'Prisma'] },
        version: 2,
      }),
    ).toBe(
      stableJsonStringify({
        version: 2,
        payload: { tags: ['Nest', 'Prisma'], title: '文章' },
      }),
    );
  });

  it('普通写记录保留二十四小时', async () => {
    const { interceptor, records, handler } = interceptorFor({});
    await lastValueFrom(interceptor.intercept(contextFor({ version: 3 }), handler));
    const claimInput = vi.mocked(records.claim).mock.calls[0]?.[0];
    const remaining = (claimInput?.expiresAt.getTime() ?? 0) - Date.now();
    expect(remaining).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(remaining).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it('先 claim 再执行业务，高风险记录保留七天', async () => {
    const { interceptor, records, handler } = interceptorFor({ highRisk: true });
    await lastValueFrom(interceptor.intercept(contextFor({ version: 3 }), handler));

    expect(handler.handle).toHaveBeenCalledOnce();
    const claimInput = vi.mocked(records.claim).mock.calls[0]?.[0];
    expect(claimInput).toMatchObject({
      subjectType: 'user',
      subjectIdOrHash: 'user-1',
      httpMethod: 'PUT',
      idempotencyKey: 'key-1',
    });
    expect((claimInput?.expiresAt.getTime() ?? 0) - Date.now()).toBeGreaterThan(
      6 * 24 * 60 * 60 * 1000,
    );
    expect(vi.mocked(records.complete)).toHaveBeenCalledOnce();
  });

  it('同指纹处理中时等待完成后回放，不再进入业务层', async () => {
    const fingerprint = hashFromBody(stableJsonStringify({ version: 3 }));
    const records = {
      claim: vi.fn().mockResolvedValue({
        kind: 'existing',
        record: {
          requestFingerprint: fingerprint,
          state: IdempotencyRecordState.PROCESSING,
        },
      }),
      find: vi.fn().mockResolvedValue({
        requestFingerprint: fingerprint,
        state: IdempotencyRecordState.COMPLETED,
        responseStatus: HttpStatus.OK,
        responseBody: { saved: true },
      }),
      complete: vi.fn(),
      release: vi.fn(),
      touch: vi.fn(),
    } as unknown as IdempotencyRepository;
    const interceptor = new IdempotencyInterceptor(
      reflectorFor({}),
      records,
    );
    const handler: CallHandler = { handle: vi.fn(() => of({ saved: false })) };
    const response = { statusCode: HttpStatus.OK, status: vi.fn() };

    const body = await lastValueFrom(
      interceptor.intercept(contextFor({ version: 3 }, response), handler),
    );

    expect(body).toEqual({ saved: true });
    expect(handler.handle).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('同一键搭配不同请求体时返回指纹冲突', async () => {
    const records = {
      claim: vi.fn().mockResolvedValue({
        kind: 'existing',
        record: {
          requestFingerprint: hashFromBody('{"other":true}'),
          state: IdempotencyRecordState.COMPLETED,
        },
      }),
      find: vi.fn(),
      complete: vi.fn(),
      release: vi.fn(),
      touch: vi.fn(),
    } as unknown as IdempotencyRepository;
    const interceptor = new IdempotencyInterceptor(reflectorFor({}), records);
    const handler: CallHandler = { handle: vi.fn(() => of({ saved: true })) };

    await expect(
      lastValueFrom(interceptor.intercept(contextFor({ version: 3 }), handler)),
    ).rejects.toThrow('同一幂等键不能搭配不同的请求体');
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('业务失败时释放 claim，便于原键重试', async () => {
    const { interceptor, records } = interceptorFor({});
    const handler: CallHandler = {
      handle: vi.fn(() => throwError(() => new Error('业务失败'))),
    };

    await expect(
      lastValueFrom(interceptor.intercept(contextFor({ version: 3 }), handler)),
    ).rejects.toThrow('业务失败');
    expect(vi.mocked(records.release)).toHaveBeenCalledOnce();
    expect(vi.mocked(records.complete)).not.toHaveBeenCalled();
  });
});

function interceptorFor(options: { highRisk?: boolean }) {
  const records = {
    claim: vi.fn().mockResolvedValue({ kind: 'claimed' }),
    complete: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(),
  } as unknown as IdempotencyRepository;
  const interceptor = new IdempotencyInterceptor(reflectorFor(options), records);
  const handler: CallHandler = { handle: vi.fn(() => of({ saved: true })) };
  return { interceptor, records, handler };
}

function reflectorFor(options: { highRisk?: boolean }) {
  return {
    getAllAndOverride: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(options),
  } as never;
}

function contextFor(
  body: unknown,
  response: { statusCode: number; status: ReturnType<typeof vi.fn> } = {
    statusCode: HttpStatus.OK,
    status: vi.fn(),
  },
): ExecutionContext {
  const request = {
    auth: { userId: 'user-1' },
    method: 'PUT',
    path: '/api/v1/admin/roles/MEMBER/permissions',
    body,
    header: (name: string) => (name === 'idempotency-key' ? 'key-1' : undefined),
  };
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function hashFromBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}
