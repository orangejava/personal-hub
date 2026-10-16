import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  AiNavStatus,
  AiToolCode,
  AiToolStatus,
  ContentStatus,
  ContentType,
  ContentVisibility,
  ImportRestriction,
  RoleCode,
  UserStatus,
} from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { GenericContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureHttpApp } from '../src/bootstrap';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AiService } from '../src/modules/ai/ai.service';
import { encryptCredentialForRequest } from '../../admin-web/src/services/admin/aiCredentialTransport';
import type { AiCredentialPublicKey } from '@personal-hub/shared-types';
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
      AI_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    });

    execFileSync(
      process.execPath,
      [
        resolve(serverDirectory, 'node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        'prisma/schema.prisma',
      ],
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

    const models = await json<Array<{ id: string; toolTypes: string[] }>>(
      '/api/v1/public/ai/models',
    );
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
    expect(text).toContain('userMessageId');
    expect(text).toContain('assistantMessageId');
    expect(text).toContain('requestId');
    expect(text).toContain('DONE');

    const messages = await json<{ list: Array<{ role: string; status: string }> }>(
      `/api/v1/app/ai/sessions/${session.data?.id}/messages`,
      { token: memberToken },
    );
    expect(
      messages.data?.list.some((item) => item.role === 'assistant' && item.status === 'done'),
    ).toBe(true);
  });

  it('私密内容仅在已发布、版权闸解除且当前用户获授权时进入 AI 引用', async () => {
    const [admin, member] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member@example.com' } }),
    ]);
    const createPrivateReference = (
      title: string,
      marker: string,
      options: {
        granted: boolean;
        status?: ContentStatus;
        restriction?: ImportRestriction;
      },
    ) =>
      prisma.content.create({
        data: {
          type: ContentType.MARKDOWN,
          title,
          authorId: admin.id,
          status: options.status ?? ContentStatus.PUBLISHED,
          visibility: ContentVisibility.PRIVATE,
          importRestriction: options.restriction ?? ImportRestriction.NONE,
          publishedAt: options.status === ContentStatus.DRAFT ? null : new Date(),
          body: { create: { markdownSource: marker } },
          accessGrants: options.granted
            ? { create: { userId: member.id, grantedBy: admin.id } }
            : undefined,
        },
      });
    const [authorized, unauthorized, draft, restricted] = await Promise.all([
      createPrivateReference('授权私密内容', 'AUTHORIZED_PRIVATE_MARKER', { granted: true }),
      createPrivateReference('未授权私密内容', 'UNAUTHORIZED_PRIVATE_MARKER', {
        granted: false,
      }),
      createPrivateReference('草稿私密内容', 'DRAFT_PRIVATE_MARKER', {
        granted: true,
        status: ContentStatus.DRAFT,
      }),
      createPrivateReference('版权受限私密内容', 'RESTRICTED_PRIVATE_MARKER', {
        granted: true,
        restriction: ImportRestriction.PRIVATE_UNTIL_LICENSED,
      }),
    ]);
    const session = await json<{ id: string }>('/api/v1/app/ai/sessions', {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'ai-private-reference-session' },
      body: { title: '私密引用边界' },
    });

    const outputs: string[] = [];
    for (const [index, content] of [authorized, unauthorized, draft, restricted].entries()) {
      const stream = await fetch(`${baseUrl}/api/v1/app/ai/sessions/${session.data?.id}/messages`, {
        method: 'POST',
        headers: {
          origin: ORIGIN,
          authorization: `Bearer ${memberToken}`,
          'content-type': 'application/json',
          'Idempotency-Key': `ai-private-reference-${index}`,
        },
        body: JSON.stringify({ content: '总结引用内容', contentId: content.id }),
      });
      expect(stream.headers.get('content-type')).toContain('text/event-stream');
      outputs.push(await stream.text());
    }

    const references = await prisma.aiMessageReference.findMany({
      where: { contentId: { in: [authorized.id, unauthorized.id, draft.id, restricted.id] } },
      select: { contentId: true, excerptSnapshot: true },
    });
    expect(references).toEqual([
      { contentId: authorized.id, excerptSnapshot: 'AUTHORIZED_PRIVATE_MARKER' },
    ]);
    expect(outputs[0]).toContain('AUTHORIZED_PRIVATE_MARKER');
    expect(outputs.slice(1).join('\n')).not.toMatch(
      /UNAUTHORIZED_PRIVATE_MARKER|DRAFT_PRIVATE_MARKER|RESTRICTED_PRIVATE_MARKER/,
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
      navigation: Array<{
        id: string;
        code: string;
        visible: boolean;
        status: string;
        version: number;
      }>;
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
    const target =
      models.data?.find((item) => item.toolTypes?.includes('image')) ?? models.data?.[0];
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
    const after = await json<Array<{ id: string }>>('/api/v1/app/ai/models', {
      token: memberToken,
    });
    expect(after.data?.some((item) => item.id === target?.id)).toBe(false);
  });

  it('新增模型不改变权益，显式授权后会员可见，重复标识被拒绝，停用后消失', async () => {
    const memberRole = await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.MEMBER } });
    const before = await prisma.aiEntitlement.findMany({ orderBy: { id: 'asc' } });
    const payload = {
      providerCode: 'fake',
      modelId: 'stage-a-model',
      displayName: '阶段 A 测试模型',
      toolTypes: ['chat'],
      modality: 'text',
      enabled: true,
      visibleToUser: true,
      isDefault: false,
      contextTokens: 8192,
      maxOutputTokens: 2048,
      inputPricePer1k: 1,
      outputPricePer1k: 2,
    };
    const created = await json<{ id: string; modelId: string }>('/api/v1/admin/ai/models', {
      method: 'POST',
      token: adminToken,
      headers: { 'Idempotency-Key': 'create-stage-a-model' },
      body: payload,
    });
    expect(created.data?.modelId).toBe(payload.modelId);
    const id = created.data!.id;
    const replay = await json<{ id: string }>('/api/v1/admin/ai/models', {
      method: 'POST',
      token: adminToken,
      headers: { 'Idempotency-Key': 'create-stage-a-model' },
      body: payload,
    });
    expect(replay.data?.id).toBe(id);
    expect(await prisma.aiModel.count({ where: { modelKey: payload.modelId } })).toBe(1);
    expect(await prisma.aiEntitlement.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    const hidden = await json<Array<{ id: string }>>('/api/v1/app/ai/models', {
      token: memberToken,
    });
    expect(hidden.data?.some((item) => item.id === id)).toBe(false);
    const denied = await raw('/api/v1/app/ai/sessions', {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'unauthorized-model-session' },
      body: { modelId: id },
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error?.code).toBe('AUTH_FORBIDDEN');
    const allowed = before.find((item) => item.roleId === memberRole.id)!
      .allowedModelIds as string[];
    const forbiddenGrant = await raw('/api/v1/admin/ai/entitlements', {
      method: 'PUT',
      token: memberToken,
      headers: { 'Idempotency-Key': 'member-grant-model' },
      body: { roleId: memberRole.id, allowedModelIds: [...allowed, id] },
    });
    expect(forbiddenGrant.status).toBe(403);
    await json('/api/v1/admin/ai/entitlements', {
      method: 'PUT',
      token: adminToken,
      headers: { 'Idempotency-Key': 'admin-grant-model' },
      body: { roleId: memberRole.id, allowedModelIds: [...allowed, id] },
    });
    const adminModels = await json<Array<{ id: string }>>('/api/v1/app/ai/models', {
      token: adminToken,
    });
    expect(adminModels.data?.some((item) => item.id === id)).toBe(false);
    const models = await json<Array<{ id: string }>>('/api/v1/app/ai/models', {
      token: memberToken,
    });
    expect(models.data?.some((item) => item.id === created.data?.id)).toBe(true);

    const duplicate = await raw('/api/v1/admin/ai/models', {
      method: 'POST',
      token: adminToken,
      headers: { 'Idempotency-Key': 'create-stage-a-model-again' },
      body: payload,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error?.code).toBe('AI_MODEL_EXISTS');
    expect(await prisma.aiModel.count({ where: { modelKey: payload.modelId } })).toBe(1);

    const forbidden = await raw('/api/v1/admin/ai/models', {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'member-create-stage-a-model' },
      body: { ...payload, modelId: 'member-model' },
    });
    expect(forbidden.status).toBe(403);

    await json(`/api/v1/admin/ai/models/${created.data?.id}`, {
      method: 'PATCH',
      token: adminToken,
      headers: { 'Idempotency-Key': 'disable-stage-a-model' },
      body: { enabled: false },
    });
    const after = await json<Array<{ id: string }>>('/api/v1/app/ai/models', {
      token: memberToken,
    });
    expect(after.data?.some((item) => item.id === created.data?.id)).toBe(false);
  });

  it('Chat/Text 默认独立，编辑和清空定价校验最终状态，失败不改变数据库', async () => {
    const originalChat = await prisma.aiTool.findUniqueOrThrow({
      where: { code: AiToolCode.CHAT },
    });
    const originalText = await prisma.aiTool.findUniqueOrThrow({
      where: { code: AiToolCode.TEXT },
    });
    const created = await json<{ id: string; defaultToolTypes: string[] }>(
      '/api/v1/admin/ai/models',
      {
        method: 'POST',
        token: adminToken,
        headers: { 'Idempotency-Key': 'create-chat-default' },
        body: {
          providerCode: 'fake',
          modelId: 'separate-chat-default',
          maxOutputTokens: null,
          displayName: 'Chat 默认测试',
          toolTypes: ['chat'],
          enabled: true,
          visibleToUser: true,
          isDefault: true,
          defaultToolTypes: ['chat'],
          contextTokens: 8192,
          inputPricePer1k: 1,
          outputPricePer1k: 2,
        },
      },
    );
    const id = created.data!.id;
    expect(created.data?.defaultToolTypes).toEqual(['chat']);
    expect(
      (await prisma.aiTool.findUniqueOrThrow({ where: { code: AiToolCode.CHAT } })).defaultModelId,
    ).toBe(id);
    expect(
      (await prisma.aiTool.findUniqueOrThrow({ where: { code: AiToolCode.TEXT } })).defaultModelId,
    ).toBe(originalText.defaultModelId);
    const adminConfig = await json<{ models: Array<{ id: string; defaultToolTypes: string[] }> }>(
      '/api/v1/admin/ai/config',
      { token: adminToken },
    );
    expect(
      adminConfig.data?.models.find((model) => model.id === originalText.defaultModelId)
        ?.defaultToolTypes,
    ).toContain('text');
    const snapshot = await prisma.aiModel.findUniqueOrThrow({ where: { id } });
    expect(snapshot.maxOutputTokens).toBe(2048);
    await prisma.aiProvider.update({
      where: { id: snapshot.providerId },
      data: { enabled: false },
    });
    await expect(ai.patchModel(id, { defaultToolTypes: [AiToolCode.CHAT] })).rejects.toThrow(
      '停用厂商',
    );
    await prisma.aiProvider.update({ where: { id: snapshot.providerId }, data: { enabled: true } });
    const invalidPatches = [
      { inputPricePer1k: 0, outputPricePer1k: 0, fixedPlatformCost: null },
      { inputPricePer1k: 0.1 },
      { toolTypes: [] },
      { defaultToolTypes: ['text'] },
      { displayName: '   ' },
      { enabled: null },
    ];
    for (const [index, body] of invalidPatches.entries()) {
      const invalid = await raw(`/api/v1/admin/ai/models/${id}`, {
        method: 'PATCH',
        token: adminToken,
        headers: { 'Idempotency-Key': `invalid-model-config-${index}` },
        body,
      });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error?.code).toBeTruthy();
      expect(await prisma.aiModel.findUniqueOrThrow({ where: { id } })).toEqual(snapshot);
    }
    await ai.patchModel(id, { fixedPlatformCost: 10 });
    const cleared = await json<{ fixedPlatformCost: number | null; displayName: string }>(
      `/api/v1/admin/ai/models/${id}`,
      {
        method: 'PATCH',
        token: adminToken,
        headers: { 'Idempotency-Key': 'clear-fixed-cost' },
        body: { fixedPlatformCost: null },
      },
    );
    expect(cleared.data?.fixedPlatformCost).toBeNull();
    expect(cleared.data?.displayName).toBe('Chat 默认测试');
    await ai.patchModel(id, {
      toolTypes: [AiToolCode.CHAT, AiToolCode.TEXT],
      defaultToolTypes: [AiToolCode.CHAT],
    });
    expect(
      (await prisma.aiTool.findUniqueOrThrow({ where: { code: AiToolCode.TEXT } })).defaultModelId,
    ).toBe(originalText.defaultModelId);
    await ai.patchModel(id, { enabled: false });
    expect(
      (await prisma.aiTool.findUniqueOrThrow({ where: { code: AiToolCode.CHAT } })).defaultModelId,
    ).toBeNull();
    await ai.patchTool(originalChat.id, { defaultModelId: originalChat.defaultModelId });
  });

  it('并发首次保存同厂商密钥均成功且只保留一行凭据', async () => {
    const provider = await ai.createProvider({
      code: 'concurrent-key',
      label: '并发凭据测试',
      providerType: 'openai-compatible',
      baseUrl: 'https://example.com/v1',
    });
    await Promise.all([
      ai.patchProvider(provider.id, { apiKey: 'first-local-test-key' }),
      ai.patchProvider(provider.id, { apiKey: 'second-local-test-key' }),
    ]);
    expect(await prisma.aiProviderCredential.count({ where: { providerId: provider.id } })).toBe(1);
  });

  it('真实厂商缺少 Key 时返回错误并释放额度，不生成 Fake 成功回答', async () => {
    const provider = await ai.createProvider({
      code: 'missing-chat-key',
      label: '无凭据测试',
      providerType: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:9/v1',
    });
    const created = await json<{ id: string }>('/api/v1/admin/ai/models', {
      method: 'POST',
      token: adminToken,
      headers: { 'Idempotency-Key': 'create-no-key-model' },
      body: {
        providerCode: provider.code,
        modelId: 'no-key-model',
        displayName: '无凭据模型',
        toolTypes: ['chat'],
        enabled: true,
        visibleToUser: true,
        isDefault: false,
        contextTokens: 8192,
        inputPricePer1k: 1,
        outputPricePer1k: 2,
      },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'member@example.com' } });
    const entitlement = await prisma.aiEntitlement.findUniqueOrThrow({
      where: { roleId: user.roleId },
    });
    await ai.putEntitlement(user.roleId, {
      allowedModelIds: [...(entitlement.allowedModelIds as string[]), created.data!.id],
    });
    const account = await prisma.aiQuotaAccount.findUniqueOrThrow({ where: { userId: user.id } });
    const session = await json<{ id: string }>('/api/v1/app/ai/sessions', {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'no-key-session' },
      body: { modelId: created.data!.id },
    });
    const response = await fetch(`${baseUrl}/api/v1/app/ai/sessions/${session.data!.id}/messages`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json',
        'Idempotency-Key': 'no-key-chat',
      },
      body: JSON.stringify({ content: '验证缺少凭据' }),
    });
    const stream = await response.text();
    expect(stream).toContain('AI_PROVIDER_KEY_MISSING');
    expect(stream).not.toContain('我收到了');
    expect(stream).not.toContain('"type":"DONE"');
    const after = await prisma.aiQuotaAccount.findUniqueOrThrow({ where: { userId: user.id } });
    expect(after.availableAmount).toBe(account.availableAmount);
    expect(after.reservedAmount).toBe(account.reservedAmount);
    expect(await prisma.aiUsageRecord.count({ where: { modelId: created.data!.id } })).toBe(0);
  });

  it('匿名 Chat 登录后可认领历史', async () => {
    const models = await json<Array<{ id: string; toolTypes: string[] }>>(
      '/api/v1/public/ai/models',
    );
    const chatModel = models.data?.find((item) => item.toolTypes.includes('chat'));
    expect(chatModel).toBeTruthy();
    const stream = await fetch(`${baseUrl}/api/v1/public/ai/chat`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        'Idempotency-Key': 'guest-chat-1',
      },
      body: JSON.stringify({ content: '访客先聊一句', modelId: chatModel?.id }),
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
    expect(
      sessions.data?.list.some((item) => item.title.includes('访客') || item.title.includes('聊')),
    ).toBe(true);
  });

  it('公开导航仍返回禁用和即将上线项', async () => {
    const publicNav = await json<Array<{ code: string; status: string }>>(
      '/api/v1/public/ai/navigation',
    );
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

  it('保存厂商密钥后不回显，Fake 测试不写用量', async () => {
    const secret = 'sk-phase-a-secret-should-not-leak';
    const filingNote = 'FILING-PHASE-A-9f3c';
    const config = await json<{ providers: Array<{ id: string; code: string }> }>(
      '/api/v1/admin/ai/config',
      { token: adminToken },
    );
    const fake = config.data?.providers.find((item) => item.code === 'fake');
    expect(fake).toBeTruthy();
    const usageBefore = await prisma.aiUsageRecord.count();
    const publicKey = await json<AiCredentialPublicKey>('/api/v1/admin/ai/credential-key', {
      token: adminToken,
    });
    expect(publicKey.data?.publicKey).toBeTruthy();
    const encryptedApiKey = await encryptCredentialForRequest(secret, publicKey.data!);
    expect(JSON.stringify(encryptedApiKey)).not.toContain(secret);
    const saved = await json<Record<string, unknown>>(`/api/v1/admin/ai/providers/${fake!.id}`, {
      method: 'PATCH',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-provider-key-1' },
      body: {
        encryptedApiKey,
        remark: '阶段 A 备注',
        sourceFiled: true,
        filingNote,
      },
    });
    const savedText = JSON.stringify(saved);
    expect(savedText).not.toContain(secret);
    expect(savedText).not.toContain('apiKeyMasked');
    expect(saved.data?.hasKey).toBe(true);
    expect(saved.data?.filingNote).toBe(filingNote);
    const stored = await prisma.aiProviderCredential.findFirst({
      where: { providerId: fake!.id },
    });
    expect(stored?.ciphertext).toBeTruthy();
    expect(stored?.ciphertext.includes(secret)).toBe(false);
    expect(stored?.nonce.includes(secret)).toBe(false);

    const plaintextAttempt = await raw(`/api/v1/admin/ai/providers/${fake!.id}`, {
      method: 'PATCH',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-provider-plaintext-rejected' },
      body: { apiKey: secret },
    });
    expect(plaintextAttempt.status).toBe(400);

    const created = await json<{ id: string; code: string; hasKey: boolean }>(
      '/api/v1/admin/ai/providers',
      {
        method: 'POST',
        token: adminToken,
        headers: { 'Idempotency-Key': 'ai-provider-create-1' },
        body: {
          code: 'phase-a-new-provider',
          label: '阶段 A 新厂商',
          providerType: 'openai-compatible',
          baseUrl: 'https://api.example.com',
          encryptedApiKey,
        },
      },
    );
    expect(created.data?.hasKey).toBe(true);
    expect(JSON.stringify(created)).not.toContain(secret);
    const duplicate = await raw('/api/v1/admin/ai/providers', {
      method: 'POST',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-provider-create-duplicate' },
      body: {
        code: 'phase-a-new-provider',
        label: '重复厂商',
        providerType: 'openai-compatible',
        baseUrl: 'https://api.example.com',
      },
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error?.code).toBe('AI_PROVIDER_CODE_EXISTS');

    const again = await json<{
      providers: Array<{ id: string; hasKey: boolean; remark: string; filingNote: string }>;
    }>('/api/v1/admin/ai/config', { token: adminToken });
    const listed = again.data?.providers.find((item) => item.id === fake!.id);
    expect(listed?.hasKey).toBe(true);
    expect(listed?.remark).toBe('阶段 A 备注');
    expect(listed?.filingNote).toBe(filingNote);
    const publicSite = await json<unknown>('/api/v1/public/site-config');
    const publicModels = await json<unknown>('/api/v1/public/ai/models');
    expect(JSON.stringify(publicSite)).not.toContain(filingNote);
    expect(JSON.stringify(publicModels)).not.toContain(filingNote);
    expect(JSON.stringify(again)).not.toContain(secret);

    const tested = await json<{ ok: boolean; message: string }>(
      `/api/v1/admin/ai/providers/${fake!.id}/test`,
      {
        method: 'POST',
        token: adminToken,
        headers: { 'Idempotency-Key': 'ai-provider-test-fake-1' },
        body: {},
      },
    );
    expect(tested.data?.ok).toBe(true);
    expect(await prisma.aiUsageRecord.count()).toBe(usageBefore);
    const withoutKey = await raw(`/api/v1/admin/ai/providers/${fake!.id}/test`, {
      method: 'POST',
      token: adminToken,
      body: {},
    });
    expect(withoutKey.status).toBe(400);
    expect(withoutKey.body.error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const upstream = await prisma.aiProvider.create({
      data: {
        code: 'phase-a-upstream',
        label: '测试兼容厂商',
        baseUrl: 'http://127.0.0.1:9/v1',
        authEnvKey: 'AI_OPENAI_API_KEY',
        enabled: true,
      },
    });
    const missing = await raw(`/api/v1/admin/ai/providers/${upstream.id}/test`, {
      method: 'POST',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-provider-test-missing-1' },
      body: {},
    });
    expect(missing.status).toBe(400);
    expect(String(missing.body.error?.message)).toContain('AI_OPENAI_API_KEY');
    process.env.AI_OPENAI_API_KEY = secret;
    const network = await raw(`/api/v1/admin/ai/providers/${upstream.id}/test`, {
      method: 'POST',
      token: adminToken,
      headers: { 'Idempotency-Key': 'ai-provider-test-network-1' },
      body: {},
    });
    expect(JSON.stringify(network.body)).not.toContain(secret);
    expect(network.status).toBeGreaterThanOrEqual(400);
    delete process.env.AI_OPENAI_API_KEY;

    const rollbackProvider = await prisma.aiProvider.create({
      data: { code: 'phase-a-rollback', label: '回滚测试厂商' },
    });
    await expect(
      ai.patchProvider(rollbackProvider.id, {
        apiKey: 'sk-rollback-should-not-persist',
        name: 'x'.repeat(81),
      }),
    ).rejects.toThrow();
    expect(
      await prisma.aiProviderCredential.count({ where: { providerId: rollbackProvider.id } }),
    ).toBe(0);
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
