import { createHash } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdempotencyRecordState, Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { from, type Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, mergeMap } from 'rxjs/operators';
import { DomainHttpException } from '../errors/domain-http.exception';
import {
  IdempotencyRepository,
  type IdempotencyLookup,
} from './idempotency.repository';
import {
  IDEMPOTENCY_OPTIONS_KEY,
  IDEMPOTENCY_REQUIRED_KEY,
  type IdempotencyOptions,
} from './require-idempotency.decorator';

/** 与 Canonical 一致：普通写操作幂等记录保留 24 小时。 */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const HIGH_RISK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** 同键后来者等待首请求完成的上限；超时仍返回 409，避免无限占用连接。 */
const IN_PROGRESS_WAIT_MS = 10_000;
const IN_PROGRESS_POLL_MS = 50;
/** 首请求执行期间刷新占位心跳，间隔需小于 STALE_PROCESSING_MS。 */
const PROCESSING_HEARTBEAT_MS = 5_000;

/**
 * 受保护写接口的幂等闸门。
 *
 * 缺 Idempotency-Key 直接 400：否则刷新/重试无法与首次请求对齐。
 * 查找键是 用户 + method + path + Key；body 另做 fingerprint。
 * 同一 Key 配不同 body → 409，避免把「重试」当成「换一组参数再提交」。
 * 先以 PROCESSING 原子声明唯一键；未过期已完成记录回放，处理中记录等待后回放，绝不再进 Controller。
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly records: IdempotencyRepository,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENCY_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return next.handle();
    }
    const options = this.reflector.getAllAndOverride<IdempotencyOptions>(IDEMPOTENCY_OPTIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const key = request.header('idempotency-key')?.trim();
    if (!key) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'IDEMPOTENCY_KEY_REQUIRED',
        '写操作必须提供 Idempotency-Key',
      );
    }

    const subjectId = request.auth?.userId ?? request.aiAnonymousId;
    if (!subjectId) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    const lookup = {
      subjectType: request.auth?.userId ? 'user' : 'anonymous',
      subjectIdOrHash: subjectId,
      httpMethod: request.method.toUpperCase(),
      pathHash: hashValue(request.path),
      idempotencyKey: key,
    };
    const fingerprint = hashValue(stableJsonStringify(request.body));
    const expiresAt = new Date(Date.now() + (options?.highRisk ? HIGH_RISK_TTL_MS : DEFAULT_TTL_MS));

    return from(this.records.claim({ ...lookup, requestFingerprint: fingerprint, expiresAt })).pipe(
      mergeMap((claim) => {
        if (claim.kind === 'existing') {
          if (claim.record.requestFingerprint !== fingerprint) {
            throw this.keyReused();
          }
          if (claim.record.state === IdempotencyRecordState.COMPLETED) {
            return this.replay(response, claim.record.responseStatus, claim.record.responseBody);
          }
          return from(this.waitForCompleted(lookup, fingerprint)).pipe(
            mergeMap((record) =>
              this.replay(response, record.responseStatus, record.responseBody),
            ),
          );
        }

        // catchError 位于持久化成功链路之前，仅在 Controller 失败时释放声明。
        // 心跳让长耗时 complete/SHA 不会被当成僵死占位清掉。
        const heartbeat = setInterval(() => {
          void this.records.touch(lookup);
        }, PROCESSING_HEARTBEAT_MS);
        return next.handle().pipe(
          finalize(() => {
            clearInterval(heartbeat);
          }),
          catchError((error) =>
            from(this.records.release(lookup, fingerprint)).pipe(
              catchError(() => of(undefined)),
              mergeMap(() => throwError(() => error)),
            ),
          ),
          mergeMap((body) =>
            from(
              this.records.complete(lookup, {
                requestFingerprint: fingerprint,
                responseStatus: response.statusCode || HttpStatus.OK,
                responseBody: toStableJsonValue(body),
              }),
            ).pipe(map(() => body)),
          ),
        );
      }),
    );
  }

  /**
   * 等待已占位的同键请求完成。首请求失败并释放占位时，后来者拿到空记录，提示稍后用原 Key 重试。
   */
  private async waitForCompleted(lookup: IdempotencyLookup, fingerprint: string) {
    const deadline = Date.now() + IN_PROGRESS_WAIT_MS;
    while (Date.now() < deadline) {
      await delay(IN_PROGRESS_POLL_MS);
      const record = await this.records.find(lookup);
      if (record === null) {
        throw this.inProgress();
      }
      if (record.requestFingerprint !== fingerprint) {
        throw this.keyReused();
      }
      if (record.state === IdempotencyRecordState.COMPLETED) {
        return record;
      }
    }
    throw this.inProgress();
  }

  private replay(
    response: Response,
    status: number | null | undefined,
    body: unknown,
  ): Observable<unknown> {
    response.status(status ?? HttpStatus.OK);
    return of(body ?? {});
  }

  private keyReused(): DomainHttpException {
    return new DomainHttpException(
      HttpStatus.CONFLICT,
      'IDEMPOTENCY_KEY_REUSED',
      '同一幂等键不能搭配不同的请求体',
    );
  }

  private inProgress(): DomainHttpException {
    return new DomainHttpException(
      HttpStatus.CONFLICT,
      'IDEMPOTENCY_REQUEST_IN_PROGRESS',
      '相同幂等键的请求正在处理中，请稍后重试',
    );
  }
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * 以固定键顺序生成 JSON。HTTP JSON 对象字段的传输顺序不应改变其幂等指纹。
 */
export function stableJsonStringify(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  return JSON.stringify(sortJsonValue(value)) ?? '';
}

function toStableJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(stableJsonStringify(value ?? {})) as Prisma.InputJsonValue;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJsonValue(item)]),
    );
  }
  return value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
