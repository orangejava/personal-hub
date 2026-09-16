import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ContentReviewStatus,
  ContentSourceType,
  ContentStatus,
  ContentType,
  ContentVisibility,
  DataScope,
  FilePurpose,
  ImportRestriction,
  Prisma,
  RoleCode,
} from '@prisma/client';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { AuthService } from '../auth/auth.service';
import { deriveMarkdown } from './content-markdown';
import { deriveRichText } from './content-rich-text';
import {
  isPublicListLocked,
  publicDetailAccess,
  publicFeaturedWhere,
  publicListWhere,
  workspaceListWhere,
  type ContentViewer,
} from './content-visibility';
import {
  ContentRepository,
  contentDetailInclude,
  type ContentDetailRow,
} from './content.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FileService } from '../file/file.service';
import { PublicContentSort } from './dto/list-public-content.query.dto';
import type {
  CreateContentDto,
  ListContentReviewsQueryDto,
  PatchContentDto,
  PublishContentDto,
  RichTextDocumentDto,
} from './dto/mutate-content.dto';

const SOFT_DELETE_MS = 30 * 24 * 60 * 60 * 1000;
const PUBLISHABLE_TYPES: ContentType[] = [
  ContentType.MARKDOWN,
  ContentType.RICH_TEXT,
  ContentType.LINK,
  ContentType.PROJECT,
  ContentType.PDF,
  ContentType.WORD,
  ContentType.BOOKLET,
];

const contentReviewInclude = {
  requester: { select: { id: true, nickname: true, email: true } },
  reviewer: { select: { id: true, nickname: true, email: true } },
  content: {
    select: {
      id: true,
      type: true,
      title: true,
      status: true,
      visibility: true,
      importRestriction: true,
      author: { select: { id: true, nickname: true, email: true } },
    },
  },
} satisfies Prisma.ContentReviewInclude;

type ContentReviewRow = Prisma.ContentReviewGetPayload<{ include: typeof contentReviewInclude }>;

interface ContentActionScope {
  userId: string;
  all: boolean;
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contents: ContentRepository,
    private readonly auth: AuthService,
    private readonly files: FileService,
  ) {}

  async resolveViewerFromAuth(auth?: {
    userId: string;
    permissionVersion: number;
  }): Promise<ContentViewer> {
    if (auth === undefined) {
      return { contentReadAll: false };
    }
    const snapshot = await this.auth.getPermissionSnapshot(auth.userId, auth.permissionVersion);
    const read = snapshot.permissions.find((item) => item.code === 'content:read');
    return {
      userId: auth.userId,
      contentReadAll: read?.dataScope === DataScope.ALL,
    };
  }

  async hasPermission(
    auth: { userId: string; permissionVersion: number },
    code: string,
  ): Promise<{ ok: boolean; all: boolean }> {
    const snapshot = await this.auth.getPermissionSnapshot(auth.userId, auth.permissionVersion);
    const grant = snapshot.permissions.find((item) => item.code === code);
    if (grant === undefined) {
      return { ok: false, all: false };
    }
    return { ok: true, all: grant.dataScope === DataScope.ALL };
  }

  async listPublic(
    query: {
      categorySlug?: string;
      tagSlugs?: string;
      types?: string;
      keyword?: string;
      sort?: PublicContentSort;
      page?: number;
      pageSize?: number;
    },
    viewer: ContentViewer,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where = await this.buildPublicWhere(query);
    const orderBy: Prisma.ContentOrderByWithRelationInput =
      query.sort === PublicContentSort.POPULAR ? { viewCount: 'desc' } : { publishedAt: 'desc' };
    const [list, total] = await Promise.all([
      this.contents.list(where, (page - 1) * pageSize, pageSize, orderBy),
      this.contents.count(where),
    ]);
    return {
      list: await Promise.all(list.map((row) => this.toListItem(row, viewer, true))),
      total,
      page,
      pageSize,
    };
  }

  async featured(viewer: ContentViewer) {
    const base = publicFeaturedWhere(viewer);
    let list = await this.prisma.content.findMany({
      where: { ...base, isFeatured: true },
      orderBy: { publishedAt: 'desc' },
      take: 6,
      include: contentDetailInclude,
    });
    if (list.length === 0) {
      list = await this.prisma.content.findMany({
        where: base,
        orderBy: { publishedAt: 'desc' },
        take: 6,
        include: contentDetailInclude,
      });
    }
    return Promise.all(list.map((row) => this.toListItem(row, viewer, true)));
  }

  async publicMeta(viewer: ContentViewer) {
    const where = publicListWhere();
    const [categories, tags] = await Promise.all([
      this.prisma.category.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { contents: { where } } } },
      }),
      this.prisma.tag.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { contents: { where: { content: where } } } } },
      }),
    ]);
    void viewer;
    return {
      categories: categories.map((item) => ({
        slug: item.slug,
        name: item.name,
        count: item._count.contents,
      })),
      tags: tags
        .filter((item) => item._count.contents > 0)
        .map((item) => ({ slug: item.slug, name: item.name, count: item._count.contents })),
    };
  }

  async publicDetail(id: string, viewer: ContentViewer, subjectHash: string) {
    const row = await this.contents.findById(id);
    if (row === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    const access = publicDetailAccess(row, viewer);
    if (access === 'not_found') {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    if (access === 'login') {
      throw new DomainHttpException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', '请登录后查看');
    }
    void this.recordView(id, subjectHash);
    const favorited =
      viewer.userId === undefined
        ? false
        : (await this.prisma.favorite.findUnique({
            where: { userId_contentId: { userId: viewer.userId, contentId: id } },
          })) !== null;
    return this.toDetail(row, viewer, { publicView: true, favorited });
  }

  async listChapters(contentId: string, viewer: ContentViewer) {
    await this.publicDetail(contentId, viewer, 'skip-view');
    const chapters = await this.prisma.contentChapter.findMany({
      where: { contentId },
      orderBy: { chapterOrder: 'asc' },
      select: { id: true, title: true, chapterOrder: true, wordCount: true },
    });
    return { list: chapters };
  }

  async getChapter(contentId: string, chapterId: string, viewer: ContentViewer) {
    await this.publicDetail(contentId, viewer, 'skip-view');
    const chapter = await this.prisma.contentChapter.findFirst({
      where: { id: chapterId, contentId },
    });
    if (!chapter) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '章节不存在');
    }
    let markdown = '';
    if (chapter.objectKey) {
      try {
        markdown = (await this.files.getStorage().getObject(chapter.objectKey)).toString('utf8');
      } catch {
        markdown = '';
      }
    }
    const derived = markdown ? deriveMarkdown(markdown) : { html: '', toc: [], wordCount: 0 };
    return {
      id: chapter.id,
      title: chapter.title,
      chapterOrder: chapter.chapterOrder,
      markdownSource: markdown,
      renderedHtml: derived.html,
      toc: derived.toc,
      wordCount: chapter.wordCount ?? derived.wordCount,
    };
  }

  async importLicense(
    auth: { userId: string; permissionVersion: number },
    id: string,
    note: string,
    requestId: string | null,
  ) {
    const grant = await this.assertPermission(auth, 'content:publish');
    if (!grant.all) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '解除导入限制需要全站发布权限');
    }
    const trimmed = note.trim();
    if (!trimmed) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CONTENT_COPYRIGHT_NOTE_REQUIRED',
        '解除导入限制需要填写版权说明',
      );
    }
    const row = await this.contents.findById(id);
    if (!row || row.deletedAt) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    if (row.importRestriction !== ImportRestriction.PRIVATE_UNTIL_LICENSED) {
      return this.toDetail(row, { userId: auth.userId, contentReadAll: true }, { publicView: false, favorited: false });
    }
    await this.contents.asTransaction(async (tx) => {
      const licensed = await this.applyImportLicenseInTx(tx, row, auth.userId, trimmed, requestId);
      if (!licensed) {
        return;
      }
    });
    const next = await this.contents.findById(id);
    if (next === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    return this.toDetail(next, { userId: auth.userId, contentReadAll: true }, { publicView: false, favorited: false });
  }

  async listApp(
    auth: { userId: string; permissionVersion: number },
    query: {
      lifecycle?: ContentStatus;
      includeDeleted?: boolean;
      visibility?: ContentVisibility;
      keyword?: string;
      types?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    await this.assertPermission(auth, 'content:read');
    const viewer = await this.resolveViewerFromAuth(auth);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.ContentWhereInput = {
      ...workspaceListWhere(viewer, query),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...this.typesWhere(query.types),
      ...this.keywordWhere(query.keyword),
    };
    const [list, total] = await Promise.all([
      this.contents.list(where, (page - 1) * pageSize, pageSize, { updatedAt: 'desc' }),
      this.contents.count(where),
    ]);
    return {
      list: await Promise.all(list.map((row) => this.toListItem(row, viewer, false))),
      total,
      page,
      pageSize,
    };
  }

  async getApp(auth: { userId: string; permissionVersion: number }, id: string) {
    await this.assertPermission(auth, 'content:read');
    const viewer = await this.resolveViewerFromAuth(auth);
    const row = await this.requireOwned(id, {
      userId: auth.userId,
      all: viewer.contentReadAll,
    });
    return this.toDetail(row, viewer, { publicView: false, favorited: false });
  }

  async create(auth: { userId: string; permissionVersion: number }, dto: CreateContentDto) {
    await this.assertPermission(auth, 'content:create');
    if (dto.type === ContentType.BOOKLET) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CONTENT_PUBLISH_VALIDATION_FAILED',
        '小册请通过 ZIP 导入创建',
      );
    }
    const category = dto.categorySlug ? await this.requireEnabledCategory(dto.categorySlug) : null;
    const derived = this.deriveContentBody(dto.type, dto.markdownSource, dto.editorDocument);
    const coverFileId = dto.coverFileId
      ? (await this.files.requireReadyOwnedFile(auth.userId, dto.coverFileId, FilePurpose.COVER)).id
      : undefined;
    const primaryFileId = dto.primaryFileId
      ? (await this.files.requireReadyOwnedFile(auth.userId, dto.primaryFileId, FilePurpose.CONTENT_FILE)).id
      : undefined;
    if (
      (dto.type === ContentType.PDF || dto.type === ContentType.WORD) &&
      !primaryFileId
    ) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'FILE_NOT_READY',
        'PDF / Word 需要先上传主文件',
      );
    }
    const created = await this.contents.asTransaction(async (tx) => {
      const content = await tx.content.create({
        data: {
          type: dto.type,
          title: dto.title,
          summary: dto.summary,
          authorId: auth.userId,
          categoryId: category?.id,
          visibility: dto.visibility ?? ContentVisibility.PRIVATE,
          externalUrl: dto.externalUrl,
          extra: dto.extra as Prisma.InputJsonValue | undefined,
          wordCount: derived?.wordCount ?? 0,
          coverFileId,
          primaryFileId,
          sourceType: primaryFileId ? ContentSourceType.UPLOAD : ContentSourceType.MANUAL,
          body: {
            create: {
              markdownSource: dto.markdownSource,
              editorDocument: dto.editorDocument as Prisma.InputJsonValue | undefined,
              renderedHtml: derived?.html,
              toc: derived?.toc as Prisma.InputJsonValue | undefined,
            },
          },
        },
      });
      if (dto.tagNames && dto.tagNames.length > 0) {
        await this.replaceTags(tx, content.id, dto.tagNames, auth.userId);
      }
      await this.contents.refreshSearchDocument(
        content.id,
        dto.title ?? null,
        dto.summary ?? null,
        derived?.searchText ?? null,
        tx,
      );
      return content.id;
    });
    const row = await this.contents.findById(created);
    if (row === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    return this.toDetail(
      row,
      { userId: auth.userId, contentReadAll: false },
      { publicView: false, favorited: false },
    );
  }

  async patch(
    auth: { userId: string; permissionVersion: number },
    id: string,
    dto: PatchContentDto,
  ) {
    const grant = await this.assertPermission(auth, 'content:update');
    const viewer = await this.resolveViewerFromAuth(auth);
    const current = await this.requireOwned(
      id,
      { userId: auth.userId, all: grant.all },
      { allowDeleted: false },
    );
    if ('isFeatured' in dto) {
      delete (dto as { isFeatured?: unknown }).isFeatured;
    }
    if (
      current.importRestriction === ImportRestriction.PRIVATE_UNTIL_LICENSED &&
      dto.visibility !== undefined &&
      dto.visibility !== ContentVisibility.PRIVATE
    ) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'CONTENT_IMPORT_RESTRICTION_ACTIVE',
        '导入限制解除前不能公开',
      );
    }
    const coverFileId =
      dto.coverFileId === undefined
        ? undefined
        : dto.coverFileId === null
          ? null
          : (await this.files.requireReadyOwnedFile(auth.userId, dto.coverFileId, FilePurpose.COVER)).id;
    const primaryFileId =
      dto.primaryFileId === undefined
        ? undefined
        : dto.primaryFileId === null
          ? null
          : (
              await this.files.requireReadyOwnedFile(
                auth.userId,
                dto.primaryFileId,
                FilePurpose.CONTENT_FILE,
              )
            ).id;
    const category =
      dto.categorySlug === undefined
        ? undefined
        : dto.categorySlug === null
          ? null
          : await this.requireEnabledCategory(dto.categorySlug);
    const nextMarkdown =
      dto.markdownSource === undefined ? current.body?.markdownSource : dto.markdownSource;
    const nextEditorDocument =
      dto.editorDocument === undefined ? current.body?.editorDocument : dto.editorDocument;
    const derived = this.deriveContentBody(current.type, nextMarkdown, nextEditorDocument);
    const updatesDerivedBody =
      (current.type === ContentType.MARKDOWN && dto.markdownSource !== undefined) ||
      (current.type === ContentType.RICH_TEXT && dto.editorDocument !== undefined);
    await this.contents.asTransaction(async (tx) => {
      await tx.content.update({
        where: { id },
        data: {
          title: dto.title === undefined ? undefined : dto.title,
          summary: dto.summary === undefined ? undefined : dto.summary,
          categoryId: category === undefined ? undefined : (category?.id ?? null),
          visibility: dto.visibility,
          externalUrl: dto.externalUrl === undefined ? undefined : dto.externalUrl,
          extra: dto.extra === undefined ? undefined : (dto.extra as Prisma.InputJsonValue),
          coverFileId,
          primaryFileId,
          sourceType: primaryFileId ? ContentSourceType.UPLOAD : undefined,
          wordCount: updatesDerivedBody ? (derived?.wordCount ?? 0) : undefined,
          version: { increment: 1 },
          body: {
            upsert: {
              create: {
                markdownSource: nextMarkdown,
                editorDocument:
                  dto.editorDocument === undefined
                    ? undefined
                    : (dto.editorDocument as unknown as Prisma.InputJsonValue),
                renderedHtml: updatesDerivedBody ? (derived?.html ?? null) : undefined,
                toc: updatesDerivedBody
                  ? ((derived?.toc as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull)
                  : undefined,
              },
              update: {
                markdownSource: dto.markdownSource === undefined ? undefined : dto.markdownSource,
                editorDocument:
                  dto.editorDocument === undefined
                    ? undefined
                    : dto.editorDocument === null
                      ? Prisma.JsonNull
                      : (dto.editorDocument as unknown as Prisma.InputJsonValue),
                renderedHtml: updatesDerivedBody ? (derived?.html ?? null) : undefined,
                toc: updatesDerivedBody
                  ? ((derived?.toc as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull)
                  : undefined,
              },
            },
          },
        },
      });
      if (dto.tagNames) {
        await this.replaceTags(tx, id, dto.tagNames, auth.userId);
      }
      await this.contents.refreshSearchDocument(
        id,
        dto.title === undefined ? current.title : dto.title,
        dto.summary === undefined ? current.summary : dto.summary,
        derived?.searchText ?? null,
        tx,
      );
    });
    const row = await this.contents.findById(id);
    if (row === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    return this.toDetail(row, viewer, { publicView: false, favorited: false });
  }

  /**
   * 发布内容。OWN 只写入待审核且保持草稿；ALL 仍即时发布。
   * 导入内容若目标可见性为公开/登录，必须带版权说明并走同一套清闸逻辑。
   */
  async publish(
    auth: { userId: string; permissionVersion: number },
    id: string,
    requestId: string | null,
    dto: PublishContentDto = {},
    options: { requireAll?: boolean } = {},
  ) {
    const grant = await this.assertPermission(auth, 'content:publish');
    if (options.requireAll && !grant.all) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '代发布需要全站发布权限');
    }
    const viewer: ContentViewer = { userId: auth.userId, contentReadAll: grant.all };
    const row = await this.requireOwned(
      id,
      { userId: auth.userId, all: grant.all },
      { allowDeleted: false },
    );
    this.assertPublishable(row, { skipImportRestriction: true });
    this.assertFileOrBookletReady(row);
    const targetVisibility = dto.requestedVisibility ?? row.visibility;
    if (!grant.all) {
      return this.submitReview(auth, row, targetVisibility, viewer);
    }
    this.assertCopyrightNoteIfNeeded(row, targetVisibility, dto.copyrightNote);
    await this.contents.asTransaction(async (tx) => {
      if (this.needsImportLicense(row, targetVisibility)) {
        await this.applyImportLicenseInTx(
          tx,
          row,
          auth.userId,
          dto.copyrightNote?.trim() ?? '',
          requestId,
        );
      }
      await this.cancelPendingReviewsInTx(tx, id, auth.userId);
      await this.executePublishInTx(tx, row, auth.userId, requestId, dto.requestedVisibility);
    });
    const next = await this.contents.findById(id);
    if (next === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    return this.toDetail(next, viewer, { publicView: false, favorited: false });
  }

  /**
   * 后台审核队列。权限码仍是 content:publish，但必须是 ALL。
   */
  async listReviews(
    auth: { userId: string; permissionVersion: number },
    query: ListContentReviewsQueryDto,
  ) {
    await this.assertPublishAll(auth);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.ContentReviewWhereInput = query.status ? { status: query.status } : {};
    const [list, total] = await Promise.all([
      this.prisma.contentReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: contentReviewInclude,
      }),
      this.prisma.contentReview.count({ where }),
    ]);
    return {
      list: list.map((item) => this.toReviewItem(item)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 通过审核：必要时清导入版权闸，再按申请可见性发布。内容在通过前始终保持草稿。
   */
  async approveReview(
    auth: { userId: string; permissionVersion: number },
    reviewId: string,
    copyrightNote: string | undefined,
    requestId: string | null,
  ) {
    await this.assertPublishAll(auth);
    await this.contents.asTransaction(async (tx) => {
      await this.claimPendingReview(tx, reviewId, {
        status: ContentReviewStatus.APPROVED,
        reviewerId: auth.userId,
        copyrightNote: copyrightNote?.trim() || null,
      });
      const review = await tx.contentReview.findUnique({
        where: { id: reviewId },
        include: contentReviewInclude,
      });
      if (review === null) {
        throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_REVIEW_NOT_FOUND', '审核记录不存在');
      }
      const row = await this.contents.findById(review.contentId, tx);
      if (row === null || row.deletedAt) {
        throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
      }
      this.assertPublishable(row, { skipImportRestriction: true });
      await this.assertFileOrBookletReady(row, tx);
      this.assertCopyrightNoteIfNeeded(row, review.requestedVisibility, copyrightNote);
      if (this.needsImportLicense(row, review.requestedVisibility)) {
        await this.applyImportLicenseInTx(
          tx,
          row,
          auth.userId,
          copyrightNote?.trim() ?? '',
          requestId,
        );
      }
      await this.executePublishInTx(tx, row, auth.userId, requestId, review.requestedVisibility);
      await this.contents.createAudit(
        {
          action: 'content.review.approve',
          actorId: auth.userId,
          targetId: review.contentId,
          requestId,
          detail: { reviewId, requestedVisibility: review.requestedVisibility },
        },
        tx,
      );
    });
    const next = await this.prisma.contentReview.findUnique({
      where: { id: reviewId },
      include: contentReviewInclude,
    });
    if (next === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_REVIEW_NOT_FOUND', '审核记录不存在');
    }
    return this.toReviewItem(next);
  }

  /**
   * 驳回审核：内容保持草稿，记录原因供作者修改后再次提交。
   */
  async rejectReview(
    auth: { userId: string; permissionVersion: number },
    reviewId: string,
    reason: string,
    requestId: string | null,
  ) {
    await this.assertPublishAll(auth);
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CONTENT_REVIEW_REASON_REQUIRED',
        '驳回需要填写原因',
      );
    }
    await this.contents.asTransaction(async (tx) => {
      await this.claimPendingReview(tx, reviewId, {
        status: ContentReviewStatus.REJECTED,
        reviewerId: auth.userId,
        rejectReason: trimmed,
      });
      const review = await tx.contentReview.findUnique({
        where: { id: reviewId },
        include: contentReviewInclude,
      });
      if (review === null) {
        throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_REVIEW_NOT_FOUND', '审核记录不存在');
      }
      await this.contents.createAudit(
        {
          action: 'content.review.reject',
          actorId: auth.userId,
          targetId: review.contentId,
          requestId,
          detail: { reviewId, reason: trimmed },
        },
        tx,
      );
    });
    const next = await this.prisma.contentReview.findUnique({
      where: { id: reviewId },
      include: contentReviewInclude,
    });
    if (next === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_REVIEW_NOT_FOUND', '审核记录不存在');
    }
    return this.toReviewItem(next);
  }

  async archive(
    auth: { userId: string; permissionVersion: number },
    id: string,
    requestId: string | null,
  ) {
    const grant = await this.assertPermission(auth, 'content:publish');
    const viewer: ContentViewer = { userId: auth.userId, contentReadAll: grant.all };
    const row = await this.requireOwned(
      id,
      { userId: auth.userId, all: grant.all },
      { allowDeleted: false },
    );
    if (row.status !== ContentStatus.PUBLISHED) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'CONTENT_INVALID_STATE',
        '只有已发布内容可以归档',
      );
    }
    await this.contents.asTransaction(async (tx) => {
      await tx.content.update({
        where: { id },
        data: { status: ContentStatus.ARCHIVED, version: { increment: 1 } },
      });
      await this.contents.createAudit(
        { action: 'content.archive', actorId: auth.userId, targetId: id, requestId },
        tx,
      );
    });
    const next = await this.contents.findById(id);
    if (next === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    return this.toDetail(next, viewer, { publicView: false, favorited: false });
  }

  async softDelete(
    auth: { userId: string; permissionVersion: number },
    id: string,
    requestId: string | null,
  ) {
    const grant = await this.assertPermission(auth, 'content:delete');
    await this.requireOwned(id, { userId: auth.userId, all: grant.all }, { allowDeleted: false });
    await this.contents.asTransaction(async (tx) => {
      await tx.content.update({
        where: { id },
        data: { deletedAt: new Date(), deletedBy: auth.userId, isFeatured: false },
      });
      await this.contents.createAudit(
        { action: 'content.delete', actorId: auth.userId, targetId: id, requestId },
        tx,
      );
    });
    return { id };
  }

  async restore(
    auth: { userId: string; permissionVersion: number },
    id: string,
    requestId: string | null,
  ) {
    const grant = await this.assertPermission(auth, 'content:restore');
    const viewer: ContentViewer = { userId: auth.userId, contentReadAll: grant.all };
    const row = await this.requireOwned(
      id,
      { userId: auth.userId, all: grant.all },
      { allowDeleted: true },
    );
    if (row.deletedAt === null) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'CONTENT_INVALID_STATE', '内容不在回收站');
    }
    if (Date.now() - row.deletedAt.getTime() > SOFT_DELETE_MS) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'CONTENT_INVALID_STATE',
        '已超过 30 天恢复期限',
      );
    }
    await this.contents.asTransaction(async (tx) => {
      await tx.content.update({
        where: { id },
        data: {
          deletedAt: null,
          deletedBy: null,
          status: grant.all ? row.status : ContentStatus.DRAFT,
        },
      });
      await this.contents.createAudit(
        { action: 'content.restore', actorId: auth.userId, targetId: id, requestId },
        tx,
      );
    });
    const next = await this.contents.findById(id);
    if (next === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    return this.toDetail(next, viewer, { publicView: false, favorited: false });
  }

  async setFeatured(
    auth: { userId: string; permissionVersion: number },
    id: string,
    featured: boolean,
    requestId: string | null,
  ) {
    const grant = await this.hasPermission(auth, 'content:featured');
    if (!grant.ok || !grant.all) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '没有执行该操作的权限');
    }
    const row = await this.contents.findById(id);
    if (row === null || row.deletedAt !== null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    await this.contents.asTransaction(async (tx) => {
      await tx.content.update({ where: { id }, data: { isFeatured: featured } });
      await this.contents.createAudit(
        {
          action: 'content.featured',
          actorId: auth.userId,
          targetId: id,
          requestId,
          detail: { featured },
        },
        tx,
      );
    });
    const next = await this.contents.findById(id);
    if (next === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    return this.toDetail(
      next,
      { userId: auth.userId, contentReadAll: true },
      { publicView: false, favorited: false },
    );
  }

  async purge(
    auth: { userId: string; permissionVersion: number },
    id: string,
    reason: string,
    requestId: string | null,
  ) {
    const grant = await this.hasPermission(auth, 'content:purge');
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { role: { select: { code: true } } },
    });
    if (!grant.ok || !grant.all || user?.role.code !== RoleCode.SUPER_ADMIN) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '没有执行该操作的权限');
    }
    const row = await this.contents.findById(id);
    if (row === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    await this.contents.asTransaction(async (tx) => {
      await tx.contentTag.deleteMany({ where: { contentId: id } });
      await tx.favorite.deleteMany({ where: { contentId: id } });
      await tx.readingRecord.deleteMany({ where: { contentId: id } });
      await tx.contentViewDay.deleteMany({ where: { contentId: id } });
      await tx.contentChapter.deleteMany({ where: { contentId: id } });
      await tx.contentVersion.deleteMany({ where: { contentId: id } });
      await tx.contentBody.deleteMany({ where: { contentId: id } });
      await tx.content.delete({ where: { id } });
      await this.contents.createAudit(
        {
          action: 'content.purge',
          actorId: auth.userId,
          targetId: id,
          requestId,
          detail: { reason },
        },
        tx,
      );
    });
    return { id };
  }

  async listFavorites(auth: { userId: string }, page = 1, pageSize = 10) {
    const where = { userId: auth.userId, content: publicListWhere() };
    const [rows, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { content: { include: contentDetailInclude } },
      }),
      this.prisma.favorite.count({ where }),
    ]);
    const viewer: ContentViewer = { userId: auth.userId, contentReadAll: false };
    return {
      list: await Promise.all(rows.map((item) => this.toListItem(item.content, viewer, true))),
      total,
      page,
      pageSize,
    };
  }

  async putFavorite(auth: { userId: string }, contentId: string) {
    const viewer: ContentViewer = { userId: auth.userId, contentReadAll: false };
    const row = await this.contents.findById(contentId);
    if (row === null || publicDetailAccess(row, viewer) !== 'ok') {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    await this.prisma.favorite.upsert({
      where: { userId_contentId: { userId: auth.userId, contentId } },
      create: { userId: auth.userId, contentId },
      update: {},
    });
    return { contentId, favorited: true };
  }

  async deleteFavorite(auth: { userId: string }, contentId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId: auth.userId, contentId } });
    return { contentId, favorited: false };
  }

  async recentReading(auth: { userId: string }) {
    const rows = await this.prisma.readingRecord.findMany({
      where: { userId: auth.userId, content: { deletedAt: null } },
      orderBy: { lastReadAt: 'desc' },
      take: 5,
      include: { content: { select: { id: true, title: true, type: true } } },
    });
    return rows.map((item) => ({
      contentId: item.contentId,
      title: item.content.title ?? '未命名',
      type: item.content.type,
      percent: item.contentProgressPercent,
      updatedAt: item.lastReadAt.toISOString(),
    }));
  }

  async upsertReading(
    auth: { userId: string },
    contentId: string,
    input: {
      contentProgressPercent: number;
      chapterId?: string | null;
      chapterProgressPercent?: number | null;
    },
  ) {
    const viewer: ContentViewer = { userId: auth.userId, contentReadAll: false };
    const row = await this.contents.findById(contentId);
    if (row === null || publicDetailAccess(row, viewer) !== 'ok') {
      return {};
    }
    if (input.chapterId !== undefined && input.chapterId !== null) {
      const chapter = await this.prisma.contentChapter.findFirst({
        where: { id: input.chapterId, contentId },
        select: { id: true },
      });
      if (chapter === null) {
        throw new DomainHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'CONTENT_READING_VALIDATION_FAILED',
          '章节不属于当前内容',
        );
      }
    }
    const percent = clampPercent(input.contentProgressPercent);
    await this.prisma.readingRecord.upsert({
      where: { userId_contentId: { userId: auth.userId, contentId } },
      create: {
        userId: auth.userId,
        contentId,
        chapterId: input.chapterId ?? null,
        contentProgressPercent: percent,
        chapterProgressPercent: input.chapterProgressPercent ?? null,
      },
      update: {
        chapterId: input.chapterId ?? null,
        contentProgressPercent: percent,
        chapterProgressPercent: input.chapterProgressPercent ?? null,
        lastReadAt: new Date(),
      },
    });
    return {
      contentId,
      contentProgressPercent: percent,
      chapterId: input.chapterId ?? null,
      chapterProgressPercent: input.chapterProgressPercent ?? null,
    };
  }

  async dashboard(auth: { userId: string; permissionVersion: number }) {
    const viewer = await this.resolveViewerFromAuth(auth);
    const owned = viewer.contentReadAll ? {} : { authorId: auth.userId };
    const [contentCount, draftCount, publishedCount, favoriteCount, bookletCount] =
      await Promise.all([
        this.prisma.content.count({ where: { ...owned, deletedAt: null } }),
        this.prisma.content.count({
          where: { ...owned, deletedAt: null, status: ContentStatus.DRAFT },
        }),
        this.prisma.content.count({
          where: { ...owned, deletedAt: null, status: ContentStatus.PUBLISHED },
        }),
        this.prisma.favorite.count({ where: { userId: auth.userId } }),
        this.prisma.content.count({
          where: { ...owned, deletedAt: null, type: ContentType.BOOKLET },
        }),
      ]);
    return { contentCount, draftCount, publishedCount, favoriteCount, bookletCount };
  }

  async listAdmin(
    auth: { userId: string; permissionVersion: number },
    query: {
      keyword?: string;
      types?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    await this.assertPermission(auth, 'content:read');
    const viewer = await this.resolveViewerFromAuth(auth);
    if (!viewer.contentReadAll) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '没有执行该操作的权限');
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.ContentWhereInput = {
      deletedAt: null,
      ...this.keywordWhere(query.keyword),
      ...this.typesWhere(query.types),
    };
    const [list, total] = await Promise.all([
      this.contents.list(where, (page - 1) * pageSize, pageSize, { updatedAt: 'desc' }),
      this.contents.count(where),
    ]);
    return {
      list: await Promise.all(list.map((row) => this.toListItem(row, viewer, false))),
      total,
      page,
      pageSize,
    };
  }

  async listCategoriesAdmin() {
    const rows = await this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { contents: true, children: true } },
      },
    });
    return rows.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      parentId: item.parentId ?? undefined,
      sort: item.sortOrder,
      contentCount: item._count.contents,
      childCount: item._count.children,
    }));
  }

  async createCategory(
    auth: { userId: string; permissionVersion: number },
    dto: {
      name: string;
      slug: string;
      parentId?: string;
      sortOrder?: number;
    },
    requestId: string | null,
  ) {
    await this.assertPermission(auth, 'category:manage');
    if (dto.parentId) {
      await this.requireCategory(dto.parentId);
      await this.assertNoCategoryCycle(dto.parentId, null);
    }
    const created = await this.contents.asTransaction(async (tx) => {
      const row = await tx.category.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          parentId: dto.parentId,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      await this.contents.createAudit(
        { action: 'category.create', actorId: auth.userId, targetId: row.id, requestId },
        tx,
      );
      return row;
    });
    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      parentId: created.parentId ?? undefined,
      sort: created.sortOrder,
    };
  }

  async patchCategory(
    auth: { userId: string; permissionVersion: number },
    id: string,
    dto: {
      name?: string;
      slug?: string;
      parentId?: string | null;
      sortOrder?: number;
      enabled?: boolean;
    },
    requestId: string | null,
  ) {
    await this.assertPermission(auth, 'category:manage');
    const current = await this.prisma.category.findUnique({ where: { id } });
    if (current === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CATEGORY_NOT_FOUND', '分类不存在');
    }
    if (dto.parentId) {
      await this.requireCategory(dto.parentId);
      await this.assertNoCategoryCycle(dto.parentId, id);
    }
    const updated = await this.contents.asTransaction(async (tx) => {
      const row = await tx.category.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          parentId: dto.parentId === undefined ? undefined : dto.parentId,
          sortOrder: dto.sortOrder,
          enabled: dto.enabled,
          version: { increment: 1 },
        },
      });
      await this.contents.createAudit(
        { action: 'category.update', actorId: auth.userId, targetId: id, requestId },
        tx,
      );
      return row;
    });
    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      parentId: updated.parentId ?? undefined,
      sort: updated.sortOrder,
    };
  }

  async deleteCategory(
    auth: { userId: string; permissionVersion: number },
    id: string,
    requestId: string | null,
  ) {
    await this.assertPermission(auth, 'category:manage');
    const current = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { contents: true, children: true } } },
    });
    if (current === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CATEGORY_NOT_FOUND', '分类不存在');
    }
    if (current._count.contents > 0 || current._count.children > 0) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'CATEGORY_IN_USE',
        '分类下仍有内容或子分类',
      );
    }
    await this.contents.asTransaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await this.contents.createAudit(
        { action: 'category.delete', actorId: auth.userId, targetId: id, requestId },
        tx,
      );
    });
    return { id };
  }

  async sortCategories(
    auth: { userId: string; permissionVersion: number },
    ids: string[],
    requestId: string | null,
  ) {
    await this.assertPermission(auth, 'category:manage');
    await this.contents.asTransaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx.category.update({ where: { id }, data: { sortOrder: index } });
      }
      await this.contents.createAudit(
        {
          action: 'category.sort',
          actorId: auth.userId,
          targetId: ids[0] ?? auth.userId,
          requestId,
          detail: { ids },
        },
        tx,
      );
    });
    return { ids };
  }

  async listTagsAdmin() {
    const rows = await this.contents.listTags();
    return rows.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      usageCount: item._count.contents,
    }));
  }

  async createTag(
    auth: { userId: string; permissionVersion: number },
    dto: { name: string; slug?: string },
    requestId: string | null,
  ) {
    await this.assertPermission(auth, 'tag:manage');
    const normalized = dto.name.trim().toLowerCase();
    const slug = dto.slug ?? this.tagSlug(dto.name);
    const existing = await this.prisma.tag.findUnique({ where: { normalizedName: normalized } });
    if (existing) {
      return { id: existing.id, name: existing.name, slug: existing.slug, usageCount: 0 };
    }
    const created = await this.contents.asTransaction(async (tx) => {
      const row = await tx.tag.create({
        data: { name: dto.name.trim(), normalizedName: normalized, slug, createdBy: auth.userId },
      });
      await this.contents.createAudit(
        { action: 'tag.create', actorId: auth.userId, targetId: row.id, requestId },
        tx,
      );
      return row;
    });
    return { id: created.id, name: created.name, slug: created.slug, usageCount: 0 };
  }

  async deleteTag(
    auth: { userId: string; permissionVersion: number },
    id: string,
    requestId: string | null,
  ) {
    await this.assertPermission(auth, 'tag:manage');
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { contents: true } } },
    });
    if (tag === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'TAG_NOT_FOUND', '标签不存在');
    }
    if (tag._count.contents > 0) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'TAG_IN_USE', '标签仍被内容引用');
    }
    await this.contents.asTransaction(async (tx) => {
      await tx.tag.delete({ where: { id } });
      await this.contents.createAudit(
        { action: 'tag.delete', actorId: auth.userId, targetId: id, requestId },
        tx,
      );
    });
    return { id };
  }

  viewSubjectHash(userId: string | undefined, ip: string | undefined): string {
    const raw = userId ? `user:${userId}` : `ip:${ip ?? 'unknown'}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 64);
  }

  private async recordView(contentId: string, subjectHash: string) {
    if (subjectHash === 'skip-view') {
      return;
    }
    const viewDate = new Date();
    viewDate.setHours(0, 0, 0, 0);
    try {
      await this.prisma.contentViewDay.create({
        data: { contentId, subjectHash, viewDate },
      });
      await this.prisma.content.update({
        where: { id: contentId },
        data: { viewCount: { increment: 1 } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }

  private async buildPublicWhere(query: {
    categorySlug?: string;
    tagSlugs?: string;
    types?: string;
    keyword?: string;
  }): Promise<Prisma.ContentWhereInput> {
    const where: Prisma.ContentWhereInput = {
      ...publicListWhere(),
      ...this.typesWhere(query.types),
      ...this.keywordWhere(query.keyword),
    };
    if (query.categorySlug) {
      where.category = { slug: query.categorySlug, enabled: true };
    }
    const slugs = (query.tagSlugs ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (slugs.length > 0) {
      where.AND = slugs.map((slug) => ({ tags: { some: { tag: { slug } } } }));
    }
    return where;
  }

  private typesWhere(types?: string): Prisma.ContentWhereInput {
    if (!types) {
      return {};
    }
    const parsed = types
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is ContentType =>
        (Object.values(ContentType) as string[]).includes(item),
      );
    if (parsed.length === 0) {
      return {};
    }
    return { type: { in: parsed } };
  }

  private keywordWhere(keyword?: string): Prisma.ContentWhereInput {
    const trimmed = keyword?.trim();
    if (!trimmed) {
      return {};
    }
    return {
      OR: [
        { title: { contains: trimmed, mode: 'insensitive' } },
        { summary: { contains: trimmed, mode: 'insensitive' } },
      ],
    };
  }

  private async requireEnabledCategory(slug: string) {
    const category = await this.contents.findCategoryBySlug(slug);
    if (category === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CATEGORY_NOT_FOUND', '分类不存在');
    }
    if (!category.enabled) {
      throw new DomainHttpException(HttpStatus.CONFLICT, 'CATEGORY_DISABLED', '分类已禁用');
    }
    return category;
  }

  /**
   * 按内容类型生成唯一可用于展示和搜索的正文派生字段。
   * 富文本原始 JSON 不可直接输出，必须从其 HTML 字段生成净化后的副本。
   */
  private deriveContentBody(
    type: ContentType,
    markdownSource: string | null | undefined,
    editorDocument: Prisma.JsonValue | RichTextDocumentDto | null | undefined,
  ): { html: string; toc?: unknown; wordCount: number; searchText: string } | null {
    if (type === ContentType.MARKDOWN) {
      if (!markdownSource) {
        return null;
      }
      const derived = deriveMarkdown(markdownSource);
      return { ...derived, searchText: markdownSource };
    }
    if (type === ContentType.RICH_TEXT) {
      const document = this.asRichTextDocument(editorDocument);
      if (document === null) {
        return null;
      }
      const derived = deriveRichText(document);
      return { ...derived, searchText: derived.plainText };
    }
    return null;
  }

  private asRichTextDocument(value: unknown): RichTextDocumentDto | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const html = (value as { html?: unknown }).html;
    return typeof html === 'string' ? { html } : null;
  }

  private async requireCategory(id: string) {
    const category = await this.contents.findCategoryById(id);
    if (category === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CATEGORY_NOT_FOUND', '分类不存在');
    }
    return category;
  }

  private async requireOwned(
    id: string,
    scope: ContentActionScope,
    options: { allowDeleted?: boolean } = {},
  ): Promise<ContentDetailRow> {
    const row = await this.contents.findById(id);
    if (row === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    if (row.deletedAt !== null && options.allowDeleted !== true) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    if (row.deletedAt === null && options.allowDeleted === true) {
      // restore 路径允许已删；未删在调用方处理
    }
    if (!scope.all && row.authorId !== scope.userId) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    return row;
  }

  /**
   * 编辑者提交审核：内容保持草稿；已有 PENDING 则更新申请可见性后原样返回。
   */
  private async submitReview(
    auth: { userId: string },
    row: ContentDetailRow,
    requestedVisibility: ContentVisibility,
    viewer: ContentViewer,
  ) {
    const pending = await this.prisma.contentReview.findFirst({
      where: { contentId: row.id, status: ContentReviewStatus.PENDING },
    });
    if (pending) {
      if (pending.requestedVisibility !== requestedVisibility) {
        await this.prisma.contentReview.update({
          where: { id: pending.id },
          data: { requestedVisibility },
        });
      }
      const next = await this.contents.findById(row.id);
      if (next === null) {
        throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
      }
      return this.toDetail(next, viewer, { publicView: false, favorited: false });
    }
    try {
      await this.prisma.contentReview.create({
        data: {
          contentId: row.id,
          requesterId: auth.userId,
          requestedVisibility,
          status: ContentReviewStatus.PENDING,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
    }
    const next = await this.contents.findById(row.id);
    if (next === null) {
      throw new DomainHttpException(HttpStatus.NOT_FOUND, 'CONTENT_NOT_FOUND', '内容不存在');
    }
    return this.toDetail(next, viewer, { publicView: false, favorited: false });
  }

  /**
   * 在已有事务内真正发布：写快照、改 PUBLISHED，可选套用申请的可见性。
   */
  private async executePublishInTx(
    tx: Prisma.TransactionClient,
    row: ContentDetailRow,
    actorId: string,
    requestId: string | null,
    visibility?: ContentVisibility,
  ) {
    await tx.contentVersion.create({
      data: {
        contentId: row.id,
        snapshotReason: 'PUBLISH_SNAPSHOT',
        markdownSource: row.body?.markdownSource,
        editorDocument: row.body?.editorDocument as Prisma.InputJsonValue | undefined,
        renderedHtml: row.body?.renderedHtml,
        toc: row.body?.toc as Prisma.InputJsonValue | undefined,
        createdBy: actorId,
      },
    });
    await tx.content.update({
      where: { id: row.id },
      data: {
        status: ContentStatus.PUBLISHED,
        publishedAt: row.publishedAt ?? new Date(),
        visibility,
        version: { increment: 1 },
      },
    });
    await this.contents.createAudit(
      { action: 'content.publish', actorId, targetId: row.id, requestId },
      tx,
    );
  }

  /**
   * 清导入版权闸。必须在已有事务内调用，供审核通过与管理员直接发布复用。
   * 用条件更新抢占 PRIVATE_UNTIL_LICENSED，避免两个清闸请求各自写一份快照。
   *
   * @returns 是否实际清闸；并发下第二人拿到 false 后应跳过快照。
   */
  private async applyImportLicenseInTx(
    tx: Prisma.TransactionClient,
    row: ContentDetailRow,
    actorId: string,
    note: string,
    requestId: string | null,
  ): Promise<boolean> {
    const licensed = await tx.content.updateMany({
      where: {
        id: row.id,
        importRestriction: ImportRestriction.PRIVATE_UNTIL_LICENSED,
      },
      data: { importRestriction: ImportRestriction.NONE, version: { increment: 1 } },
    });
    if (licensed.count !== 1) {
      return false;
    }
    await tx.contentVersion.create({
      data: {
        contentId: row.id,
        snapshotReason: 'IMPORT_SNAPSHOT',
        markdownSource: row.body?.markdownSource,
        createdBy: actorId,
      },
    });
    await this.contents.createAudit(
      {
        action: 'content.import-license',
        actorId,
        targetId: row.id,
        requestId,
        detail: { note },
      },
      tx,
    );
    return true;
  }

  private async cancelPendingReviewsInTx(
    tx: Prisma.TransactionClient,
    contentId: string,
    reviewerId: string,
  ) {
    await tx.contentReview.updateMany({
      where: { contentId, status: ContentReviewStatus.PENDING },
      data: {
        status: ContentReviewStatus.CANCELED,
        reviewerId,
        decidedAt: new Date(),
      },
    });
  }

  /**
   * 用单条 SQL 抢占 PENDING 审核。PostgreSQL 会在行锁释放后重新检查 WHERE，
   * 避免 Prisma updateMany 在交互事务里出现双写终态。
   */
  private async claimPendingReview(
    tx: Prisma.TransactionClient,
    reviewId: string,
    data: {
      status: ContentReviewStatus;
      reviewerId: string;
      copyrightNote?: string | null;
      rejectReason?: string | null;
    },
  ): Promise<void> {
    const count = await tx.$executeRaw`
      UPDATE content_reviews
      SET
        status = CAST(${data.status} AS "ContentReviewStatus"),
        reviewer_id = ${data.reviewerId}::uuid,
        copyright_note = ${data.copyrightNote ?? null},
        reject_reason = ${data.rejectReason ?? null},
        decided_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${reviewId}::uuid
        AND status = CAST(${ContentReviewStatus.PENDING} AS "ContentReviewStatus")
    `;
    if (count !== 1) {
      throw this.reviewNotPending();
    }
  }

  private reviewNotPending(): DomainHttpException {
    return new DomainHttpException(
      HttpStatus.CONFLICT,
      'CONTENT_REVIEW_INVALID_STATE',
      '只能处理待审核记录',
    );
  }

  private async assertPublishAll(auth: { userId: string; permissionVersion: number }) {
    const grant = await this.assertPermission(auth, 'content:publish');
    if (!grant.all) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '内容审核需要全站发布权限');
    }
  }

  private async assertFileOrBookletReady(
    row: ContentDetailRow,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (row.type === ContentType.PDF || row.type === ContentType.WORD) {
      if (!row.primaryFileId) {
        throw new DomainHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'CONTENT_PUBLISH_VALIDATION_FAILED',
          'PDF / Word 发布前需要主文件',
        );
      }
    }
    if (row.type === ContentType.BOOKLET) {
      const chapterCount = await db.contentChapter.count({ where: { contentId: row.id } });
      if (chapterCount < 1) {
        throw new DomainHttpException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'CONTENT_PUBLISH_VALIDATION_FAILED',
          '小册发布前需要至少一个章节',
        );
      }
    }
  }

  private needsImportLicense(row: ContentDetailRow, targetVisibility: ContentVisibility) {
    return (
      row.importRestriction === ImportRestriction.PRIVATE_UNTIL_LICENSED &&
      targetVisibility !== ContentVisibility.PRIVATE
    );
  }

  private assertCopyrightNoteIfNeeded(
    row: ContentDetailRow,
    targetVisibility: ContentVisibility,
    copyrightNote: string | undefined,
  ) {
    if (!this.needsImportLicense(row, targetVisibility)) {
      return;
    }
    if (!copyrightNote?.trim()) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'CONTENT_COPYRIGHT_NOTE_REQUIRED',
        '导入内容公开或登录可见前需要填写版权说明',
      );
    }
  }

  private toReviewItem(row: ContentReviewRow) {
    return {
      id: row.id,
      status: row.status,
      requestedVisibility: row.requestedVisibility,
      copyrightNote: row.copyrightNote,
      rejectReason: row.rejectReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      requester: {
        id: row.requester.id,
        nickname: displayName(row.requester.nickname, row.requester.email),
      },
      reviewer: row.reviewer
        ? {
            id: row.reviewer.id,
            nickname: displayName(row.reviewer.nickname, row.reviewer.email),
          }
        : null,
      content: {
        id: row.content.id,
        type: row.content.type,
        title: row.content.title ?? '',
        status: row.content.status,
        visibility: row.content.visibility,
        importRestriction: row.content.importRestriction,
        author: {
          id: row.content.author.id,
          nickname: displayName(row.content.author.nickname, row.content.author.email),
        },
      },
    };
  }

  private assertPublishable(
    row: ContentDetailRow,
    options: { skipImportRestriction?: boolean } = {},
  ) {
    if (!PUBLISHABLE_TYPES.includes(row.type)) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CONTENT_TYPE_NOT_SUPPORTED',
        '当前阶段不能发布该类型',
      );
    }
    const title = row.title?.trim() ?? '';
    if (title.length < 1 || title.length > 200) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CONTENT_PUBLISH_VALIDATION_FAILED',
        '发布前需要 1～200 字标题',
      );
    }
    if (row.categoryId === null || row.category?.enabled === false) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CONTENT_PUBLISH_VALIDATION_FAILED',
        '发布前需要选择启用中的分类',
      );
    }
    if (
      !options.skipImportRestriction &&
      row.importRestriction === ImportRestriction.PRIVATE_UNTIL_LICENSED &&
      row.visibility !== ContentVisibility.PRIVATE
    ) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'CONTENT_IMPORT_RESTRICTION_ACTIVE',
        '导入限制解除前不能公开',
      );
    }
    if (row.type === ContentType.MARKDOWN && !row.body?.markdownSource?.trim()) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CONTENT_PUBLISH_VALIDATION_FAILED',
        'Markdown 发布前需要正文',
      );
    }
    if (row.type === ContentType.RICH_TEXT && !row.body?.renderedHtml?.trim()) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CONTENT_PUBLISH_VALIDATION_FAILED',
        '富文本发布前需要有效正文',
      );
    }
    if ((row.type === ContentType.LINK || row.type === ContentType.PROJECT) && !row.externalUrl) {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CONTENT_PUBLISH_VALIDATION_FAILED',
        '外链/项目发布前需要地址',
      );
    }
    if (row.externalUrl) {
      this.assertHttpsUrl(row.externalUrl);
    }
  }

  private assertHttpsUrl(url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new DomainHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CONTENT_PUBLISH_VALIDATION_FAILED',
        '外链不是合法 URL',
      );
    }
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol === 'https:') {
      return;
    }
    if (parsed.protocol === 'http:' && local && process.env.NODE_ENV !== 'production') {
      return;
    }
    throw new DomainHttpException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'CONTENT_PUBLISH_VALIDATION_FAILED',
      '外链只允许 HTTPS',
    );
  }

  private async assertPermission(
    auth: { userId: string; permissionVersion: number },
    code: string,
  ): Promise<{ all: boolean }> {
    const grant = await this.hasPermission(auth, code);
    if (!grant.ok) {
      throw new DomainHttpException(HttpStatus.FORBIDDEN, 'AUTH_FORBIDDEN', '没有执行该操作的权限');
    }
    return { all: grant.all };
  }

  private async replaceTags(
    tx: Prisma.TransactionClient,
    contentId: string,
    names: string[],
    userId: string,
  ) {
    const ids = new Set<string>();
    for (const raw of names) {
      const name = raw.trim();
      if (!name) {
        continue;
      }
      const normalized = name.toLowerCase();
      const tag = await tx.tag.upsert({
        where: { normalizedName: normalized },
        create: { name, normalizedName: normalized, slug: this.tagSlug(name), createdBy: userId },
        update: {},
      });
      ids.add(tag.id);
    }
    await tx.contentTag.deleteMany({ where: { contentId } });
    if (ids.size > 0) {
      await tx.contentTag.createMany({
        data: [...ids].map((tagId) => ({ contentId, tagId })),
      });
    }
  }

  private tagSlug(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-|-$/g, '');
    if (slug && /^[a-z0-9-]+$/.test(slug)) {
      return slug.slice(0, 80);
    }
    return `tag-${createHash('sha256').update(name).digest('hex').slice(0, 8)}`;
  }

  private async assertNoCategoryCycle(parentId: string, selfId: string | null) {
    if (parentId === selfId) {
      throw new DomainHttpException(
        HttpStatus.CONFLICT,
        'CATEGORY_CYCLE_DETECTED',
        '不能把分类放到自己下面',
      );
    }
    let current: string | null = parentId;
    const seen = new Set<string>(selfId ? [selfId] : []);
    while (current) {
      if (seen.has(current)) {
        throw new DomainHttpException(
          HttpStatus.CONFLICT,
          'CATEGORY_CYCLE_DETECTED',
          '分类不能形成循环',
        );
      }
      seen.add(current);
      const row: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      current = row?.parentId ?? null;
    }
  }

  private async toListItem(row: ContentDetailRow, viewer: ContentViewer, publicView: boolean) {
    const locked = publicView && isPublicListLocked(row.visibility, viewer);
    return {
      id: row.id,
      type: row.type,
      title: row.title ?? '',
      summary: row.summary ?? '',
      coverFileId: row.coverFileId,
      coverUrl: await this.files.signFileId(row.coverFileId),
      category: row.category ? { slug: row.category.slug, name: row.category.name } : null,
      tags: row.tags.map((item) => ({ slug: item.tag.slug, name: item.tag.name })),
      visibility: row.visibility,
      status: row.status,
      locked,
      isFeatured: row.isFeatured,
      viewCount: row.viewCount,
      favoriteCount: row._count.favorites,
      wordCount: row.wordCount,
      publishedAt: row.publishedAt?.toISOString() ?? row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      author: {
        id: row.author.id,
        nickname: displayName(row.author.nickname, row.author.email),
      },
      version: row.version,
      importRestriction: row.importRestriction,
      reviewStatus: row.reviews[0]?.status ?? null,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      restoreUntil: row.deletedAt
        ? new Date(row.deletedAt.getTime() + SOFT_DELETE_MS).toISOString()
        : null,
    };
  }

  private async toDetail(
    row: ContentDetailRow,
    viewer: ContentViewer,
    options: { publicView: boolean; favorited: boolean },
  ) {
    return {
      ...(await this.toListItem(row, viewer, options.publicView)),
      isFavorited: options.favorited,
      markdownSource: row.body?.markdownSource ?? null,
      renderedHtml: row.body?.renderedHtml ?? null,
      toc: row.body?.toc ?? [],
      editorDocument: options.publicView ? undefined : row.body?.editorDocument,
      externalUrl: row.externalUrl,
      extra: row.extra,
      primaryFileId: row.primaryFileId,
      previewUrl: await this.files.signFileId(row.primaryFileId),
    };
  }
}

function displayName(nickname: string | null, email: string): string {
  if (nickname && nickname.trim()) {
    return nickname.trim();
  }
  const local = email.split('@')[0];
  return local || '用户';
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}
