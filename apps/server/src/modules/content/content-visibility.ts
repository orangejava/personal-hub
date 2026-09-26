import { ContentStatus, ContentVisibility, ImportRestriction, type Prisma } from '@prisma/client';

export interface ContentViewer {
  userId?: string;
  /** content:read 为 ALL 时，工作区/后台可跨作者；公开路径仍不泄漏私有资源。 */
  contentReadAll: boolean;
}

/**
 * 内容中心列表按 viewer 收敛可见性。
 * PRIVATE 只进入作者本人和授权用户的已发布列表；ALL 管理范围不会污染公开前台。
 */
export function publicListWhere(viewer: ContentViewer): Prisma.ContentWhereInput {
  const generallyVisible: Prisma.ContentWhereInput = {
    importRestriction: ImportRestriction.NONE,
    visibility: {
      in:
        viewer.userId === undefined
          ? [ContentVisibility.PUBLIC]
          : [ContentVisibility.PUBLIC, ContentVisibility.LOGIN],
    },
  };
  return {
    deletedAt: null,
    status: ContentStatus.PUBLISHED,
    OR:
      viewer.userId === undefined
        ? [generallyVisible]
        : [
            generallyVisible,
            // 作者可以在内容中心看到自己已经发布的私密内容，包括尚未清版权闸的小册。
            { visibility: ContentVisibility.PRIVATE, authorId: viewer.userId },
            {
              visibility: ContentVisibility.PRIVATE,
              importRestriction: ImportRestriction.NONE,
              accessGrants: { some: { userId: viewer.userId } },
            },
          ],
  };
}

/** 首页精选不提供锁定卡片，匿名主体不能获知 LOGIN 内容的标题或摘要。 */
export function publicFeaturedWhere(viewer: ContentViewer): Prisma.ContentWhereInput {
  return {
    deletedAt: null,
    status: ContentStatus.PUBLISHED,
    importRestriction: ImportRestriction.NONE,
    visibility: {
      in:
        viewer.userId === undefined
          ? [ContentVisibility.PUBLIC]
          : [ContentVisibility.PUBLIC, ContentVisibility.LOGIN],
    },
  };
}

export function isPublicListLocked(visibility: ContentVisibility, viewer: ContentViewer): boolean {
  return visibility === ContentVisibility.LOGIN && viewer.userId === undefined;
}

/**
 * 公开详情能否看到正文。私有/草稿/归档一律当不存在。
 */
export function publicDetailAccess(
  row: {
    status: ContentStatus;
    visibility: ContentVisibility;
    deletedAt: Date | null;
    importRestriction: ImportRestriction;
    authorId: string;
    accessGrants?: Array<{ userId: string }>;
  },
  viewer: ContentViewer,
): 'ok' | 'login' | 'not_found' {
  if (row.deletedAt !== null) {
    return 'not_found';
  }
  // 作者和全站读者可以预览自己的草稿/私有小册；匿名和其他人仍按发布态过滤。
  if (row.authorId === viewer.userId || viewer.contentReadAll) {
    return 'ok';
  }
  if (row.status !== ContentStatus.PUBLISHED) {
    return 'not_found';
  }
  if (row.importRestriction === ImportRestriction.PRIVATE_UNTIL_LICENSED) {
    return 'not_found';
  }
  if (row.visibility === ContentVisibility.PRIVATE) {
    return viewer.userId !== undefined &&
      row.accessGrants?.some((item) => item.userId === viewer.userId)
      ? 'ok'
      : 'not_found';
  }
  if (row.visibility === ContentVisibility.LOGIN && viewer.userId === undefined) {
    return 'login';
  }
  return 'ok';
}

export function workspaceListWhere(
  viewer: ContentViewer,
  input: { lifecycle?: ContentStatus; includeDeleted?: boolean },
): Prisma.ContentWhereInput {
  const where: Prisma.ContentWhereInput = {};
  if (!viewer.contentReadAll) {
    if (viewer.userId === undefined) {
      where.id = { in: [] };
    } else {
      where.authorId = viewer.userId;
    }
  }
  if (input.includeDeleted === true) {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }
  if (input.lifecycle !== undefined) {
    where.status = input.lifecycle;
  }
  return where;
}
