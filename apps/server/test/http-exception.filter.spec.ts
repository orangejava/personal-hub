import { BadRequestException, HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DomainHttpException } from '../src/common/errors/domain-http.exception';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('returns the standard error envelope through an Express response', () => {
    const response = {
      statusCode: 0,
      body: undefined as unknown,
      status(status: number) {
        this.statusCode = status;
        return this;
      },
      json(body: unknown) {
        this.body = body;
        return this;
      },
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'request-123' }),
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    new HttpExceptionFilter().catch(new BadRequestException('参数错误'), host);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: '参数错误',
        details: [],
      },
      requestId: 'request-123',
    });
  });

  it('preserves a string HttpException message', () => {
    const response = {
      statusCode: 0,
      body: undefined as unknown,
      status(status: number) {
        this.statusCode = status;
        return this;
      },
      json(body: unknown) {
        this.body = body;
        return this;
      },
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'request-456' }),
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    new HttpExceptionFilter().catch(new HttpException('资源状态不允许', HttpStatus.CONFLICT), host);

    expect(response.statusCode).toBe(409);
    expect(response.body).toMatchObject({
      error: { code: 'HTTP_REQUEST_FAILED', message: '资源状态不允许', details: [] },
      requestId: 'request-456',
    });
  });

  it('writes Retry-After when DomainHttpException carries a cooldown', () => {
    const response = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      status(status: number) {
        this.statusCode = status;
        return this;
      },
      setHeader(name: string, value: string) {
        this.headers[name] = value;
        return this;
      },
      json(body: unknown) {
        this.body = body;
        return this;
      },
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'request-429' }),
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    new HttpExceptionFilter().catch(
      new DomainHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH_RATE_LIMITED',
        '登录尝试过于频繁，请稍后再试',
        [],
        { retryAfterSeconds: 900 },
      ),
      host,
    );

    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBe('900');
    expect(response.body).toMatchObject({
      error: { code: 'AUTH_RATE_LIMITED' },
      requestId: 'request-429',
    });
  });
});
