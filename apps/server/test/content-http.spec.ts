import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ContentType, DataScope, ImportRestriction, RoleCode, UserStatus } from '@prisma/client';
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

describe('Content HTTP', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let stopPostgres: (() => Promise<unknown>) | undefined;
  let stopRedis: (() => Promise<unknown>) | undefined;
  let ownerToken = '';
  let adminToken = '';
  let editorToken = '';
  let memberToken = '';

  beforeAll(async () => {
    const postgres = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'personal_hub_content_test',
        POSTGRES_USER: 'personal_hub_content_test',
        POSTGRES_PASSWORD: 'personal_hub_content_test_password',
      })
      .withExposedPorts(5432)
      .start();
    stopPostgres = () => postgres.stop();

    const redis = await new GenericContainer('redis:7-alpine')
      .withCommand(['redis-server', '--appendonly', 'no'])
      .withExposedPorts(6379)
      .start();
    stopRedis = () => redis.stop();

    const databaseUrl = `postgresql://personal_hub_content_test:personal_hub_content_test_password@${postgres.getHost()}:${postgres.getMappedPort(5432)}/personal_hub_content_test?schema=public`;
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
      REDIS_KEY_PREFIX: 'ph:content-http-test',
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
      throw new Error('Content HTTP 测试服务未能监听随机端口');
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
    const [superAdmin, admin, editor, member, readPermission, purgePermission] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.SUPER_ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.EDITOR } }),
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.MEMBER } }),
      prisma.permission.findUniqueOrThrow({ where: { code: 'content:read' } }),
      prisma.permission.findUniqueOrThrow({ where: { code: 'content:purge' } }),
    ]);
    await Promise.all([
      // 专门制造「读 ALL、更新 OWN」组合，防止写操作错误复用 content:read 范围。
      prisma.rolePermission.update({
        where: { roleId_permissionId: { roleId: editor.id, permissionId: readPermission.id } },
        data: { dataScope: DataScope.ALL },
      }),
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: admin.id, permissionId: purgePermission.id } },
        create: { roleId: admin.id, permissionId: purgePermission.id, dataScope: DataScope.ALL },
        update: { dataScope: DataScope.ALL },
      }),
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
          email: 'admin@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: admin.id,
          emailVerifiedAt: new Date(),
          mustChangePassword: false,
          nickname: 'Admin',
        },
        {
          email: 'editor@example.com',
          passwordHash,
          status: UserStatus.ACTIVE,
          roleId: editor.id,
          emailVerifiedAt: new Date(),
          mustChangePassword: false,
          nickname: 'Editor',
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

    ownerToken = await login('owner@example.com');
    adminToken = await login('admin@example.com');
    editorToken = await login('editor@example.com');
    memberToken = await login('member@example.com');
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await stopRedis?.();
    await stopPostgres?.();
  });

  it('公开列表含 PUBLIC，LOGIN 对访客锁定；详情 LOGIN 返回 401', async () => {
    const created = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'create-login-md' },
      body: {
        type: 'MARKDOWN',
        title: '登录可见文',
        categorySlug: 'frontend',
        visibility: 'LOGIN',
        markdownSource: '# 秘密\n\n只有登录能看。',
      },
    });
    await json(`/api/v1/app/contents/${created.data?.id}/publish`, {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'pub-login-md' },
    });

    const publicMd = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'create-public-md' },
      body: {
        type: 'MARKDOWN',
        title: '公开 Nest 文章',
        categorySlug: 'frontend',
        visibility: 'PUBLIC',
        markdownSource: '# 公开\n\n正文。',
        tagNames: ['React'],
      },
    });
    await json(`/api/v1/app/contents/${publicMd.data?.id}/publish`, {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'pub-public-md' },
    });

    const list = await json<{
      list: Array<{ title: string; locked: boolean; visibility: string }>;
    }>('/api/v1/public/contents');
    expect(
      list.data?.list.some((item) => item.title === '公开 Nest 文章' && item.locked === false),
    ).toBe(true);
    expect(
      list.data?.list.some((item) => item.title === '登录可见文' && item.locked === true),
    ).toBe(true);

    const anonDetail = await raw(`/api/v1/public/contents/${created.data?.id}`);
    expect(anonDetail.status).toBe(401);
    expect(anonDetail.body.error?.code).toBe('AUTH_REQUIRED');

    const memberDetail = await json<{ markdownSource: string }>(
      `/api/v1/public/contents/${created.data?.id}`,
      { token: memberToken },
    );
    expect(memberDetail.data?.markdownSource).toContain('只有登录能看');
  });

  it('私有内容公开路径 404；标签 AND 与中文 keyword 可用', async () => {
    const created = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'create-private' },
      body: { type: 'MARKDOWN', title: '私有草稿', markdownSource: 'x' },
    });
    const hidden = await raw(`/api/v1/public/contents/${created.data?.id}`);
    expect(hidden.status).toBe(404);

    const tagged = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'create-and-tags' },
      body: {
        type: 'MARKDOWN',
        title: '中文检索标题知识库',
        categorySlug: 'frontend',
        visibility: 'PUBLIC',
        markdownSource: '正文',
        tagNames: ['React', 'Umi'],
      },
    });
    await json(`/api/v1/app/contents/${tagged.data?.id}/publish`, {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'pub-and-tags' },
    });

    const andHit = await json<{ total: number }>('/api/v1/public/contents?tagSlugs=react,umi');
    expect((andHit.data?.total ?? 0) >= 1).toBe(true);
    const andMiss = await json<{ total: number }>(
      '/api/v1/public/contents?tagSlugs=react,not-exist',
    );
    expect(andMiss.data?.total).toBe(0);
    const keyword = await json<{ total: number }>(
      `/api/v1/public/contents?keyword=${encodeURIComponent('知识')}`,
    );
    expect((keyword.data?.total ?? 0) >= 1).toBe(true);
  });

  it('member 不能创建内容，但能收藏已公开内容', async () => {
    const forbidden = await raw('/api/v1/app/contents', {
      method: 'POST',
      token: memberToken,
      headers: { 'Idempotency-Key': 'member-create' },
      body: { type: 'MARKDOWN' },
    });
    expect(forbidden.status).toBe(403);

    const listed = await json<{ list: Array<{ id: string; title: string }> }>(
      '/api/v1/public/contents',
    );
    const publicId = listed.data?.list.find((item) => item.title === '公开 Nest 文章')?.id;
    expect(publicId).toBeTruthy();
    const fav = await json<{ favorited: boolean }>(`/api/v1/app/favorites/${publicId}`, {
      method: 'PUT',
      token: memberToken,
    });
    expect(fav.data?.favorited).toBe(true);
  });

  it('管理员可设精选，工作区 PATCH 不能改 isFeatured', async () => {
    const listed = await json<{ list: Array<{ id: string; title: string }> }>(
      '/api/v1/public/contents',
    );
    const publicId = listed.data?.list.find((item) => item.title === '公开 Nest 文章')
      ?.id as string;
    await json(`/api/v1/admin/contents/${publicId}/featured`, {
      method: 'PATCH',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'feat-1' },
      body: { featured: true },
    });
    const featured = await json<Array<{ id: string; isFeatured: boolean }>>(
      '/api/v1/public/contents/featured',
    );
    expect(featured.data?.some((item) => item.id === publicId && item.isFeatured)).toBe(true);
  });

  it('写操作使用自身 OWN 范围，不能因 content:read ALL 编辑他人内容', async () => {
    const created = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'owner-content-for-scope' },
      body: { type: 'MARKDOWN', title: '仅所有者可编辑', markdownSource: '正文' },
    });
    const response = await raw(`/api/v1/app/contents/${created.data?.id}`, {
      method: 'PATCH',
      token: editorToken,
      headers: { 'Idempotency-Key': 'editor-patch-other-content' },
      body: { title: '不应更新' },
    });

    expect(response.status).toBe(404);
    expect(response.body.error?.code).toBe('CONTENT_NOT_FOUND');
  });

  it('精选对访客仅返回 PUBLIC，登录用户可看到 LOGIN', async () => {
    const loginContent = await prisma.content.findFirstOrThrow({
      where: { title: '登录可见文' },
      select: { id: true },
    });
    await json(`/api/v1/admin/contents/${loginContent.id}/featured`, {
      method: 'PATCH',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'feature-login-content' },
      body: { featured: true },
    });

    const anonymous = await json<Array<{ id: string }>>('/api/v1/public/contents/featured');
    const authenticated = await json<Array<{ id: string }>>('/api/v1/public/contents/featured', {
      token: memberToken,
    });
    expect(anonymous.data?.some((item) => item.id === loginContent.id)).toBe(false);
    expect(authenticated.data?.some((item) => item.id === loginContent.id)).toBe(true);
  });

  it('非 SUPER_ADMIN 即使被错误授予 purge ALL 也不能物理删除', async () => {
    const created = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: adminToken,
      headers: { 'Idempotency-Key': 'admin-content-for-purge' },
      body: { type: 'MARKDOWN', title: '不能被普通管理员清理', markdownSource: '正文' },
    });
    await json(`/api/v1/app/contents/${created.data?.id}`, {
      method: 'DELETE',
      token: adminToken,
      headers: { 'Idempotency-Key': 'admin-soft-delete-for-purge' },
    });
    const response = await raw(`/api/v1/admin/contents/${created.data?.id}/purge`, {
      method: 'DELETE',
      token: adminToken,
      headers: { 'Idempotency-Key': 'admin-purge-denied' },
      body: { reason: '验证权限边界' },
    });

    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe('AUTH_FORBIDDEN');
    expect(await prisma.content.findUnique({ where: { id: created.data?.id } })).not.toBeNull();
  });

  it('富文本保存时净化 HTML，净化后为空的正文不能发布', async () => {
    const rich = await json<{ id: string; renderedHtml: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'create-sanitized-rich-text' },
      body: {
        type: 'RICH_TEXT',
        title: '富文本内容',
        categorySlug: 'frontend',
        visibility: 'PUBLIC',
        editorDocument: { html: '<p>富文本正文</p><script>alert(1)</script>' },
      },
    });
    expect(rich.data?.renderedHtml).toContain('<p>富文本正文</p>');
    expect(rich.data?.renderedHtml).not.toContain('<script>');

    const invalid = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'create-empty-rich-text' },
      body: {
        type: 'RICH_TEXT',
        title: '无效富文本',
        categorySlug: 'frontend',
        editorDocument: { html: '<script>alert(1)</script>' },
      },
    });
    const publish = await raw(`/api/v1/app/contents/${invalid.data?.id}/publish`, {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'publish-empty-rich-text' },
    });
    expect(publish.status).toBe(422);
    expect(publish.body.error?.code).toBe('CONTENT_PUBLISH_VALIDATION_FAILED');
  });

  it('拒绝不属于内容的章节进度，并在写入前校验分类父节点和重复标签', async () => {
    const [publicContent, loginContent] = await Promise.all([
      prisma.content.findFirstOrThrow({ where: { title: '公开 Nest 文章' }, select: { id: true } }),
      prisma.content.findFirstOrThrow({ where: { title: '登录可见文' }, select: { id: true } }),
    ]);
    const chapter = await prisma.contentChapter.create({
      data: { contentId: loginContent.id, title: '其他内容章节', chapterOrder: 1 },
    });
    const reading = await raw(`/api/v1/app/reading-records/${publicContent.id}`, {
      method: 'PUT',
      token: memberToken,
      body: { contentProgressPercent: 10, chapterId: chapter.id },
    });
    const missingParent = await raw('/api/v1/admin/categories', {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'category-missing-parent' },
      body: {
        name: '无效父分类',
        slug: 'invalid-parent-category',
        parentId: '00000000-0000-4000-8000-000000000001',
      },
    });
    const tagged = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'create-duplicate-tags' },
      body: {
        type: 'MARKDOWN',
        title: '重复标签',
        markdownSource: '正文',
        tagNames: ['重复标签', '重复标签 '],
      },
    });

    expect(reading.status).toBe(422);
    expect(reading.body.error?.code).toBe('CONTENT_READING_VALIDATION_FAILED');
    expect(missingParent.status).toBe(404);
    expect(missingParent.body.error?.code).toBe('CATEGORY_NOT_FOUND');
    expect(await prisma.contentTag.count({ where: { contentId: tagged.data?.id } })).toBe(1);
  });

  it('无效 UUID 与缺失幂等键在控制器层被拒绝', async () => {
    const invalidId = await raw('/api/v1/app/contents/not-a-uuid', {
      method: 'GET',
      token: editorToken,
    });
    const missingKey = await raw('/api/v1/app/contents/00000000-0000-4000-8000-000000000001', {
      method: 'PATCH',
      token: editorToken,
      body: { title: '无效请求' },
    });

    expect(invalidId.status).toBe(400);
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('同一幂等键并发只产生一次副作用并回放同一响应', async () => {
    const body = {
      type: 'MARKDOWN',
      title: '幂等并发文章',
      categorySlug: 'frontend',
      visibility: 'PRIVATE',
      markdownSource: '# 并发\n\n正文。',
    };
    const results = await Promise.all([
      raw('/api/v1/app/contents', {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'concurrent-same-key-create' },
        body,
      }),
      raw('/api/v1/app/contents', {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'concurrent-same-key-create' },
        body,
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 201]);
    const first = results[0]?.body.data as { id?: string } | undefined;
    const second = results[1]?.body.data as { id?: string } | undefined;
    expect(first?.id).toBeTruthy();
    expect(first?.id).toBe(second?.id);
    expect(await prisma.content.count({ where: { title: '幂等并发文章' } })).toBe(1);
    const record = await prisma.idempotencyRecord.findFirstOrThrow({
      where: { idempotencyKey: 'concurrent-same-key-create' },
    });
    expect(record.state).toBe('COMPLETED');
    expect(record.completedAt).toBeTruthy();
  });

  it('过期幂等记录允许同键换请求体重新执行', async () => {
    await json('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'ttl-expired-create' },
      body: {
        type: 'MARKDOWN',
        title: 'TTL 过期前',
        categorySlug: 'frontend',
        markdownSource: '# 过期前',
      },
    });
    await prisma.idempotencyRecord.updateMany({
      where: { idempotencyKey: 'ttl-expired-create' },
      data: { expiresAt: new Date(0) },
    });

    const reused = await json<{ title: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'ttl-expired-create' },
      body: {
        type: 'MARKDOWN',
        title: 'TTL 过期后',
        categorySlug: 'frontend',
        markdownSource: '# 过期后',
      },
    });
    expect(reused.data?.title).toBe('TTL 过期后');
    expect(await prisma.content.count({ where: { title: { in: ['TTL 过期前', 'TTL 过期后'] } } })).toBe(
      2,
    );
  });

  it('同一幂等键搭配不同请求体返回指纹冲突', async () => {
    await json('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'fingerprint-mismatch-create' },
      body: {
        type: 'MARKDOWN',
        title: '指纹原文',
        categorySlug: 'frontend',
        markdownSource: '# 原文',
      },
    });
    const conflict = await raw('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'fingerprint-mismatch-create' },
      body: {
        type: 'MARKDOWN',
        title: '指纹改写',
        categorySlug: 'frontend',
        markdownSource: '# 改写',
      },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error?.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('导入版权闸拒绝空白授权说明', async () => {
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@example.com' } });
    const imported = await prisma.content.create({
      data: {
        type: ContentType.MARKDOWN,
        title: '需要版权说明的导入内容',
        authorId: owner.id,
        importRestriction: ImportRestriction.PRIVATE_UNTIL_LICENSED,
      },
    });

    const response = await raw(`/api/v1/admin/contents/${imported.id}/import-license`, {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'blank-import-license-note' },
      body: { note: '   ' },
    });

    expect(response.status).toBe(422);
    expect(response.body.error?.code).toBe('CONTENT_COPYRIGHT_NOTE_REQUIRED');
    expect(
      (await prisma.content.findUniqueOrThrow({ where: { id: imported.id } })).importRestriction,
    ).toBe(ImportRestriction.PRIVATE_UNTIL_LICENSED);
  });

  it('并发审核只能有一个请求原子抢占 PENDING 状态', async () => {
    const created = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'create-concurrent-review' },
      body: {
        type: 'MARKDOWN',
        title: '并发审核文章',
        categorySlug: 'frontend',
        visibility: 'PUBLIC',
        markdownSource: '# 审核\n\n正文。',
      },
    });
    await json(`/api/v1/app/contents/${created.data?.id}/publish`, {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'submit-concurrent-review' },
    });
    const review = await prisma.contentReview.findFirstOrThrow({
      where: { contentId: created.data?.id, status: 'PENDING' },
    });

    const results = await Promise.all([
      raw(`/api/v1/admin/content-reviews/${review.id}/approve`, {
        method: 'POST',
        token: ownerToken,
        headers: { 'Idempotency-Key': 'approve-concurrent-review-a' },
      }),
      raw(`/api/v1/admin/content-reviews/${review.id}/approve`, {
        method: 'POST',
        token: ownerToken,
        headers: { 'Idempotency-Key': 'approve-concurrent-review-b' },
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect((await prisma.contentReview.findUniqueOrThrow({ where: { id: review.id } })).status).toBe(
      'APPROVED',
    );
    expect((await prisma.content.findUniqueOrThrow({ where: { id: created.data?.id } })).status).toBe(
      'PUBLISHED',
    );
  });

  it('并发通过与驳回只有一个终态', async () => {
    const created = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'create-approve-reject-race' },
      body: {
        type: 'MARKDOWN',
        title: '通过驳回竞态',
        categorySlug: 'frontend',
        visibility: 'PUBLIC',
        markdownSource: '# 竞态\n\n正文。',
      },
    });
    await json(`/api/v1/app/contents/${created.data?.id}/publish`, {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'submit-approve-reject-race' },
    });
    const review = await prisma.contentReview.findFirstOrThrow({
      where: { contentId: created.data?.id, status: 'PENDING' },
    });

    const results = await Promise.all([
      raw(`/api/v1/admin/content-reviews/${review.id}/approve`, {
        method: 'POST',
        token: ownerToken,
        headers: { 'Idempotency-Key': 'approve-reject-race-a' },
      }),
      raw(`/api/v1/admin/content-reviews/${review.id}/reject`, {
        method: 'POST',
        token: ownerToken,
        headers: { 'Idempotency-Key': 'approve-reject-race-b' },
        body: { reason: '标题需要更具体' },
      }),
    ]);

    const statuses = results.map((result) => result.status).sort((left, right) => left - right);
    expect(statuses).toContain(409);
    expect(statuses.some((status) => status === 200 || status === 201)).toBe(true);
    const final = await prisma.contentReview.findUniqueOrThrow({ where: { id: review.id } });
    expect(['APPROVED', 'REJECTED']).toContain(final.status);
  });

  it('驳回拒绝空白原因', async () => {
    const created = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'create-blank-reject' },
      body: {
        type: 'MARKDOWN',
        title: '空白驳回',
        categorySlug: 'frontend',
        visibility: 'PUBLIC',
        markdownSource: '# 驳回\n\n正文。',
      },
    });
    await json(`/api/v1/app/contents/${created.data?.id}/publish`, {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'submit-blank-reject' },
    });
    const review = await prisma.contentReview.findFirstOrThrow({
      where: { contentId: created.data?.id, status: 'PENDING' },
    });
    const blank = await raw(`/api/v1/admin/content-reviews/${review.id}/reject`, {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'blank-reject-reason' },
      body: { reason: '   ' },
    });
    expect(blank.status).toBe(422);
    expect(blank.body.error?.code).toBe('CONTENT_REVIEW_REASON_REQUIRED');
    expect((await prisma.contentReview.findUniqueOrThrow({ where: { id: review.id } })).status).toBe(
      'PENDING',
    );
  });

  it('编辑者发布进入审核队列，管理员通过后才公开；驳回保持草稿', async () => {
    const created = await json<{ id: string; status: string; reviewStatus: string | null }>(
      '/api/v1/app/contents',
      {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'create-review-md' },
        body: {
          type: 'MARKDOWN',
          title: '待审核文章',
          categorySlug: 'frontend',
          visibility: 'PUBLIC',
          markdownSource: '# 审核\n\n正文。',
        },
      },
    );
    const submitted = await json<{ status: string; reviewStatus: string | null }>(
      `/api/v1/app/contents/${created.data?.id}/publish`,
      {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'submit-review-md' },
      },
    );
    expect(submitted.data?.status).toBe('DRAFT');
    expect(submitted.data?.reviewStatus).toBe('PENDING');

    const publicHidden = await raw(`/api/v1/public/contents/${created.data?.id}`);
    expect(publicHidden.status).toBe(404);

    const editorForbidden = await raw('/api/v1/admin/content-reviews', { token: editorToken });
    expect(editorForbidden.status).toBe(403);

    const listed = await json<{
      list: Array<{ id: string; status: string; content: { id: string } }>;
      total: number;
    }>('/api/v1/admin/content-reviews?status=PENDING', { token: ownerToken });
    const review = listed.data?.list.find((item) => item.content.id === created.data?.id);
    expect(review).toBeTruthy();

    const again = await json<{ reviewStatus: string | null }>(
      `/api/v1/app/contents/${created.data?.id}/publish`,
      {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'submit-review-md-again' },
      },
    );
    expect(again.data?.reviewStatus).toBe('PENDING');
    expect(
      (
        await json<{ total: number }>('/api/v1/admin/content-reviews?status=PENDING', {
          token: ownerToken,
        })
      ).data?.total,
    ).toBe(listed.data?.total);

    const rejected = await json<{ status: string; rejectReason: string | null }>(
      `/api/v1/admin/content-reviews/${review?.id}/reject`,
      {
        method: 'POST',
        token: ownerToken,
        headers: { 'Idempotency-Key': 'reject-review-md' },
        body: { reason: '标题需要更具体' },
      },
    );
    expect(rejected.data?.status).toBe('REJECTED');
    expect(rejected.data?.rejectReason).toBe('标题需要更具体');
    const rejectedAgain = await raw(`/api/v1/admin/content-reviews/${review?.id}/reject`, {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'reject-review-md-again' },
      body: { reason: '不能重复处理' },
    });
    expect(rejectedAgain.status).toBe(409);
    expect(rejectedAgain.body.error?.code).toBe('CONTENT_REVIEW_INVALID_STATE');
    const afterReject = await json<{ status: string; reviewStatus: string | null }>(
      `/api/v1/app/contents/${created.data?.id}`,
      { token: editorToken },
    );
    expect(afterReject.data?.status).toBe('DRAFT');
    expect(afterReject.data?.reviewStatus).toBe('REJECTED');

    const resubmit = await json<{ reviewStatus: string | null }>(
      `/api/v1/app/contents/${created.data?.id}/publish`,
      {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'resubmit-review-md' },
      },
    );
    expect(resubmit.data?.reviewStatus).toBe('PENDING');
    const pendingAgain = await json<{
      list: Array<{ id: string; content: { id: string } }>;
    }>('/api/v1/admin/content-reviews?status=PENDING', { token: ownerToken });
    const nextReview = pendingAgain.data?.list.find((item) => item.content.id === created.data?.id);

    const approved = await json<{ status: string; content: { status: string; visibility: string } }>(
      `/api/v1/admin/content-reviews/${nextReview?.id}/approve`,
      {
        method: 'POST',
        token: ownerToken,
        headers: { 'Idempotency-Key': 'approve-review-md' },
      },
    );
    expect(approved.data?.status).toBe('APPROVED');
    expect(approved.data?.content.status).toBe('PUBLISHED');
    const publicDetail = await json<{ title: string }>(`/api/v1/public/contents/${created.data?.id}`);
    expect(publicDetail.data?.title).toBe('待审核文章');
  });

  it('所有者发布仍即时生效，不进审核队列', async () => {
    const created = await json<{ id: string }>('/api/v1/app/contents', {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'owner-direct-publish' },
      body: {
        type: 'MARKDOWN',
        title: '所有者直接发布',
        categorySlug: 'frontend',
        visibility: 'PUBLIC',
        markdownSource: '# 直接发布',
      },
    });
    const published = await json<{ status: string; reviewStatus: string | null }>(
      `/api/v1/app/contents/${created.data?.id}/publish`,
      {
        method: 'POST',
        token: ownerToken,
        headers: { 'Idempotency-Key': 'owner-direct-publish-go' },
      },
    );
    expect(published.data?.status).toBe('PUBLISHED');
    expect(published.data?.reviewStatus).toBeNull();
    const publicDetail = await json<{ title: string }>(`/api/v1/public/contents/${created.data?.id}`);
    expect(publicDetail.data?.title).toBe('所有者直接发布');
  });

  async function login(email: string): Promise<string> {
    const res = await json<{ accessToken: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password: PASSWORD },
    });
    const token = res.data?.accessToken ?? '';
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
