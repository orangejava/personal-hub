import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { GenericContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/bootstrap';

const serverDirectory = resolve(__dirname, '..');

describe('真实基础设施集成', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  let stopPostgres: (() => Promise<unknown>) | undefined;
  let stopRedis: (() => Promise<unknown>) | undefined;

  beforeAll(async () => {
    const postgres = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'personal_hub_test',
        POSTGRES_USER: 'personal_hub_test',
        POSTGRES_PASSWORD: 'personal_hub_test_password',
      })
      .withExposedPorts(5432)
      .start();
    stopPostgres = () => postgres.stop();

    const redis = await new GenericContainer('redis:7-alpine')
      .withCommand(['redis-server', '--appendonly', 'no'])
      .withExposedPorts(6379)
      .start();
    stopRedis = () => redis.stop();

    const databaseUrl = `postgresql://personal_hub_test:personal_hub_test_password@${postgres.getHost()}:${postgres.getMappedPort(5432)}/personal_hub_test?schema=public`;
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PORT: '0',
      DATABASE_URL: databaseUrl,
      REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
      REDIS_KEY_PREFIX: 'ph:test',
      CORS_ORIGIN: 'http://localhost:8000',
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-characters',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-characters',
      MINIO_ENDPOINT: 'localhost',
      MINIO_ACCESS_KEY: 'test-access-key',
      MINIO_SECRET_KEY: 'test-secret-key',
      MINIO_BUCKET: 'test-bucket',
    });

    // 必须先用临时库执行正式 migration，避免测试误把开发数据库的既有状态当成通过条件。
    execFileSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      {
        cwd: serverDirectory,
        env: process.env,
        stdio: 'pipe',
      },
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttpApp(app, app.get(ConfigService), app.get(Logger));
    await app.listen(0);

    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('测试 HTTP 服务未能监听随机端口');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await stopRedis?.();
    await stopPostgres?.();
  });

  it('在临时 PostgreSQL 与 Redis 都可用时通过 readiness', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    const body = (await response.json()) as {
      data: {
        status: string;
        info: { database: { status: string }; redis: { status: string } };
      };
    };

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('ok');
    expect(body.data.info.database.status).toBe('up');
    expect(body.data.info.redis.status).toBe('up');
  });
});
