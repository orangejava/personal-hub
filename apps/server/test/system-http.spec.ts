import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RoleCode, UserStatus } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { GenericContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureHttpApp } from '../src/bootstrap';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { runBaselineSeed } from '../prisma/seed';

const serverDirectory = resolve(__dirname, '..');
const ORIGIN = 'http://localhost:8000';
const PASSWORD = 'OwnerPass!1';

interface Envelope<T> {
  data?: T;
  error?: { code: string; message: string };
  requestId: string;
}

describe('System config and menu HTTP', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let stopPostgres: (() => Promise<unknown>) | undefined;
  let stopRedis: (() => Promise<unknown>) | undefined;
  let accessToken = '';

  beforeAll(async () => {
    const postgres = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'personal_hub_system_test',
        POSTGRES_USER: 'personal_hub_system_test',
        POSTGRES_PASSWORD: 'personal_hub_system_test_password',
      })
      .withExposedPorts(5432)
      .start();
    stopPostgres = () => postgres.stop();

    const redis = await new GenericContainer('redis:7-alpine')
      .withCommand(['redis-server', '--appendonly', 'no'])
      .withExposedPorts(6379)
      .start();
    stopRedis = () => redis.stop();

    const databaseUrl = `postgresql://personal_hub_system_test:personal_hub_system_test_password@${postgres.getHost()}:${postgres.getMappedPort(5432)}/personal_hub_system_test?schema=public`;
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
      REDIS_KEY_PREFIX: 'ph:system-http-test',
      CORS_ORIGIN: ORIGIN,
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-characters',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-characters',
      MINIO_ENDPOINT: 'localhost',
      MINIO_ACCESS_KEY: 'test-access-key',
      MINIO_SECRET_KEY: 'test-secret-key',
      MINIO_BUCKET: 'test-bucket',
    });

    execFileSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      { cwd: serverDirectory, env: process.env, stdio: 'pipe' },
    );

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttpApp(app, app.get(ConfigService), app.get(Logger));
    await app.listen(0);
    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('System HTTP 测试服务未能监听随机端口');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
    await runBaselineSeed(prisma);

    const passwordHash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const [superAdmin, member] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.SUPER_ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.MEMBER } }),
    ]);
    await prisma.user.createMany({
      data: [
        {
          email: 'owner@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: superAdmin.id,
          emailVerifiedAt: new Date(),
          mustChangePassword: false,
          nickname: 'Owner',
        },
        {
          email: 'member@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: member.id,
          emailVerifiedAt: new Date(),
          mustChangePassword: false,
          nickname: 'Member',
        },
      ],
    });

    const login = await json<{ accessToken: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'owner@example.com', password: PASSWORD },
    });
    accessToken = login.data?.accessToken ?? '';
    expect(accessToken.length).toBeGreaterThan(10);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await stopRedis?.();
    await stopPostgres?.();
  });

  it('匿名可读公开配置，含预留字段且不含密钥', async () => {
    const res = await json<Record<string, unknown>>('/api/v1/public/site-config');
    expect(res.data?.siteName).toBe('Personal Hub');
    expect(res.data?.logoFileId).toBeNull();
    expect(JSON.stringify(res.data)).not.toMatch(/JWT|SMTP|sk-/i);
    const homepage = res.data?.homepage as { featuredContent?: { contentIds?: string[] } };
    expect(homepage.featuredContent?.contentIds).toEqual([]);
  });

  it('匿名公开导航来自 seed，禁用后不再出现', async () => {
    const before = await json<Array<{ routeKey: string | null }>>('/api/v1/public/navigation');
    expect(before.data?.some((item) => item.routeKey === 'public.home')).toBe(true);

    const project = await prisma.menu.findUniqueOrThrow({ where: { routeKey: 'public.projects' } });
    await json(`/api/v1/admin/menus/${project.id}`, {
      method: 'PATCH',
      token: accessToken,
      headers: { 'Idempotency-Key': 'disable-projects' },
      body: { enabled: false, version: project.version },
    });
    const after = await json<Array<{ routeKey: string | null }>>('/api/v1/public/navigation');
    expect(after.data?.some((item) => item.routeKey === 'public.projects')).toBe(false);

    await json(`/api/v1/admin/menus/${project.id}`, {
      method: 'PATCH',
      token: accessToken,
      headers: { 'Idempotency-Key': 'enable-projects' },
      body: { enabled: true, version: project.version + 1 },
    });
  });

  it('无 token 写配置返回 401，member 返回 403', async () => {
    const anon = await raw('/api/v1/admin/system-configs/site.general', { method: 'PUT', body: {} });
    expect(anon.status).toBe(401);

    const memberLogin = await json<{ accessToken: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'member@example.com', password: PASSWORD },
    });
    const forbidden = await raw('/api/v1/admin/system-configs/site.general', {
      method: 'PUT',
      token: memberLogin.data?.accessToken,
      headers: { 'Idempotency-Key': 'member-put-1' },
      body: { version: 1, value: { siteName: 'Nope' } },
    });
    expect(forbidden.status).toBe(403);
  });

  it('缺少幂等键时 PUT 返回 400', async () => {
    const res = await raw('/api/v1/admin/system-configs/site.general', {
      method: 'PUT',
      token: accessToken,
      body: { version: 1, value: { siteName: 'X' } },
    });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('管理员更新站点名后公开接口立刻看到新值，版本冲突可拦截', async () => {
    const listed = await json<Array<{ group: string; version: number; value: { siteName: string } }>>(
      '/api/v1/admin/system-configs?group=site.general',
      { token: accessToken },
    );
    const row = listed.data?.[0];
    expect(row?.group).toBe('site.general');

    const updated = await json<{ version: number; value: { siteName: string } }>(
      '/api/v1/admin/system-configs/site.general',
      {
        method: 'PUT',
        token: accessToken,
        headers: { 'Idempotency-Key': 'put-site-general-1' },
        body: {
          version: row?.version,
          value: { ...row?.value, siteName: 'Hub From Test' },
        },
      },
    );
    expect(updated.data?.value.siteName).toBe('Hub From Test');

    const publicRes = await json<{ siteName: string }>('/api/v1/public/site-config');
    expect(publicRes.data?.siteName).toBe('Hub From Test');

    const replay = await json<{ value: { siteName: string } }>(
      '/api/v1/admin/system-configs/site.general',
      {
        method: 'PUT',
        token: accessToken,
        headers: { 'Idempotency-Key': 'put-site-general-1' },
        body: {
          version: row?.version,
          value: { ...row?.value, siteName: 'Hub From Test' },
        },
      },
    );
    expect(replay.data?.value.siteName).toBe('Hub From Test');

    const conflict = await raw('/api/v1/admin/system-configs/site.general', {
      method: 'PUT',
      token: accessToken,
      headers: { 'Idempotency-Key': 'put-site-general-2' },
      body: {
        version: row?.version,
        value: { ...row?.value, siteName: 'Stale' },
      },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error?.code).toBe('SYSTEM_CONFIG_VERSION_CONFLICT');
  });

  it('核心菜单不能删除，route-options 含登记项', async () => {
    const options = await json<Array<{ routeKey: string }>>('/api/v1/admin/menu-route-options', {
      token: accessToken,
    });
    expect(options.data?.some((item) => item.routeKey === 'public.home')).toBe(true);

    const menus = await json<Array<{ routeKey: string | null; id: string; children?: Array<{ id: string }> }>>(
      '/api/v1/admin/menus',
      { token: accessToken },
    );
    const systemGroup = menus.data?.find((item) => item.routeKey === 'admin.system.group');
    const core = systemGroup?.children?.length
      ? undefined
      : await prisma.menu.findUnique({ where: { routeKey: 'admin.menus' } });
    const menusId =
      core?.id ??
      (await prisma.menu.findUniqueOrThrow({ where: { routeKey: 'admin.menus' } })).id;

    const del = await raw(`/api/v1/admin/menus/${menusId}`, {
      method: 'DELETE',
      token: accessToken,
      headers: { 'Idempotency-Key': 'del-core-menu' },
    });
    expect(del.status).toBe(409);
    expect(del.body.error?.code).toBe('MENU_CORE_PROTECTED');
  });

  async function json<T>(
    path: string,
    init?: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> },
  ): Promise<Envelope<T>> {
    const res = await raw(path, init);
    return res.body as Envelope<T>;
  }

  async function raw(
    path: string,
    init?: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> },
  ): Promise<{ status: number; body: Envelope<unknown> }> {
    const headers: Record<string, string> = {
      origin: ORIGIN,
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...init?.headers,
    };
    const response = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    return { status: response.status, body: (await response.json()) as Envelope<unknown> };
  }
});
