import { BadRequestException, HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
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

    new HttpExceptionFilter().catch(
      new HttpException('资源状态不允许', HttpStatus.CONFLICT),
      host,
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toMatchObject({
      error: { code: 'HTTP_REQUEST_FAILED', message: '资源状态不允许', details: [] },
      requestId: 'request-456',
    });
  });
});
