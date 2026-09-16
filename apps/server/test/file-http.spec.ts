import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { FilePurpose, RoleCode, UserStatus } from '@prisma/client';
import JSZip from 'jszip';
import { Logger } from 'nestjs-pino';
import { GenericContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { configureHttpApp } from '../src/bootstrap';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { MemoryStorageProvider } from '../src/infrastructure/storage/memory-storage.provider';
import { BookletImportService } from '../src/modules/booklet/booklet-import.service';
import { runBaselineSeed } from '../prisma/seed';

const serverDirectory = resolve(__dirname, '..');
const ORIGIN = 'http://localhost:8000';
const PASSWORD = 'OwnerPass!1';

interface Envelope<T> {
  data?: T;
  error?: { code: string; message: string };
  requestId: string;
}

describe('File / booklet HTTP', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let storage: MemoryStorageProvider;
  let imports: BookletImportService;
  let stopPostgres: (() => Promise<unknown>) | undefined;
  let stopRedis: (() => Promise<unknown>) | undefined;
  let editorToken = '';
  let ownerToken = '';
  let memberToken = '';

  beforeAll(async () => {
    const postgres = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'personal_hub_file_test',
        POSTGRES_USER: 'personal_hub_file_test',
        POSTGRES_PASSWORD: 'personal_hub_file_test_password',
      })
      .withExposedPorts(5432)
      .withStartupTimeout(120_000)
      .start();
    stopPostgres = () => postgres.stop();

    const redis = await new GenericContainer('redis:7-alpine')
      .withCommand(['redis-server', '--appendonly', 'no'])
      .withExposedPorts(6379)
      .withStartupTimeout(120_000)
      .start();
    stopRedis = () => redis.stop();

    const databaseUrl = `postgresql://personal_hub_file_test:personal_hub_file_test_password@${postgres.getHost()}:${postgres.getMappedPort(5432)}/personal_hub_file_test?schema=public`;
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
      REDIS_KEY_PREFIX: 'ph:file-http-test',
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
      throw new Error('File HTTP 测试服务未能监听随机端口');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
    storage = app.get(MemoryStorageProvider);
    imports = app.get(BookletImportService);
    await runBaselineSeed(prisma);

    const passwordHash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const [superAdmin, editor, member] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.SUPER_ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { code: RoleCode.EDITOR } }),
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
    editorToken = await login('editor@example.com');
    memberToken = await login('member@example.com');
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await stopRedis?.();
    await stopPostgres?.();
  });

  it('预签名 complete 后可创建 PDF，封面签名 URL 非空', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n');
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const pdfFile = await uploadReady(editorToken, {
      purpose: FilePurpose.CONTENT_FILE,
      originalName: 'guide.pdf',
      mimeType: 'application/pdf',
      body: pdf,
    });
    const coverFile = await uploadReady(editorToken, {
      purpose: FilePurpose.COVER,
      originalName: 'cover.jpg',
      mimeType: 'image/jpeg',
      body: jpeg,
    });
    const created = await json<{ id: string; previewUrl: string | null; coverUrl: string | null }>(
      '/api/v1/app/contents',
      {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'create-pdf-1' },
        body: {
          type: 'PDF',
          title: 'PDF 指南',
          categorySlug: 'frontend',
          primaryFileId: pdfFile.id,
          coverFileId: coverFile.id,
        },
      },
    );
    expect(created.data?.previewUrl).toContain('memory://download/');
    expect(created.data?.coverUrl).toContain('memory://download/');
  });

  it('完成上传只读取魔数前缀，并流式计算完整 SHA-256', async () => {
    const body = Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n'),
      Buffer.alloc(256 * 1024, 65),
      Buffer.from('\n%%EOF\n'),
    ]);
    const fullRead = vi.spyOn(storage, 'getObject');
    const file = await uploadReady(editorToken, {
      purpose: FilePurpose.CONTENT_FILE,
      originalName: 'streamed-hash.pdf',
      mimeType: 'application/pdf',
      body,
    });
    const row = await prisma.fileAsset.findUniqueOrThrow({ where: { id: file.id } });
    expect(fullRead).not.toHaveBeenCalled();
    expect(row.sha256).toBe(createHash('sha256').update(body).digest('hex'));
    fullRead.mockRestore();
  });

  it('complete 魔数不符时把 FileAsset 标为 FAILED', async () => {
    const body = Buffer.from('this-is-not-a-pdf');
    const session = await json<{ uploadId: string; objectKey: string; fileId: string }>(
      '/api/v1/app/uploads',
      {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'upload-failed-magic' },
        body: {
          purpose: FilePurpose.CONTENT_FILE,
          originalName: 'fake.pdf',
          mimeType: 'application/pdf',
          size: body.length,
        },
      },
    );
    await storage.simulateBrowserPut(session.data?.objectKey as string, body, 'application/pdf');
    const failed = await raw(`/api/v1/app/uploads/${session.data?.uploadId}/complete`, {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'complete-failed-magic' },
    });
    expect(failed.status).toBe(422);
    expect(failed.body.error?.code).toBe('FILE_VALIDATION_FAILED');
    expect(
      (await prisma.fileAsset.findUniqueOrThrow({ where: { id: session.data?.fileId } })).status,
    ).toBe('FAILED');
  });

  it('超过 20MiB 的 PDF 走 multipart complete', async () => {
    const body = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(20 * 1024 * 1024 - 8, 65),
      Buffer.from('\n%%EOF\n'),
    ]);
    const session = await json<{
      uploadId: string;
      objectKey: string;
      mode: string;
      parts: Array<{ partNumber: number }> | null;
      partSize: number | null;
    }>('/api/v1/app/uploads', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'multipart-pdf-session' },
      body: {
        purpose: FilePurpose.CONTENT_FILE,
        originalName: 'multipart.pdf',
        mimeType: 'application/pdf',
        size: body.length,
      },
    });
    expect(session.data?.mode).toBe('MULTIPART');
    expect(session.data?.parts?.length).toBeGreaterThan(1);
    const partSize = session.data?.partSize ?? 8 * 1024 * 1024;
    for (const part of session.data?.parts ?? []) {
      const start = (part.partNumber - 1) * partSize;
      await storage.simulateBrowserPart(
        session.data?.objectKey as string,
        part.partNumber,
        body.subarray(start, start + partSize),
      );
    }
    const ready = await json<{ id: string; size: number }>(
      `/api/v1/app/uploads/${session.data?.uploadId}/complete`,
      {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'multipart-pdf-complete' },
        body: {
          parts: (session.data?.parts ?? []).map((part) => ({
            partNumber: part.partNumber,
            etag: `"part-${part.partNumber}"`,
          })),
        },
      },
    );
    expect(ready.data?.size).toBe(body.length);
  });

  it('并发 complete 同一会话只落一次 READY', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n');
    const session = await json<{ uploadId: string; objectKey: string; fileId: string }>(
      '/api/v1/app/uploads',
      {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'concurrent-complete-session' },
        body: {
          purpose: FilePurpose.CONTENT_FILE,
          originalName: 'concurrent-complete.pdf',
          mimeType: 'application/pdf',
          size: pdf.length,
        },
      },
    );
    await storage.simulateBrowserPut(session.data?.objectKey as string, pdf, 'application/pdf');
    const [first, second] = await Promise.all([
      json<{ id: string; status: string }>(`/api/v1/app/uploads/${session.data?.uploadId}/complete`, {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'concurrent-complete-a' },
      }),
      json<{ id: string; status: string }>(`/api/v1/app/uploads/${session.data?.uploadId}/complete`, {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'concurrent-complete-b' },
      }),
    ]);
    expect(first.data?.status).toBe('READY');
    expect(second.data?.status).toBe('READY');
    const file = await prisma.fileAsset.findUniqueOrThrow({ where: { id: session.data?.fileId } });
    expect(file.status).toBe('READY');
  });

  it('心跳过期的 VALIDATING 导入可被重新认领', async () => {
    const zip = new JSZip();
    zip.file('stale/meta.json', JSON.stringify({ title: '僵死导入' }));
    zip.file('stale/01.md', '# 章\n\n正文。');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const source = await uploadReady(editorToken, {
      purpose: FilePurpose.TEMPORARY_IMPORT,
      originalName: 'stale-import.zip',
      mimeType: 'application/zip',
      body: zipBuffer,
    });
    const job = await json<{ id: string }>('/api/v1/app/booklet-imports', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'stale-import-claim' },
      body: { sourceFileId: source.id },
    });
    await prisma.bookletImportJob.update({
      where: { id: job.data?.id },
      data: {
        status: 'VALIDATING',
        startedAt: new Date(Date.now() - 60_000),
        heartbeatAt: new Date(Date.now() - 60_000),
        contentId: null,
      },
    });
    await imports.processJob(job.data?.id as string);
    const finished = await prisma.bookletImportJob.findUniqueOrThrow({
      where: { id: job.data?.id },
    });
    expect(finished.status).toBe('SUCCEEDED');
    expect(finished.contentId).toBeTruthy();
  });

  it('心跳仍新的 VALIDATING 不会被第二个 processJob 抢走', async () => {
    const zip = new JSZip();
    zip.file('live/meta.json', JSON.stringify({ title: '进行中导入' }));
    zip.file('live/01.md', '# 章\n\n正文。');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const source = await uploadReady(editorToken, {
      purpose: FilePurpose.TEMPORARY_IMPORT,
      originalName: 'live-import.zip',
      mimeType: 'application/zip',
      body: zipBuffer,
    });
    const job = await json<{ id: string }>('/api/v1/app/booklet-imports', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'live-import-claim' },
      body: { sourceFileId: source.id },
    });
    await prisma.bookletImportJob.update({
      where: { id: job.data?.id },
      data: {
        status: 'VALIDATING',
        startedAt: new Date(),
        heartbeatAt: new Date(),
        contentId: null,
      },
    });
    await imports.processJob(job.data?.id as string);
    const stillRunning = await prisma.bookletImportJob.findUniqueOrThrow({
      where: { id: job.data?.id },
    });
    expect(stillRunning.status).toBe('VALIDATING');
    expect(stillRunning.contentId).toBeNull();
  });

  it('数据库提交失败时保留源 ZIP，恢复后仍可重新导入', async () => {
    const zip = new JSZip();
    zip.file('retry/meta.json', JSON.stringify({ title: '可重试源文件' }));
    zip.file('retry/01.md', '# 第一章\n\n正文。');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const source = await uploadReady(editorToken, {
      purpose: FilePurpose.TEMPORARY_IMPORT,
      originalName: 'retry-source.zip',
      mimeType: 'application/zip',
      body: zipBuffer,
    });
    const job = await json<{ id: string }>('/api/v1/app/booklet-imports', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'retry-source-import' },
      body: { sourceFileId: source.id },
    });
    const sourceBefore = await prisma.fileAsset.findUniqueOrThrow({ where: { id: source.id } });
    const putSpy = vi.spyOn(storage, 'putObject');
    const transaction = vi
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('模拟数据库提交失败'));
    await expect(imports.processJob(job.data?.id as string)).rejects.toThrow('模拟数据库提交失败');
    const writtenKeys = putSpy.mock.calls.map(([key]) => key);
    putSpy.mockRestore();
    transaction.mockRestore();

    expect(writtenKeys.length).toBeGreaterThan(0);
    for (const key of writtenKeys) {
      await expect(storage.getObject(key)).rejects.toThrow();
    }
    const sourceAfterFailure = await prisma.fileAsset.findUniqueOrThrow({
      where: { id: source.id },
    });
    expect(sourceAfterFailure.objectKey).toBe(sourceBefore.objectKey);
    await expect(storage.getObject(sourceBefore.objectKey)).resolves.toEqual(zipBuffer);
    expect(await prisma.content.count({ where: { title: '可重试源文件' } })).toBe(0);

    const retried = await json<{ id: string; status: string }>(
      `/api/v1/app/booklet-imports/${job.data?.id}/retry`,
      {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'retry-source-import-http' },
      },
    );
    expect(retried.data?.id).toBe(job.data?.id);
    expect(retried.data?.status).toBe('QUEUED');
    const outbox = await prisma.outboxEvent.findMany({
      where: { aggregateId: job.data?.id, eventType: 'BOOKLET_IMPORT_REQUESTED' },
    });
    expect(outbox.length).toBeGreaterThanOrEqual(2);

    await imports.processJob(job.data?.id as string);
    const finished = await prisma.bookletImportJob.findUniqueOrThrow({
      where: { id: job.data?.id },
    });
    expect(finished.status).toBe('SUCCEEDED');
    expect(await prisma.content.count({ where: { title: '可重试源文件' } })).toBe(1);
    const archived = await prisma.fileAsset.findUniqueOrThrow({ where: { id: source.id } });
    expect(archived.objectKey).not.toBe(sourceBefore.objectKey);
    await expect(storage.getObject(archived.objectKey)).resolves.toEqual(zipBuffer);
    await expect(storage.getObject(sourceBefore.objectKey)).rejects.toThrow();
  });

  it('ZIP 导入后公开看不到，作者可读单章；import-license 后可改公开', async () => {
    const zip = new JSZip();
    zip.file('demo/meta.json', JSON.stringify({ title: '异步导入小册', summary: '私有草稿' }));
    zip.file('demo/01.md', '# 第一章\n\n导入正文。');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const source = await uploadReady(editorToken, {
      purpose: FilePurpose.TEMPORARY_IMPORT,
      originalName: 'demo.zip',
      mimeType: 'application/zip',
      body: zipBuffer,
    });
    const job = await json<{ id: string }>('/api/v1/app/booklet-imports', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'import-zip-1' },
      body: { sourceFileId: source.id },
    });
    const again = await json<{ id: string }>('/api/v1/app/booklet-imports', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'import-zip-1' },
      body: { sourceFileId: source.id },
    });
    expect(again.data?.id).toBe(job.data?.id);

    await imports.processJob(job.data?.id as string);
    const done = await json<{ status: string; contentId: string | null }>(
      `/api/v1/app/booklet-imports/${job.data?.id}`,
      { token: editorToken },
    );
    expect(done.data?.status).toBe('SUCCEEDED');
    const contentId = done.data?.contentId as string;

    const anon = await raw(`/api/v1/public/contents/${contentId}`);
    expect(anon.status).toBe(404);

    const chapters = await json<{ list: Array<{ id: string; title: string }> }>(
      `/api/v1/public/contents/${contentId}/chapters`,
      { token: editorToken },
    );
    expect(chapters.data?.list).toHaveLength(1);
    const chapterId = chapters.data?.list[0]?.id as string;
    const chapter = await json<{ markdownSource: string }>(
      `/api/v1/public/contents/${contentId}/chapters/${chapterId}`,
      { token: editorToken },
    );
    expect(chapter.data?.markdownSource).toContain('导入正文');

    const memberHidden = await raw(`/api/v1/public/contents/${contentId}`, { token: memberToken });
    expect(memberHidden.status).toBe(404);

    const forbiddenLicense = await raw(`/api/v1/admin/contents/${contentId}/import-license`, {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'license-editor' },
      body: { note: '不能解除' },
    });
    expect(forbiddenLicense.status).toBe(403);

    await json(`/api/v1/admin/contents/${contentId}/import-license`, {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'license-owner' },
      body: { note: '已确认可公开' },
    });
    await json(`/api/v1/app/contents/${contentId}`, {
      method: 'PATCH',
      token: editorToken,
      headers: { 'Idempotency-Key': 'patch-public-booklet' },
      body: { visibility: 'PUBLIC', categorySlug: 'frontend' },
    });
    await json(`/api/v1/app/contents/${contentId}/publish`, {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'pub-booklet' },
    });
    const publicDetail = await json<{ title: string }>(`/api/v1/public/contents/${contentId}`);
    expect(publicDetail.data?.title).toBe('异步导入小册');
  });

  it('后台文件列表需要 file:read ALL；被引用文件不能删', async () => {
    const listed = await json<{
      list: Array<{ id: string; purpose?: string; referencedBy: string[] }>;
      total: number;
    }>('/api/v1/admin/files', { token: ownerToken });
    expect((listed.data?.total ?? 0) >= 1).toBe(true);
    const referenced = listed.data?.list.find((item) => item.referencedBy.length > 0);
    expect(referenced).toBeTruthy();
    const bookletSource = listed.data?.list.find((item) => item.purpose === 'BOOKLET_SOURCE');
    expect(bookletSource?.referencedBy.length).toBeGreaterThan(0);
    const blocked = await raw(`/api/v1/admin/files/${referenced?.id}`, {
      method: 'DELETE',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'del-in-use' },
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error?.code).toBe('FILE_IN_USE');

    const memberDenied = await raw('/api/v1/admin/files', { token: memberToken });
    expect(memberDenied.status).toBe(403);
  });

  it('GET booklet-imports 仅当前用户；GET files 排除已挂导入任务的 ZIP', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n');
    const pdfFile = await uploadReady(editorToken, {
      purpose: FilePurpose.CONTENT_FILE,
      originalName: 'task-list.pdf',
      mimeType: 'application/pdf',
      body: pdf,
    });
    const zip = new JSZip();
    zip.file('list/meta.json', JSON.stringify({ title: '任务列表小册' }));
    zip.file('list/01.md', '# 章\n\n正文。');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const source = await uploadReady(editorToken, {
      purpose: FilePurpose.TEMPORARY_IMPORT,
      originalName: 'task-list.zip',
      mimeType: 'application/zip',
      body: zipBuffer,
    });

    const beforeImport = await json<{
      list: Array<{ id: string; originalName: string; purpose: string; contentId: string | null }>;
    }>('/api/v1/app/files', { token: editorToken });
    expect(beforeImport.data?.list.some((item) => item.id === pdfFile.id)).toBe(true);
    expect(beforeImport.data?.list.some((item) => item.id === source.id)).toBe(true);

    const job = await json<{ id: string }>('/api/v1/app/booklet-imports', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'import-task-list' },
      body: { sourceFileId: source.id },
    });
    const afterAttach = await json<{ list: Array<{ id: string }> }>('/api/v1/app/files', {
      token: editorToken,
    });
    expect(afterAttach.data?.list.some((item) => item.id === source.id)).toBe(false);
    expect(afterAttach.data?.list.some((item) => item.id === pdfFile.id)).toBe(true);

    const jobs = await json<{
      list: Array<{ id: string; originalName: string | null; createdAt: string }>;
      total: number;
    }>('/api/v1/app/booklet-imports', { token: editorToken });
    expect(jobs.data?.list.some((item) => item.id === job.data?.id)).toBe(true);
    expect(jobs.data?.list.find((item) => item.id === job.data?.id)?.originalName).toBe(
      'task-list.zip',
    );

    const ownerJobs = await json<{ list: Array<{ id: string }> }>('/api/v1/app/booklet-imports', {
      token: ownerToken,
    });
    expect(ownerJobs.data?.list.some((item) => item.id === job.data?.id)).toBe(false);
  });

  it('GET upload-tasks 合并任务并在服务端按时间真分页', async () => {
    const before = await json<{ total: number }>('/api/v1/app/upload-tasks?page=1&pageSize=1', {
      token: editorToken,
    });
    const pdf = await uploadReady(editorToken, {
      purpose: FilePurpose.CONTENT_FILE,
      originalName: 'unified-page.pdf',
      mimeType: 'application/pdf',
      body: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n'),
    });
    const zip = new JSZip();
    zip.file('unified/01.md', '# 章\n\n正文。');
    const source = await uploadReady(editorToken, {
      purpose: FilePurpose.TEMPORARY_IMPORT,
      originalName: 'unified-page.zip',
      mimeType: 'application/zip',
      body: await zip.generateAsync({ type: 'nodebuffer' }),
    });
    const job = await json<{ id: string }>('/api/v1/app/booklet-imports', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'unified-page-import' },
      body: { sourceFileId: source.id },
    });
    const firstPage = await json<{
      list: Array<{ id: string; taskType: string }>;
      total: number;
      page: number;
      pageSize: number;
      hasActiveBookletImports: boolean;
    }>('/api/v1/app/upload-tasks?page=1&pageSize=1', { token: editorToken });
    const secondPage = await json<{ list: Array<{ id: string; taskType: string }> }>(
      '/api/v1/app/upload-tasks?page=2&pageSize=1',
      { token: editorToken },
    );
    expect(firstPage.data?.total).toBe((before.data?.total ?? 0) + 2);
    expect(firstPage.data?.page).toBe(1);
    expect(firstPage.data?.pageSize).toBe(1);
    expect(firstPage.data?.hasActiveBookletImports).toBe(true);
    expect(firstPage.data?.list).toHaveLength(1);
    expect(secondPage.data?.list).toHaveLength(1);
    expect([firstPage.data?.list[0]?.id, secondPage.data?.list[0]?.id]).toEqual(
      expect.arrayContaining([pdf.id, job.data?.id]),
    );

    const rejected = await raw('/api/v1/app/upload-tasks?page=1&mimeKind=pdf', {
      token: editorToken,
    });
    expect(rejected.status).toBe(400);

    const defaultPage = await json<{ page: number; pageSize: number }>(
      '/api/v1/app/upload-tasks',
      { token: editorToken },
    );
    expect(defaultPage.data?.page).toBe(1);
    expect(defaultPage.data?.pageSize).toBe(10);

    const pdfOnly = await json<{
      list: Array<{ id: string; taskType: string; mimeType: string | null }>;
      total: number;
    }>('/api/v1/app/upload-tasks?page=1&pageSize=10&taskKind=pdf', { token: editorToken });
    expect(pdfOnly.data?.list.every((item) => item.taskType === 'FILE' && item.mimeType === 'application/pdf')).toBe(
      true,
    );
    expect(pdfOnly.data?.list.some((item) => item.id === pdf.id)).toBe(true);
    expect(pdfOnly.data?.list.some((item) => item.id === job.data?.id)).toBe(false);

    const bookletOnly = await json<{ list: Array<{ id: string; taskType: string }>; total: number }>(
      '/api/v1/app/upload-tasks?page=1&pageSize=10&taskKind=booklet',
      { token: editorToken },
    );
    expect(bookletOnly.data?.list.every((item) => item.taskType === 'BOOKLET_IMPORT')).toBe(true);
    expect(bookletOnly.data?.list.some((item) => item.id === job.data?.id)).toBe(true);
  });

  it('隐藏上传任务条目不删文件和导入草稿', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n');
    const pdfFile = await uploadReady(editorToken, {
      purpose: FilePurpose.CONTENT_FILE,
      originalName: 'hide-task.pdf',
      mimeType: 'application/pdf',
      body: pdf,
    });
    await json(`/api/v1/app/files/${pdfFile.id}`, { method: 'DELETE', token: editorToken });
    const files = await json<{ list: Array<{ id: string }> }>('/api/v1/app/files', {
      token: editorToken,
    });
    expect(files.data?.list.some((item) => item.id === pdfFile.id)).toBe(false);
    const stillThere = await prisma.fileAsset.findUnique({ where: { id: pdfFile.id } });
    expect(stillThere?.deletedAt).toBeNull();
    expect(stillThere?.hiddenFromTaskList).toBe(true);

    const zip = new JSZip();
    zip.file('hide/meta.json', JSON.stringify({ title: '隐藏任务小册' }));
    zip.file('hide/01.md', '# 章\n\n正文。');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const source = await uploadReady(editorToken, {
      purpose: FilePurpose.TEMPORARY_IMPORT,
      originalName: 'hide-task.zip',
      mimeType: 'application/zip',
      body: zipBuffer,
    });
    const job = await json<{ id: string; contentId: string | null }>(
      '/api/v1/app/booklet-imports',
      {
        method: 'POST',
        token: editorToken,
        headers: { 'Idempotency-Key': 'hide-import-task' },
        body: { sourceFileId: source.id },
      },
    );
    await json(`/api/v1/app/booklet-imports/${job.data?.id}`, {
      method: 'DELETE',
      token: editorToken,
    });
    const jobs = await json<{ list: Array<{ id: string }> }>('/api/v1/app/booklet-imports', {
      token: editorToken,
    });
    expect(jobs.data?.list.some((item) => item.id === job.data?.id)).toBe(false);
    const jobRow = await prisma.bookletImportJob.findUnique({ where: { id: job.data?.id } });
    expect(jobRow?.hiddenFromTaskList).toBe(true);
    expect(await prisma.fileAsset.findUnique({ where: { id: source.id } })).toBeTruthy();
  });

  it('编辑者发布导入小册进入审核，通过时必须填版权说明', async () => {
    const zip = new JSZip();
    zip.file('review/meta.json', JSON.stringify({ title: '审核导入小册', summary: '待审' }));
    zip.file('review/01.md', '# 第一章\n\n导入正文。');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const source = await uploadReady(editorToken, {
      purpose: FilePurpose.TEMPORARY_IMPORT,
      originalName: 'review-import.zip',
      mimeType: 'application/zip',
      body: zipBuffer,
    });
    const job = await json<{ id: string }>('/api/v1/app/booklet-imports', {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'import-review-zip' },
      body: { sourceFileId: source.id },
    });
    await imports.processJob(job.data?.id as string);
    const done = await json<{ contentId: string | null }>(
      `/api/v1/app/booklet-imports/${job.data?.id}`,
      { token: editorToken },
    );
    const contentId = done.data?.contentId as string;
    await json(`/api/v1/app/contents/${contentId}`, {
      method: 'PATCH',
      token: editorToken,
      headers: { 'Idempotency-Key': 'patch-review-booklet-cat' },
      body: { categorySlug: 'frontend' },
    });
    await json(`/api/v1/app/contents/${contentId}/publish`, {
      method: 'POST',
      token: editorToken,
      headers: { 'Idempotency-Key': 'submit-review-booklet' },
      body: { requestedVisibility: 'PUBLIC' },
    });
    const queued = await json<{
      list: Array<{ id: string; requestedVisibility: string; content: { id: string } }>;
    }>('/api/v1/admin/content-reviews?status=PENDING', { token: ownerToken });
    const review = queued.data?.list.find((item) => item.content.id === contentId);
    expect(review?.requestedVisibility).toBe('PUBLIC');

    const missingNote = await raw(`/api/v1/admin/content-reviews/${review?.id}/approve`, {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'approve-booklet-no-note' },
    });
    expect(missingNote.status).toBe(409);
    expect(missingNote.body.error?.code).toBe('CONTENT_COPYRIGHT_NOTE_REQUIRED');

    await json(`/api/v1/admin/content-reviews/${review?.id}/approve`, {
      method: 'POST',
      token: ownerToken,
      headers: { 'Idempotency-Key': 'approve-booklet-with-note' },
      body: { copyrightNote: '已确认可公开转载' },
    });
    const publicDetail = await json<{ title: string }>(`/api/v1/public/contents/${contentId}`);
    expect(publicDetail.data?.title).toBe('审核导入小册');
  });

  async function uploadReady(
    token: string,
    input: { purpose: FilePurpose; originalName: string; mimeType: string; body: Buffer },
  ): Promise<{ id: string }> {
    const session = await json<{ uploadId: string; objectKey: string; fileId: string }>(
      '/api/v1/app/uploads',
      {
        method: 'POST',
        token,
        headers: { 'Idempotency-Key': `upload-${input.originalName}-${Date.now()}` },
        body: {
          purpose: input.purpose,
          originalName: input.originalName,
          mimeType: input.mimeType,
          size: input.body.length,
        },
      },
    );
    await storage.simulateBrowserPut(session.data?.objectKey as string, input.body, input.mimeType);
    const ready = await json<{ id: string }>(
      `/api/v1/app/uploads/${session.data?.uploadId}/complete`,
      {
        method: 'POST',
        token,
        headers: { 'Idempotency-Key': `complete-${input.originalName}-${Date.now()}` },
      },
    );
    return { id: ready.data?.id as string };
  }

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
