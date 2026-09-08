import { createHash, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  FileAssetStatus,
  FilePurpose,
  Prisma,
  StorageProviderKind,
  UploadMode,
} from '@prisma/client';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type CompletedPart,
  type StorageProvider,
} from '../../infrastructure/storage/storage.types';
import { AuthService } from '../auth/auth.service';
import { DataScope } from '@prisma/client';
import { sanitizeFileName, sniffMimeType } from './file-magic';
import {
  isDeniedMime,
  resolveFilePolicy,
  shouldUseMultipart,
  type FilePurposePolicy,
} from './file-policy';
import type {
  AdminFileQueryDto,
  AppFileQueryDto,
  AppUploadTaskQueryDto,
  CreateUploadDto,
} from './dto/file.dto';

const UPLOAD_TTL_SECONDS = 15 * 60;
const DOWNLOAD_TTL_SECONDS = 10 * 60;
const FILE_MAGIC_PREFIX_BYTES = 64;
const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type UploadTaskQueryRow = {
  taskType: 'FILE' | 'BOOKLET_IMPORT';
  id: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  purpose: string | null;
  status: string;
  progress: number | null;
  contentId: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

/**
 * 流式消费对象，避免 SHA-256 校验把大文件完整载入 Node 堆内存。
 */
async function calculateObjectSha256(stream: AsyncIterable<Uint8Array>): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

function uploadTaskKindWhere(taskKind?: 'booklet' | 'pdf' | 'word' | 'zip') {
  if (!taskKind) {
    return Prisma.empty;
  }
  if (taskKind === 'booklet') {
    return Prisma.sql`WHERE "taskType" = 'BOOKLET_IMPORT'`;
  }
  if (taskKind === 'pdf') {
    return Prisma.sql`WHERE "taskType" = 'FILE' AND "mimeType" = 'application/pdf'`;
  }
  if (taskKind === 'word') {
    return Prisma.sql`WHERE "taskType" = 'FILE' AND "mimeType" = ${WORD_MIME}`;
  }
  return Prisma.sql`WHERE "taskType" = 'FILE' AND "mimeType" IN ('application/zip', 'application/x-zip-compressed')`;
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly auth: AuthService,
  ) {}

  async resolvePolicy(purpose: FilePurpose): Promise<FilePurposePolicy> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'file.policies' } });
    const overlay = readPurposeOverlay(row?.value, purpose);
    return resolveFilePolicy(purpose, overlay);
  }

  async createUpload(auth: { userId: string }, dto: CreateUploadDto, idempotencyKey: string) {
    if (isDeniedMime(dto.mimeType)) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_VALIDATION_FAILED',
        '不允许该文件类型',
      );
    }
    const policy = await this.resolvePolicy(dto.purpose);
    if (dto.size > policy.maxBytes) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_VALIDATION_FAILED',
        '文件超过允许大小',
      );
    }
    if (!policy.mimeTypes.includes(dto.mimeType.toLowerCase())) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_VALIDATION_FAILED',
        '该用途不支持此 MIME',
      );
    }

    const existing = await this.prisma.uploadSession.findUnique({
      where: { uploaderId_idempotencyKey: { uploaderId: auth.userId, idempotencyKey } },
      include: { file: true },
    });
    if (existing) {
      return this.toUploadResponse(
        existing.id,
        existing.file,
        existing.uploadMode,
        existing.objectKey,
        existing.uploadId,
      );
    }

    const fileId = randomUUID();
    const name = sanitizeFileName(dto.originalName);
    const objectKey = buildObjectKey(dto.purpose, fileId, name);
    const mode = shouldUseMultipart(dto.size) ? UploadMode.MULTIPART : UploadMode.SINGLE;
    const signed = await this.storage.createSignedUpload(
      objectKey,
      dto.size,
      dto.mimeType,
      UPLOAD_TTL_SECONDS,
    );
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000);

    const created = await this.prisma.$transaction(async (tx) => {
      const file = await tx.fileAsset.create({
        data: {
          id: fileId,
          uploaderId: auth.userId,
          originalName: name,
          objectKey,
          storageProvider: StorageProviderKind.MINIO,
          mimeType: dto.mimeType.toLowerCase(),
          size: dto.size,
          purpose: dto.purpose,
          status: FileAssetStatus.UPLOADING,
        },
      });
      const session = await tx.uploadSession.create({
        data: {
          uploaderId: auth.userId,
          fileId: file.id,
          uploadMode: mode,
          objectKey,
          uploadId: signed.multipartUploadId,
          expiresAt,
          idempotencyKey,
        },
      });
      return { file, session };
    });

    return {
      uploadId: created.session.id,
      fileId: created.file.id,
      mode: signed.mode,
      objectKey,
      uploadUrl: signed.uploadUrl ?? null,
      multipartUploadId: signed.multipartUploadId ?? null,
      parts: signed.parts ?? null,
      partSize: signed.partSize ?? null,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async completeUpload(auth: { userId: string }, uploadId: string, parts?: CompletedPart[]) {
    const session = await this.prisma.uploadSession.findFirst({
      where: { id: uploadId, uploaderId: auth.userId },
      include: { file: true },
    });
    if (!session) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', '上传会话不存在');
    }
    if (session.completedAt) {
      return this.toFilePublic(session.file);
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw new DomainHttpException(
        HttpStatus.GONE,
        'UPLOAD_EXPIRED',
        '上传已过期，请重新创建会话',
      );
    }

    if (session.uploadMode === UploadMode.MULTIPART) {
      if (!session.uploadId || !parts?.length) {
        throw new DomainHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'FILE_VALIDATION_FAILED',
          '分片上传需要 parts',
        );
      }
      try {
        await this.storage.completeMultipartUpload(session.objectKey, session.uploadId, parts);
      } catch (error) {
        // 并发 complete 时对象可能已合并；后面的 head/size 会拦住未完成的请求。
        this.logger.warn(
          `multipart complete 可重入失败 ${uploadId}: ${
            error instanceof Error ? error.message : '未知错误'
          }`,
        );
      }
    }

    let head;
    try {
      head = await this.storage.headObject(session.objectKey);
    } catch {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_VALIDATION_FAILED',
        '对象尚未上传完成',
      );
    }
    if (head.size !== session.file.size) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_VALIDATION_FAILED',
        '文件大小与申报不一致',
      );
    }

    const sniffBuffer = await this.storage.getObjectPrefix(
      session.objectKey,
      FILE_MAGIC_PREFIX_BYTES,
    );
    const sniffed = sniffMimeType(sniffBuffer, session.file.mimeType);
    if (!sniffed) {
      await this.prisma.fileAsset.update({
        where: { id: session.fileId },
        data: { status: FileAssetStatus.FAILED },
      });
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_VALIDATION_FAILED',
        '文件内容与声明类型不符',
      );
    }

    const sha256 = await calculateObjectSha256(
      await this.storage.getObjectStream(session.objectKey),
    );
    const ready = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.uploadSession.updateMany({
        where: { id: session.id, completedAt: null },
        data: { completedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return tx.fileAsset.findUniqueOrThrow({ where: { id: session.fileId } });
      }
      return tx.fileAsset.update({
        where: { id: session.fileId },
        data: { status: FileAssetStatus.READY, sha256, mimeType: sniffed },
      });
    });
    return this.toFilePublic(ready);
  }

  async downloadUrl(auth: { userId: string; permissionVersion: number }, fileId: string) {
    const file = await this.requireReadableFile(auth, fileId);
    const url = await this.storage.createSignedDownloadUrl(file.objectKey, DOWNLOAD_TTL_SECONDS);
    return { url, expiresIn: DOWNLOAD_TTL_SECONDS };
  }

  async signReadyObject(objectKey: string | null | undefined): Promise<string | null> {
    if (!objectKey) {
      return null;
    }
    try {
      return await this.storage.createSignedDownloadUrl(objectKey, DOWNLOAD_TTL_SECONDS);
    } catch {
      return null;
    }
  }

  async signFileId(fileId: string | null | undefined): Promise<string | null> {
    if (!fileId) {
      return null;
    }
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: fileId, status: FileAssetStatus.READY, deletedAt: null },
    });
    if (!file) {
      return null;
    }
    return this.signReadyObject(file.objectKey);
  }

  async requireReadyOwnedFile(userId: string, fileId: string, purpose: FilePurpose) {
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: fileId, deletedAt: null },
    });
    if (!file || file.status !== FileAssetStatus.READY) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_NOT_READY',
        '文件尚未就绪',
      );
    }
    if (file.uploaderId !== userId) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '不能引用他人文件');
    }
    if (file.purpose !== purpose) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_VALIDATION_FAILED',
        '文件用途不匹配',
      );
    }
    return file;
  }

  /**
   * 工作区上传任务用的文件列表。
   * 不按 MIME 裁剪：封面/头像/AI 资产除外，已挂导入任务的 ZIP 由 booklet-imports 展示。
   */
  async listMine(auth: { userId: string }, query: AppFileQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const uploadPurposes: Prisma.FileAssetWhereInput = {
      purpose: {
        in: [FilePurpose.CONTENT_FILE, FilePurpose.TEMPORARY_IMPORT, FilePurpose.BOOKLET_SOURCE],
      },
      importJobs: { none: {} },
    };
    const kindWhere: Prisma.FileAssetWhereInput =
      query.mimeKind === 'pdf'
        ? { purpose: FilePurpose.CONTENT_FILE, mimeType: 'application/pdf' }
        : query.mimeKind === 'word'
          ? {
              purpose: FilePurpose.CONTENT_FILE,
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            }
          : query.mimeKind === 'zip'
            ? {
                purpose: { in: [FilePurpose.TEMPORARY_IMPORT, FilePurpose.BOOKLET_SOURCE] },
                importJobs: { none: {} },
                mimeType: { in: ['application/zip', 'application/x-zip-compressed'] },
              }
            : uploadPurposes;
    const where: Prisma.FileAssetWhereInput = {
      uploaderId: auth.userId,
      deletedAt: null,
      hiddenFromTaskList: false,
      ...kindWhere,
    };
    const [list, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          primaryContents: {
            where: { deletedAt: null },
            select: { id: true },
            take: 1,
            orderBy: { updatedAt: 'desc' },
          },
        },
      }),
      this.prisma.fileAsset.count({ where }),
    ]);
    return {
      list: list.map((item) => ({
        id: item.id,
        originalName: item.originalName,
        mimeType: item.mimeType,
        size: item.size,
        purpose: item.purpose,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        contentId: item.primaryContents[0]?.id ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 工作区统一上传任务列表。查询层完成合并、排序、分页，不能先拉全量后在前端切片。
   */
  async listUploadTasks(auth: { userId: string }, query: AppUploadTaskQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const offset = (page - 1) * pageSize;
    const userId = auth.userId;
    // PostgreSQL 的 uuid 列不能与 Prisma 作为 text 绑定的 raw 参数直接比较。
    const userIdParameter = Prisma.sql`${userId}::uuid`;
    const filePurposes = Prisma.join([
      Prisma.sql`'CONTENT_FILE'`,
      Prisma.sql`'TEMPORARY_IMPORT'`,
      Prisma.sql`'BOOKLET_SOURCE'`,
    ]);
    const kindWhere = uploadTaskKindWhere(query.taskKind);
    const unionBody = Prisma.sql`
          SELECT
            'FILE'::text AS "taskType",
            file.id,
            file.original_name AS "originalName",
            file.mime_type AS "mimeType",
            file.size,
            file.purpose::text AS purpose,
            file.status::text AS status,
            NULL::integer AS progress,
            content.id AS "contentId",
            NULL::text AS "errorMessage",
            file.created_at AS "createdAt"
          FROM file_assets file
          LEFT JOIN LATERAL (
            SELECT id
            FROM contents
            WHERE primary_file_id = file.id AND deleted_at IS NULL
            ORDER BY updated_at DESC
            LIMIT 1
          ) content ON TRUE
          WHERE file.uploader_id = ${userIdParameter}
            AND file.deleted_at IS NULL
            AND file.hidden_from_task_list = false
            AND file.purpose IN (${filePurposes})
            AND NOT EXISTS (
              SELECT 1
              FROM booklet_import_jobs import_job
              WHERE import_job.source_file_id = file.id
            )

          UNION ALL

          SELECT
            'BOOKLET_IMPORT'::text AS "taskType",
            job.id,
            source.original_name AS "originalName",
            source.mime_type AS "mimeType",
            source.size,
            source.purpose::text AS purpose,
            job.status::text AS status,
            job.progress,
            job.content_id AS "contentId",
            job.error_message AS "errorMessage",
            job.created_at AS "createdAt"
          FROM booklet_import_jobs job
          INNER JOIN file_assets source ON source.id = job.source_file_id
          WHERE job.requester_id = ${userIdParameter}
            AND job.hidden_from_task_list = false
    `;
    const [list, totals, activeImportCount] = await this.prisma.$transaction([
      this.prisma.$queryRaw<UploadTaskQueryRow[]>(Prisma.sql`
        SELECT *
        FROM (${unionBody}) upload_tasks
        ${kindWhere}
        ORDER BY "createdAt" DESC, id DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `),
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM (${unionBody}) upload_tasks
        ${kindWhere}
      `),
      this.prisma.bookletImportJob.count({
        where: {
          requesterId: userId,
          hiddenFromTaskList: false,
          status: {
            in: ['QUEUED', 'VALIDATING', 'IMPORTING'],
          },
        },
      }),
    ]);
    return {
      list: list.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      total: Number(totals[0]?.total ?? 0),
      page,
      pageSize,
      hasActiveBookletImports: activeImportCount > 0,
    };
  }

  /**
   * 仅从上传任务列表隐藏，不删 file_assets、不碰关联内容。
   */
  async hideMineFromTaskList(auth: { userId: string }, fileId: string) {
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: fileId, uploaderId: auth.userId, deletedAt: null },
    });
    if (!file) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', '文件不存在');
    }
    await this.prisma.fileAsset.update({
      where: { id: fileId },
      data: { hiddenFromTaskList: true },
    });
    return null;
  }

  async listAdmin(auth: { userId: string; permissionVersion: number }, query: AdminFileQueryDto) {
    await this.assertFileReadAll(auth);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.FileAssetWhereInput = {
      deletedAt: null,
      ...(query.keyword ? { originalName: { contains: query.keyword, mode: 'insensitive' } } : {}),
      ...(query.mimeGroup === 'image' ? { mimeType: { startsWith: 'image/' } } : {}),
      ...(query.mimeGroup === 'pdf' ? { mimeType: 'application/pdf' } : {}),
      ...(query.mimeGroup === 'word'
        ? { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
        : {}),
    };
    const [list, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.fileAsset.count({ where }),
    ]);
    const ids = list.map((item) => item.id);
    const [contents, importJobs] =
      ids.length === 0
        ? [[], []]
        : await Promise.all([
            this.prisma.content.findMany({
              where: { OR: [{ coverFileId: { in: ids } }, { primaryFileId: { in: ids } }] },
              select: { id: true, coverFileId: true, primaryFileId: true },
            }),
            this.prisma.bookletImportJob.findMany({
              where: { sourceFileId: { in: ids } },
              select: { sourceFileId: true, contentId: true },
            }),
          ]);
    return {
      list: await Promise.all(
        list.map(async (item) => {
          const referencedBy = [
            ...contents
              .filter((row) => row.coverFileId === item.id || row.primaryFileId === item.id)
              .map((row) => row.id),
            ...importJobs
              .filter((row) => row.sourceFileId === item.id && row.contentId)
              .map((row) => row.contentId as string),
          ];
          return {
            id: item.id,
            name: item.originalName,
            mimeType: item.mimeType,
            size: item.size,
            url: (await this.signReadyObject(item.objectKey)) ?? '',
            createdAt: item.createdAt.toISOString(),
            usage: mapUsage(item.purpose),
            storage: 'minio' as const,
            referencedBy,
            purpose: item.purpose,
            status: item.status,
          };
        }),
      ),
      total,
      page,
      pageSize,
    };
  }

  async softDelete(auth: { userId: string; permissionVersion: number }, fileId: string) {
    await this.assertFileDeleteAll(auth);
    const file = await this.prisma.fileAsset.findFirst({ where: { id: fileId, deletedAt: null } });
    if (!file) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', '文件不存在');
    }
    const [contentRefs, importRefs] = await Promise.all([
      this.prisma.content.count({
        where: { OR: [{ coverFileId: fileId }, { primaryFileId: fileId }], deletedAt: null },
      }),
      this.prisma.bookletImportJob.count({ where: { sourceFileId: fileId } }),
    ]);
    if (contentRefs > 0 || importRefs > 0) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'FILE_IN_USE', '文件仍被内容引用');
    }
    await this.prisma.fileAsset.update({
      where: { id: fileId },
      data: { deletedAt: new Date(), status: FileAssetStatus.DELETED },
    });
    return null;
  }

  async batchDelete(auth: { userId: string; permissionVersion: number }, ids: string[]) {
    const deleted: string[] = [];
    const failed: Array<{ id: string; message: string }> = [];
    for (const id of ids) {
      try {
        await this.softDelete(auth, id);
        deleted.push(id);
      } catch (error) {
        failed.push({
          id,
          message: error instanceof DomainHttpException ? error.message : '删除失败',
        });
      }
    }
    return { deleted, failed };
  }

  getStorage(): StorageProvider {
    return this.storage;
  }

  private async requireReadableFile(
    auth: { userId: string; permissionVersion: number },
    fileId: string,
  ) {
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: fileId, deletedAt: null },
    });
    if (!file || file.status !== FileAssetStatus.READY) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', '文件不存在');
    }
    const snapshot = await this.auth.getPermissionSnapshot(auth.userId, auth.permissionVersion);
    const read = snapshot.permissions.find((item) => item.code === 'file:read');
    const canAll = read?.dataScope === DataScope.ALL;
    if (file.uploaderId !== auth.userId && !canAll) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'FILE_NOT_FOUND', '文件不存在');
    }
    return file;
  }

  private async assertFileReadAll(auth: { userId: string; permissionVersion: number }) {
    const snapshot = await this.auth.getPermissionSnapshot(auth.userId, auth.permissionVersion);
    const read = snapshot.permissions.find((item) => item.code === 'file:read');
    if (!read || read.dataScope !== DataScope.ALL) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '没有执行该操作的权限');
    }
  }

  private async assertFileDeleteAll(auth: { userId: string; permissionVersion: number }) {
    const snapshot = await this.auth.getPermissionSnapshot(auth.userId, auth.permissionVersion);
    const grant = snapshot.permissions.find((item) => item.code === 'file:delete');
    if (!grant || grant.dataScope !== DataScope.ALL) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '没有执行该操作的权限');
    }
  }

  private async toUploadResponse(
    uploadId: string,
    file: { id: string; objectKey: string; size: number; mimeType: string },
    mode: UploadMode,
    objectKey: string,
    multipartUploadId: string | null,
  ) {
    const signed = await this.storage.createSignedUpload(
      objectKey,
      file.size,
      file.mimeType,
      UPLOAD_TTL_SECONDS,
    );
    return {
      uploadId,
      fileId: file.id,
      mode: mode === UploadMode.MULTIPART ? 'MULTIPART' : 'SINGLE',
      objectKey,
      uploadUrl: signed.uploadUrl ?? null,
      multipartUploadId: multipartUploadId ?? signed.multipartUploadId ?? null,
      parts: signed.parts ?? null,
      partSize: signed.partSize ?? null,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
    };
  }

  private toFilePublic(file: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    purpose: FilePurpose;
    status: FileAssetStatus;
  }) {
    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      purpose: file.purpose,
      status: file.status,
    };
  }
}

function buildObjectKey(purpose: FilePurpose, fileId: string, name: string): string {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  if (purpose === FilePurpose.TEMPORARY_IMPORT) {
    return `temporary/${fileId}/${name}`;
  }
  return `uploads/${yyyy}/${mm}/${fileId}/${name}`;
}

function mapUsage(purpose: FilePurpose): 'cover' | 'attachment' | 'preview' | 'asset' {
  if (purpose === FilePurpose.COVER || purpose === FilePurpose.AVATAR) {
    return 'cover';
  }
  if (purpose === FilePurpose.AI_ASSET) {
    return 'asset';
  }
  if (purpose === FilePurpose.CONTENT_FILE) {
    return 'preview';
  }
  return 'attachment';
}

function readPurposeOverlay(
  value: unknown,
  purpose: FilePurpose,
): Partial<FilePurposePolicy> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const row = (value as Record<string, unknown>)[purpose];
  if (!row || typeof row !== 'object') {
    return undefined;
  }
  const mimeTypes = Array.isArray((row as { mimeTypes?: unknown }).mimeTypes)
    ? ((row as { mimeTypes: unknown[] }).mimeTypes.filter(
        (item) => typeof item === 'string',
      ) as string[])
    : undefined;
  const maxBytes =
    typeof (row as { maxBytes?: unknown }).maxBytes === 'number'
      ? (row as { maxBytes: number }).maxBytes
      : undefined;
  return { mimeTypes, maxBytes };
}
