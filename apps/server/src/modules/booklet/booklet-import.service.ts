import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  BookletImportStatus,
  ContentSourceType,
  ContentStatus,
  ContentType,
  ContentVisibility,
  DataScope,
  FileAssetStatus,
  FilePurpose,
  ImportRestriction,
  ImportSource,
  Prisma,
  StorageProviderKind,
} from '@prisma/client';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OutboxService } from '../../infrastructure/queue/outbox.service';
import { BOOKLET_IMPORT_EVENT } from '../../infrastructure/queue/queue.constants';
import { STORAGE_PROVIDER, type StorageProvider } from '../../infrastructure/storage/storage.types';
import { AuthService } from '../auth/auth.service';
import { deriveMarkdown } from '../content/content-markdown';
import { FileService } from '../file/file.service';
import { sanitizeFileName } from '../file/file-magic';
import { parseBookletZipFile, writeAsyncIterableToFile } from './parse-booklet-zip';

/** 心跳停止超过该时间后，允许其它 worker 重新认领 VALIDATING/IMPORTING。 */
const IMPORT_STALE_MS = 45_000;
const IMPORT_HEARTBEAT_MS = 15_000;

@Injectable()
export class BookletImportService {
  private readonly logger = new Logger(BookletImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly files: FileService,
    private readonly auth: AuthService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async createJob(
    auth: { userId: string; permissionVersion: number },
    sourceFileId: string,
    idempotencyKey: string,
  ) {
    await this.assertImport(auth);
    const existing = await this.prisma.bookletImportJob.findUnique({
      where: { requesterId_idempotencyKey: { requesterId: auth.userId, idempotencyKey } },
    });
    if (existing) {
      return this.toJob(existing);
    }
    const source = await this.files.requireReadyOwnedFile(
      auth.userId,
      sourceFileId,
      FilePurpose.TEMPORARY_IMPORT,
    );
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.bookletImportJob.create({
        data: {
          requesterId: auth.userId,
          sourceFileId: source.id,
          idempotencyKey,
          status: BookletImportStatus.QUEUED,
        },
      });
      await this.outbox.enqueue(tx, {
        aggregateType: 'booklet_import_job',
        aggregateId: created.id,
        eventType: BOOKLET_IMPORT_EVENT,
        payload: { jobId: created.id },
      });
      return created;
    });
    return this.toJob(job);
  }

  async getJob(auth: { userId: string; permissionVersion: number }, jobId: string) {
    const job = await this.prisma.bookletImportJob.findUnique({
      where: { id: jobId },
      include: { sourceFile: true },
    });
    if (!job) {
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'BOOKLET_IMPORT_FAILED',
        '导入任务不存在',
      );
    }
    const snapshot = await this.auth.getPermissionSnapshot(auth.userId, auth.permissionVersion);
    const grant = snapshot.permissions.find((item) => item.code === 'booklet:import');
    const all = grant?.dataScope === DataScope.ALL;
    if (job.requesterId !== auth.userId && !all) {
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'BOOKLET_IMPORT_FAILED',
        '导入任务不存在',
      );
    }
    return this.toJob(job, job.sourceFile.originalName);
  }

  /**
   * 当前用户的小册导入任务分页。ALL 可看全部，OWN 只看自己的。
   */
  async listMine(
    auth: { userId: string; permissionVersion: number },
    query: { page?: number; pageSize?: number },
  ) {
    await this.assertImport(auth);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where = { requesterId: auth.userId, hiddenFromTaskList: false };
    const [list, total] = await Promise.all([
      this.prisma.bookletImportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { sourceFile: true },
      }),
      this.prisma.bookletImportJob.count({ where }),
    ]);
    return {
      list: list.map((job) => this.toJob(job, job.sourceFile.originalName)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 仅从上传任务列表隐藏该导入记录，不删草稿内容、不删源 ZIP。
   */
  async hideMine(auth: { userId: string; permissionVersion: number }, jobId: string) {
    await this.assertImport(auth);
    const job = await this.prisma.bookletImportJob.findUnique({ where: { id: jobId } });
    if (!job || job.requesterId !== auth.userId) {
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        'BOOKLET_IMPORT_FAILED',
        '导入任务不存在',
      );
    }
    await this.prisma.bookletImportJob.update({
      where: { id: jobId },
      data: { hiddenFromTaskList: true },
    });
    return null;
  }

  async retry(auth: { userId: string; permissionVersion: number }, jobId: string) {
    const current = await this.getJob(auth, jobId);
    if (current.status !== BookletImportStatus.FAILED) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'BOOKLET_IMPORT_NOT_RETRYABLE',
        '只能重试失败任务',
      );
    }
    // 重置同一条失败任务并重新入队，避免再创建一份内容。
    const reset = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.bookletImportJob.updateMany({
        where: { id: jobId, status: BookletImportStatus.FAILED },
        data: {
          status: BookletImportStatus.QUEUED,
          progress: 0,
          errorCode: null,
          errorMessage: null,
          finishedAt: null,
          startedAt: null,
        },
      });
      if (claimed.count !== 1) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'BOOKLET_IMPORT_NOT_RETRYABLE',
          '只能重试失败任务',
        );
      }
      await this.outbox.enqueue(tx, {
        aggregateType: 'booklet_import_job',
        aggregateId: jobId,
        eventType: BOOKLET_IMPORT_EVENT,
        payload: { jobId },
      });
      return tx.bookletImportJob.findUniqueOrThrow({ where: { id: jobId } });
    });
    return this.toJob(reset, current.originalName);
  }

  /**
   * CLI 存量迁移：不走 HTTP 预签名，直接把 ZIP 写入存储后复用 processJob。
   */
  async importOwnedZip(
    requesterId: string,
    zipBuffer: Buffer,
    originalName: string,
    idempotencyKey: string,
  ) {
    const existing = await this.prisma.bookletImportJob.findUnique({
      where: { requesterId_idempotencyKey: { requesterId, idempotencyKey } },
    });
    if (existing) {
      if (
        existing.status === BookletImportStatus.SUCCEEDED ||
        existing.status === BookletImportStatus.PARTIAL_SUCCESS
      ) {
        return this.toJob(existing);
      }
    }
    const fileId = randomUUID();
    const name = sanitizeFileName(originalName);
    const objectKey = `temporary/${fileId}/${name}`;
    await this.storage.putObject(objectKey, zipBuffer, 'application/zip');
    await this.prisma.fileAsset.create({
      data: {
        id: fileId,
        uploaderId: requesterId,
        originalName: name,
        objectKey,
        storageProvider: StorageProviderKind.MINIO,
        mimeType: 'application/zip',
        size: zipBuffer.length,
        purpose: FilePurpose.TEMPORARY_IMPORT,
        status: FileAssetStatus.READY,
      },
    });
    const job = await this.prisma.bookletImportJob.create({
      data: {
        requesterId,
        sourceFileId: fileId,
        idempotencyKey,
        status: BookletImportStatus.QUEUED,
      },
    });
    await this.processJob(job.id);
    const next = await this.prisma.bookletImportJob.findUniqueOrThrow({ where: { id: job.id } });
    return this.toJob(next);
  }

  /**
   * Worker 与测试共用。HTTP 只负责建任务，不在请求里解压 ZIP。
   * 源 ZIP 留到内容/章节事务提交成功后再归档；失败补偿已写入对象，重试仍读原 key。
   */
  async processJob(jobId: string): Promise<void> {
    const job = await this.prisma.bookletImportJob.findUnique({
      where: { id: jobId },
      include: { sourceFile: true, requester: true },
    });
    if (
      !job ||
      job.contentId ||
      job.status === BookletImportStatus.SUCCEEDED ||
      job.status === BookletImportStatus.PARTIAL_SUCCESS
    ) {
      return;
    }
    // QUEUED/FAILED 立即认领；VALIDATING/IMPORTING 只在心跳过期后抢占，避免活着的 worker 被抢走。
    const claimed = await this.claimImportJob(jobId);
    if (claimed.count !== 1) {
      return;
    }
    const writtenKeys: string[] = [];
    const sourceObjectKey = job.sourceFile.objectKey;
    const stopHeartbeat = this.startImportHeartbeat(jobId);
    let tmpDir: string | undefined;
    try {
      tmpDir = await mkdtemp(join(tmpdir(), 'booklet-import-'));
      const zipPath = join(tmpDir, 'source.zip');
      await writeAsyncIterableToFile(await this.storage.getObjectStream(sourceObjectKey), zipPath);
      const parsed = await parseBookletZipFile(
        zipPath,
        job.sourceFile.originalName.replace(/\.zip$/i, ''),
      );
      await this.prisma.bookletImportJob.update({
        where: { id: jobId },
        data: {
          status: BookletImportStatus.IMPORTING,
          progress: 30,
          heartbeatAt: new Date(),
          totalChapters: parsed.chapters.length,
          warnings: parsed.warnings,
        },
      });

      const contentId = randomUUID();
      const category = parsed.categorySlug
        ? await this.prisma.category.findFirst({
            where: { slug: parsed.categorySlug, enabled: true },
          })
        : null;
      const chapterRows = parsed.chapters.map((chapter) => ({
        id: randomUUID(),
        title: chapter.title,
        order: chapter.order,
        markdown: chapter.markdown,
        objectKey: `booklets/${contentId}/chapters/${randomUUID()}.md`,
      }));

      for (const chapter of chapterRows) {
        await this.storage.putObject(
          chapter.objectKey,
          Buffer.from(chapter.markdown, 'utf8'),
          'text/markdown; charset=utf-8',
        );
        writtenKeys.push(chapter.objectKey);
      }
      const manifestKey = `booklets/${contentId}/manifest.json`;
      await this.storage.putObject(
        manifestKey,
        Buffer.from(
          JSON.stringify({
            chapters: chapterRows.map((item) => ({
              id: item.id,
              title: item.title,
              order: item.order,
            })),
          }),
          'utf8',
        ),
        'application/json',
      );
      writtenKeys.push(manifestKey);
      const sourceKey = `booklets/${contentId}/source/source.zip`;

      const first = chapterRows[0];
      const derived = first ? deriveMarkdown(first.markdown) : { html: '', toc: [], wordCount: 0 };

      await this.prisma.$transaction(async (tx) => {
        await tx.fileAsset.update({
          where: { id: job.sourceFileId },
          data: {
            purpose: FilePurpose.BOOKLET_SOURCE,
            status: FileAssetStatus.READY,
          },
        });
        await tx.content.create({
          data: {
            id: contentId,
            type: ContentType.BOOKLET,
            title: parsed.title ?? '未命名小册',
            summary: parsed.summary,
            authorId: job.requesterId,
            categoryId: category?.id,
            status: ContentStatus.DRAFT,
            visibility: ContentVisibility.PRIVATE,
            sourceType: ContentSourceType.IMPORT,
            importSource: ImportSource.MANUAL,
            importRestriction: ImportRestriction.PRIVATE_UNTIL_LICENSED,
            wordCount: chapterRows.reduce(
              (sum, item) => sum + deriveMarkdown(item.markdown).wordCount,
              0,
            ),
            body: {
              create: {
                markdownSource: first?.markdown,
                renderedHtml: derived.html,
                toc: derived.toc as unknown as Prisma.InputJsonValue,
              },
            },
            chapters: {
              create: chapterRows.map((item) => ({
                id: item.id,
                title: item.title,
                chapterOrder: item.order,
                objectKey: item.objectKey,
                wordCount: deriveMarkdown(item.markdown).wordCount,
              })),
            },
          },
        });
        if (parsed.tags && parsed.tags.length > 0) {
          for (const raw of parsed.tags) {
            const name = raw.trim();
            if (!name) {
              continue;
            }
            const normalized = name.toLowerCase();
            const tag = await tx.tag.upsert({
              where: { normalizedName: normalized },
              create: {
                name,
                normalizedName: normalized,
                slug:
                  normalized
                    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 80) || `tag-${contentId.slice(0, 8)}`,
                createdBy: job.requesterId,
              },
              update: {},
            });
            await tx.contentTag.create({ data: { contentId, tagId: tag.id } });
          }
        }
        await tx.bookletImportJob.update({
          where: { id: jobId },
          data: {
            status: BookletImportStatus.SUCCEEDED,
            contentId,
            progress: 100,
            successCount: chapterRows.length,
            finishedAt: new Date(),
            warnings: parsed.warnings,
          },
        });
      });
      // 事务成功后再 move；失败不得把已提交的草稿打回 FAILED。
      try {
        await this.storage.moveObject(sourceObjectKey, sourceKey);
        await this.prisma.fileAsset.update({
          where: { id: job.sourceFileId },
          data: { objectKey: sourceKey },
        });
      } catch (archiveError) {
        this.logger.warn(
          `小册导入 ${jobId} 已成功，但源 ZIP 归档失败: ${
            archiveError instanceof Error ? archiveError.message : '未知错误'
          }`,
        );
      }
    } catch (error) {
      const message =
        error instanceof DomainHttpException
          ? error.message
          : error instanceof Error
            ? error.message
            : '导入失败';
      const code =
        error instanceof DomainHttpException
          ? String((error.getResponse() as { code?: string }).code ?? 'BOOKLET_IMPORT_FAILED')
          : 'BOOKLET_IMPORT_FAILED';
      this.logger.warn(
        `小册导入失败 ${jobId}: ${message}${error instanceof Error && error.stack ? `\n${error.stack}` : ''}`,
      );
      for (const key of writtenKeys) {
        try {
          await this.storage.deleteObject(key);
        } catch (cleanupError) {
          this.logger.warn(
            `导入失败补偿删除 ${key} 失败: ${
              cleanupError instanceof Error ? cleanupError.message : '未知错误'
            }`,
          );
        }
      }
      await this.prisma.bookletImportJob.update({
        where: { id: jobId },
        data: {
          status: BookletImportStatus.FAILED,
          errorCode: code,
          errorMessage: message.slice(0, 500),
          finishedAt: new Date(),
        },
      });
      throw error;
    } finally {
      stopHeartbeat();
      if (tmpDir) {
        await rm(tmpDir, { recursive: true, force: true });
      }
    }
  }

  /**
   * 活着的导入继续占着 VALIDATING/IMPORTING；心跳过期后才允许其它 worker 抢占。
   */
  private async claimImportJob(jobId: string) {
    const now = new Date();
    const claimData = {
      status: BookletImportStatus.VALIDATING,
      startedAt: now,
      heartbeatAt: now,
      progress: 5,
      errorCode: null,
      errorMessage: null,
      finishedAt: null,
    };
    const fresh = await this.prisma.bookletImportJob.updateMany({
      where: {
        id: jobId,
        contentId: null,
        status: { in: [BookletImportStatus.QUEUED, BookletImportStatus.FAILED] },
      },
      data: claimData,
    });
    if (fresh.count === 1) {
      return fresh;
    }
    const staleBefore = new Date(Date.now() - IMPORT_STALE_MS);
    return this.prisma.bookletImportJob.updateMany({
      where: {
        id: jobId,
        contentId: null,
        status: { in: [BookletImportStatus.VALIDATING, BookletImportStatus.IMPORTING] },
        OR: [
          { heartbeatAt: { lte: staleBefore } },
          { heartbeatAt: null, startedAt: { lte: staleBefore } },
          { heartbeatAt: null, startedAt: null },
        ],
      },
      data: claimData,
    });
  }

  private startImportHeartbeat(jobId: string): () => void {
    const tick = () => {
      void this.prisma.bookletImportJob.updateMany({
        where: {
          id: jobId,
          contentId: null,
          status: { in: [BookletImportStatus.VALIDATING, BookletImportStatus.IMPORTING] },
        },
        data: { heartbeatAt: new Date() },
      });
    };
    tick();
    const timer = setInterval(tick, IMPORT_HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
    };
  }

  private async assertImport(auth: { userId: string; permissionVersion: number }) {
    const snapshot = await this.auth.getPermissionSnapshot(auth.userId, auth.permissionVersion);
    if (!snapshot.permissions.some((item) => item.code === 'booklet:import')) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '没有执行该操作的权限');
    }
  }

  private toJob(
    job: {
      id: string;
      status: BookletImportStatus;
      progress: number;
      contentId: string | null;
      totalChapters: number;
      successCount: number;
      failureCount: number;
      warnings: Prisma.JsonValue | null;
      errorCode: string | null;
      errorMessage: string | null;
      sourceFileId: string;
      createdAt: Date;
    },
    originalName?: string | null,
  ) {
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      contentId: job.contentId,
      totalChapters: job.totalChapters,
      successCount: job.successCount,
      failureCount: job.failureCount,
      warnings: job.warnings ?? [],
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      sourceFileId: job.sourceFileId,
      createdAt: job.createdAt.toISOString(),
      originalName: originalName ?? null,
    };
  }
}
