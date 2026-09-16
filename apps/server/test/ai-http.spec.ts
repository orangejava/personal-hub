import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AiNavStatus, AiToolCode, AiToolStatus, RoleCode, UserStatus } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { GenericContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureHttpApp } from '../src/bootstrap';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AiService } from '../src/modules/ai/ai.service';
import { runBaselineSeed } from '../prisma/seed';

const serverDirectory = resolve(__dirname, '..');
const ORIGIN = 'http://localhost:8000';
const PASSWORD = 'OwnerPass!1';

interface Envelope<T> {
  data?: T;
  error?: { code: string; message: string };
  requestId: string;
}

describe('AI HTTP', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let ai: AiService;
  let stopPostgres: (() => Promise<unknown>) | undefined;
  let stopRedis: (() => Promise<unknown>) | undefined;
  let memberToken = '';
  let otherToken = '';
  let adminToken = '';

  beforeAll(async () => {
    const postgres = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'personal_hub_ai_test',
        POSTGRES_USER: 'personal_hub_ai_test',
        POSTGRES_PASSWORD: 'personal_hub_ai_test_password',
      })
      .withExposedPorts(5432)
      .withStartupTimeout(120_000)
      .start();
    stopPostgres = () => postgres.stop();

    const redis = await new GenericContainer('redis:7-alpine')
      .withCommand(['redis-server', '--appendonly', 'no'])
      .withExposedPorts(6379)
      .start();
    stopRedis = () => redis.stop();

    const databaseUrl = `postgresql://personal_hub_ai_test:personal_hub_ai_test_password@${postgres.getHost()}:${postgres.getMappedPort(5432)}/personal_hub_ai_test?schema=public`;
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
      REDIS_KEY_PREFIX: 'ph:ai-http-test',
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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureHttpApp(app, app.get(ConfigService), app.get(Logger));
    await app.listen(0);
    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('AI HTTP 测试服务未能监听随机端口');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
    ai = app.get(AiService);
    await runBaselineSeed(prisma);

    const passwordHash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const [admin, member] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.MEMBER } }),
    ]);
    await prisma.user.createMany({
      data: [
        {
          email: 'admin@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: admin.id,
          emailVerifiedAt: new Date(),
          mustChangePassword: false,
          nickname: 'Admin',
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
        {
          email: 'other@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: member.id,
          emailVerifiedAt: new Date(),
          mustChangePassword: false,
          nickname: 'Other',
        },
      ],
    });
    const users = await prisma.user.findMany();
    for (const user of users) {
      await prisma.aiQuotaAccount.create({
        data: {
          userId: user.id,
          availableAmount: 10000n,
          transactions: {
            create: {
              type: 'GRANT',
              amount: 10000n,
              availableBalanceAfter: 10000n,
              reservedBalanceAfter: 0n,
              source: 'test.grant',
            },
          },
        },
      });
    }
    adminToken = await login('admin@example.com');
    memberToken = await login('member@example.com');
    otherToken = await login('other@example.com');
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await stopRedis?.();
    await stopPostgres?.();
  });

  it('访客可读公开 AI 首页与模型，不因假 UUID 500', async () => {
    const home = await json<{
      tools: Array<{ code: string }>;
      models: Array<{ id: string }>;
      templates: Array<{ id: string }>;
    }>('/api/v1/public/ai/home');
    expect(home.data?.tools.some((item) => item.code === 'chat')).toBe(true);
    expect(home.data?.models.length).toBeGreaterThan(0);
    expect(home.data?.templates.length).toBeGreaterThan(0);

    const models = await json<Array<{ id: string; toolTypes: string[] }>>('/api/v1/public/ai/models');
    expect(models.data?.some((item) => item.toolTypes.includes('chat'))).toBe(true);
  });

  it('会员可读模型与工具广场，并发起 Chat SSE', async () => {
    const home = await json<{ tools: Array<{ code: string }>; models: Array<{ id: string }> }>(
      '/api/v1/app/ai/home',
      { token: memberToken },
    );
    expect(home.data?.tools.some((item) => item.code === 'chat')).toBe(true);
    expect(home.data?.models.length).toBeGreaterThan(0);

    const session = await json<{ id: string }>('/api/v1/app/ai/sessions', {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'ai-session-1' },
      body: { title: '测试会话' },
    });
    const stream = await fetch(`${baseUrl}/api/v1/app/ai/sessions/${session.data?.id}/messages`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json',
        'Idempotency-Key': 'ai-chat-1',
      },
      body: JSON.stringify({ content: '介绍一下额度预占' }),
    });
    expect(stream.headers.get('content-type')).toContain('text/event-stream');
    const text = await stream.text();
    expect(text).toContain('STARTED');
    expect(text).toContain('DONE');

    const messages = await json<{ list: Array<{ role: string; status: string }> }>(
      `/api/v1/app/ai/sessions/${session.data?.id}/messages`,
      { token: memberToken },
    );
    expect(messages.data?.list.some((item) => item.role === 'assistant' && item.status === 'done')).toBe(
      true,
    );
  });

  it('额度不足时拒绝生成', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'member@example.com' } });
    await prisma.aiQuotaAccount.update({
      where: { userId: user.id },
      data: { availableAmount: 0n, reservedAmount: 0n, version: { increment: 1 } },
    });
    const session = await json<{ id: string }>('/api/v1/app/ai/sessions', {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'ai-session-empty' },
      body: {},
    });
    const res = await raw(`/api/v1/app/ai/sessions/${session.data?.id}/messages`, {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'ai-chat-empty' },
      body: { content: '还会扣费吗' },
    });
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe('AI_QUOTA_INSUFFICIENT');
    await prisma.aiQuotaAccount.update({
      where: { userId: user.id },
      data: { availableAmount: 10000n },
    });
  });

  it('图片任务可 processJob 到成功并写入资产', async () => {
    const created = await json<{ id: string }>('/api/v1/app/ai/image-generations', {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'ai-image-1' },
      body: { prompt: '一只猫', count: 1 },
    });
    expect(created.data?.id).toBeTruthy();
    await ai.processJob(created.data!.id);
    const job = await json<{
      status: string;
      assets: Array<{ id: string; fileUrl: string }>;
    }>(`/api/v1/app/ai/image-generations/${created.data?.id}`, { token: memberToken });
    expect(job.data?.status).toBe('done');
    expect(job.data?.assets.length).toBeGreaterThan(0);
    const assetId = job.data?.assets[0]?.id;
    expect(assetId).toBeTruthy();
    const media = await fetch(`${baseUrl}/api/v1/app/ai/assets/${assetId}/content`, {
      headers: { origin: ORIGIN, authorization: `Bearer ${memberToken}` },
    });
    expect(media.status).toBe(200);
    expect(media.headers.get('content-type')).toContain('image/png');
    const bytes = Buffer.from(await media.arrayBuffer());
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const assets = await json<{ total: number; list: Array<{ fileUrl: string }> }>(
      '/api/v1/app/ai/assets',
      { token: memberToken },
    );
    expect(assets.data?.total).toBeGreaterThan(0);
    expect(assets.data?.list[0]?.fileUrl).toContain('/api/v1/app/ai/assets/');
  });

  it('后台可持久化品牌并配置导航显隐', async () => {
    const before = await json<{
      branding: { brandName: string; logoText: string };
      navigation: Array<{ id: string; code: string; visible: boolean; status: string; version: number }>;
    }>('/api/v1/admin/ai/config', { token: adminToken });
    await json('/api/v1/admin/ai/branding', {
      method: 'PATCH',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-brand-1' },
      body: { brandName: 'Hub AI Lab', logoText: 'HL' },
    });
    const after = await json<{ branding: { brandName: string; logoText: string } }>(
      '/api/v1/admin/ai/config',
      { token: adminToken },
    );
    expect(after.data?.branding.brandName).toBe('Hub AI Lab');
    expect(after.data?.branding.logoText).toBe('HL');

    const nav = before.data?.navigation.find((item) => item.code === 'webui');
    expect(nav).toBeTruthy();
    await json(`/api/v1/admin/ai/navigation/${nav!.id}`, {
      method: 'PATCH',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-nav-hide-webui' },
      body: { visible: false, version: nav!.version },
    });
    const publicNav = await json<Array<{ code: string }>>('/api/v1/public/ai/navigation');
    expect(publicNav.data?.some((item) => item.code === 'webui')).toBe(false);
    expect(publicNav.data?.some((item) => item.code === 'chat')).toBe(true);
  });

  it('后台禁用模型后用户端不可见', async () => {
    const models = await json<Array<{ id: string; enabled: boolean; toolTypes: string[] }>>(
      '/api/v1/app/ai/models',
      { token: memberToken },
    );
    const target = models.data?.find((item) => item.toolTypes?.includes('image')) ?? models.data?.[0];
    expect(target).toBeTruthy();
    const config = await json<{ models: Array<{ id: string }> }>('/api/v1/admin/ai/config', {
      token: adminToken,
    });
    const adminModel = config.data?.models.find((item) => item.id === target?.id);
    expect(adminModel).toBeTruthy();
    await json(`/api/v1/admin/ai/models/${target!.id}`, {
      method: 'PATCH',
      token: adminToken,
      headers: { 'Idempotency-Key': 'disable-model' },
      body: { enabled: false },
    });
    const after = await json<Array<{ id: string }>>('/api/v1/app/ai/models', { token: memberToken });
    expect(after.data?.some((item) => item.id === target?.id)).toBe(false);
  });

  it('匿名 Chat 登录后可认领历史', async () => {
    const stream = await fetch(`${baseUrl}/api/v1/public/ai/chat`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        'Idempotency-Key': 'guest-chat-1',
      },
      body: JSON.stringify({ content: '访客先聊一句' }),
    });
    expect(stream.headers.get('content-type')).toContain('text/event-stream');
    const text = await stream.text();
    expect(text).toContain('DONE');
    const cookie = (stream.headers.getSetCookie?.() ?? [])
      .find((item) => item.startsWith('ph_ai_anon='))
      ?.split(';')[0];
    expect(cookie).toBeTruthy();

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        cookie: cookie!,
      },
      body: JSON.stringify({ email: 'member@example.com', password: PASSWORD }),
    });
    const loginBody = (await loginResponse.json()) as Envelope<{ accessToken: string }>;
    const claimedToken = loginBody.data?.accessToken ?? '';
    expect(claimedToken.length).toBeGreaterThan(10);

    const sessions = await json<{ list: Array<{ title: string }> }>('/api/v1/app/ai/sessions', {
      token: claimedToken,
    });
    expect(sessions.data?.list.some((item) => item.title.includes('访客') || item.title.includes('聊'))).toBe(
      true,
    );
  });

  it('公开导航仍返回禁用和即将上线项', async () => {
    const publicNav = await json<Array<{ code: string; status: string }>>('/api/v1/public/ai/navigation');
    expect(publicNav.data?.find((item) => item.code === 'team')?.status).toBe('disabled');
    expect(publicNav.data?.find((item) => item.code === 'video')?.status).toBe('comingSoon');
    expect(publicNav.data?.find((item) => item.code === 'webui')).toBeUndefined();
  });

  it('他人不能读取资产二进制', async () => {
    const assets = await json<{ list: Array<{ id: string }> }>('/api/v1/app/ai/assets', {
      token: memberToken,
    });
    const assetId = assets.data?.list[0]?.id;
    expect(assetId).toBeTruthy();
    const media = await fetch(`${baseUrl}/api/v1/app/ai/assets/${assetId}/content`, {
      headers: { origin: ORIGIN, authorization: `Bearer ${otherToken}` },
    });
    expect(media.status).toBe(404);
    const body = (await media.json()) as Envelope<unknown>;
    expect(body.error?.code).toBe('AI_GENERATION_NOT_FOUND');
  });

  it('工具或导航不可用时拒绝生成和会员数据', async () => {
    const video = await raw('/api/v1/app/ai/video-generations', {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'ai-video-blocked' },
      body: { prompt: '一段短片' },
    });
    expect(video.status).toBe(409);
    expect(video.body.error?.code).toBe('AI_TOOL_UNAVAILABLE');

    await prisma.aiTool.update({
      where: { code: AiToolCode.IMAGE },
      data: { status: AiToolStatus.DISABLED },
    });
    const image = await raw('/api/v1/app/ai/image-generations', {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'ai-image-blocked' },
      body: { prompt: '不该生成' },
    });
    expect(image.status).toBe(409);
    expect(image.body.error?.code).toBe('AI_TOOL_UNAVAILABLE');
    await prisma.aiTool.update({
      where: { code: AiToolCode.IMAGE },
      data: { status: AiToolStatus.ENABLED },
    });

    const config = await json<{
      navigation: Array<{ id: string; code: string; version: number }>;
    }>('/api/v1/admin/ai/config', { token: adminToken });
    const membership = config.data?.navigation.find((item) => item.code === 'membership');
    expect(membership).toBeTruthy();
    await json(`/api/v1/admin/ai/navigation/${membership!.id}`, {
      method: 'PATCH',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-nav-membership-soon' },
      body: { status: AiNavStatus.COMING_SOON, version: membership!.version },
    });
    const blocked = await raw('/api/v1/app/ai/membership', { token: memberToken });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error?.code).toBe('AI_TOOL_UNAVAILABLE');
    const after = await json<{
      navigation: Array<{ id: string; code: string; version: number }>;
    }>('/api/v1/admin/ai/config', { token: adminToken });
    const restored = after.data?.navigation.find((item) => item.code === 'membership');
    await json(`/api/v1/admin/ai/navigation/${restored!.id}`, {
      method: 'PATCH',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-nav-membership-on' },
      body: { status: AiNavStatus.ENABLED, version: restored!.version },
    });
  });

  it('导航 PATCH 缺少 version 或冲突时拒绝', async () => {
    const config = await json<{
      navigation: Array<{ id: string; code: string; version: number }>;
    }>('/api/v1/admin/ai/config', { token: adminToken });
    const tutorials = config.data?.navigation.find((item) => item.code === 'tutorials');
    expect(tutorials).toBeTruthy();
    const missing = await raw(`/api/v1/admin/ai/navigation/${tutorials!.id}`, {
      method: 'PATCH',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-nav-no-version' },
      body: { status: AiNavStatus.COMING_SOON },
    });
    expect(missing.status).toBe(400);
    expect(missing.body.error?.code).toBe('VALIDATION_FAILED');
    const stale = await raw(`/api/v1/admin/ai/navigation/${tutorials!.id}`, {
      method: 'PATCH',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-nav-stale-version' },
      body: { status: AiNavStatus.COMING_SOON, version: tutorials!.version - 1 },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error?.code).toBe('SYSTEM_CONFIG_VERSION_CONFLICT');
  });

  async function login(email: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    const body = (await response.json()) as Envelope<{ accessToken: string }>;
    const token = body.data?.accessToken ?? '';
    expect(token.length).toBeGreaterThan(10);
    return token;
  }

  async function json<T>(
    path: string,
    init?: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> },
  ): Promise<Envelope<T>> {
    const res = await raw(path, init);
    if (res.status >= 400) {
      throw new Error(`${init?.method ?? 'GET'} ${path} ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body as Envelope<T>;
  }

  async function raw(
    path: string,
    init?: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> },
  ): Promise<{ status: number; body: Envelope<unknown> }> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        origin: ORIGIN,
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(init?.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...init?.headers,
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const text = await response.text();
    let parsed: Envelope<unknown>;
    try {
      parsed = JSON.parse(text) as Envelope<unknown>;
    } catch {
      parsed = { requestId: 'none', error: { code: 'PARSE', message: text } };
    }
    return { status: response.status, body: parsed };
  }
});
