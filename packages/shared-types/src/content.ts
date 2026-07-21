/**
 * 内容系统类型
 *
 * 覆盖 Markdown、小册、PDF、Word、富文本、外链、项目等内容类型。
 * 字段命名尽量贴近后续 NestJS API 与数据库表结构。
 */

/** 内容类型枚举 */
export enum ContentType {
  Markdown = 'markdown',
  Booklet = 'booklet',
  Pdf = 'pdf',
  Word = 'word',
  RichText = 'richtext',
  Link = 'link',
  Project = 'project',
}

/** 内容类型中文标签 */
export const ContentTypeLabel: Record<ContentType, string> = {
  [ContentType.Markdown]: 'Markdown',
  [ContentType.Booklet]: '小册',
  [ContentType.Pdf]: 'PDF',
  [ContentType.Word]: 'Word',
  [ContentType.RichText]: '富文本',
  [ContentType.Link]: '外链',
  [ContentType.Project]: '项目',
};

/** 内容状态 */
export enum ContentStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
}

export const ContentStatusLabel: Record<ContentStatus, string> = {
  [ContentStatus.Draft]: '草稿',
  [ContentStatus.Published]: '已发布',
  [ContentStatus.Archived]: '已归档',
};

/** 可见性范围 */
export enum ContentVisibility {
  Public = 'public',
  Login = 'login',
  Private = 'private',
}

export const ContentVisibilityLabel: Record<ContentVisibility, string> = {
  [ContentVisibility.Public]: '公开',
  [ContentVisibility.Login]: '登录可见',
  [ContentVisibility.Private]: '私密',
};

/** 内容列表卡片字段 */
export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  summary: string;
  cover?: string;
  categorySlug?: string;
  tags?: string[];
  viewCount: number;
  favoriteCount: number;
  publishedAt: string;
  author: string;
  /**
   * 内容状态。
   * 公开内容中心通常只展示已发布内容，工作区/后台列表会使用该字段做筛选和操作。
   */
  status?: ContentStatus;
  /**
   * 可见性范围。
   * 公开页可不关心该字段；工作区和管理台需要用它判断展示范围。
   */
  visibility?: ContentVisibility;
  /** 创建时间，后续接后端后用于管理台排序和审计追踪。 */
  createdAt?: string;
  /** 最近更新时间，工作区列表优先展示该字段。 */
  updatedAt?: string;
}

/** 内容详情 */
export interface ContentDetail extends ContentItem {
  /** Markdown / 富文本正文 */
  body?: string;
  /** 外链地址 */
  link?: string;
  /** PDF / Word 等预览文件地址 */
  previewUrl?: string;
  /** 详情页必须具备状态，便于处理草稿/归档内容的访问边界。 */
  status: ContentStatus;
  /** 详情页必须具备可见性，便于后端接入后统一鉴权。 */
  visibility: ContentVisibility;
  /** 详情页必须具备创建时间。 */
  createdAt: string;
  /** 详情页必须具备更新时间。 */
  updatedAt: string;
}

/** 阅读进度记录 */
export interface ReadingProgress {
  contentId: string;
  chapterId?: string;
  /** 0-100 的阅读百分比 */
  percent: number;
  updatedAt: string;
}
