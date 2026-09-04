import { createHash } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { from, type Observable, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { DomainHttpException } from '../errors/domain-http.exception';
import { IdempotencyRepository } from './idempotency.repository';
import { IDEMPOTENCY_REQUIRED_KEY } from './require-idempotency.decorator';

const TTL_MS = 24 * 60 * 60 * 1000;

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

    const subjectId = request.auth?.userId;
    if (!subjectId) {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '未登录或登录已失效');
    }

    const lookup = {
      subjectType: 'user',
      subjectIdOrHash: subjectId,
      httpMethod: request.method.toUpperCase(),
      pathHash: hashValue(request.path),
      idempotencyKey: key,
    };
    const fingerprint = hashValue(stableBody(request.body));

    return from(this.records.find(lookup)).pipe(
      mergeMap((existing) => {
        if (existing && existing.expiresAt.getTime() > Date.now()) {
          if (existing.requestFingerprint !== fingerprint) {
            throw new DomainHttpException(
              HttpStatus.CONFLICT,
              'IDEMPOTENCY_KEY_REUSED',
              '同一幂等键不能搭配不同的请求体',
            );
          }
          response.status(existing.responseStatus);
          return of(existing.responseBody);
        }

        return next.handle().pipe(
          mergeMap((body) =>
            from(
              this.persist({
                ...lookup,
                fingerprint,
                status: response.statusCode || HttpStatus.OK,
                body,
              }),
            ).pipe(mergeMap(() => of(body))),
          ),
        );
      }),
    );
  }

  private async persist(input: {
    subjectType: string;
    subjectIdOrHash: string;
    httpMethod: string;
    pathHash: string;
    idempotencyKey: string;
    fingerprint: string;
    status: number;
    body: unknown;
  }): Promise<void> {
    try {
      await this.records.create({
        subjectType: input.subjectType,
        subjectIdOrHash: input.subjectIdOrHash,
        httpMethod: input.httpMethod,
        pathHash: input.pathHash,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.fingerprint,
        responseStatus: input.status,
        responseBody: (input.body ?? {}) as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + TTL_MS),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.records.find(input);
        if (existing && existing.requestFingerprint === input.fingerprint) {
          return;
        }
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'IDEMPOTENCY_KEY_REUSED',
          '同一幂等键不能搭配不同的请求体',
        );
      }
      throw error;
    }
  }
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableBody(body: unknown): string {
  if (body === undefined || body === null) {
    return '';
  }
  return JSON.stringify(body);
}
