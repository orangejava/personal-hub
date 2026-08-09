import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/bootstrap';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

describe('Express HTTP application', () => {
  let app: NestExpressApplication;
  let baseUrl: string;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PORT: '0',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      REDIS_KEY_PREFIX: 'ph:test',
      CORS_ORIGIN: 'http://localhost:8000',
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-characters',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-characters',
      MINIO_ENDPOINT: 'localhost',
      MINIO_ACCESS_KEY: 'test-access-key',
      MINIO_SECRET_KEY: 'test-secret-key',
      MINIO_BUCKET: 'test-bucket',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
      })
      .overrideProvider(RedisService)
      .useValue({
        ping: vi.fn().mockResolvedValue('PONG'),
      })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttpApp(
      app,
      app.get(ConfigService),
      app.get(Logger),
    );
    await app.listen(0);

    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('测试 HTTP 服务未能监听随机端口');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps the health response envelope and request ID header consistent', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
      headers: { Origin: 'http://localhost:8000' },
    });
    const body = await response.json() as { data: unknown; requestId: string };

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe(body.requestId);
    expect(response.headers.get('access-control-expose-headers')).toContain('X-Request-Id');
    expect(body.data).toMatchObject({ status: 'ok' });
  });

  it('returns a standard envelope for an unmatched Express route', async () => {
    const response = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    const body = await response.json() as {
      error: { code: string };
      requestId: string;
    };

    expect(response.status).toBe(404);
    expect(response.headers.get('x-request-id')).toBe(body.requestId);
    expect(body.error.code).toBe('HTTP_REQUEST_FAILED');
  });
});
