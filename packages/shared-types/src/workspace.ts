/**
 * 工作区类型
 */

/** 工作台统计卡片 */
export interface WorkspaceStats {
  /** 我的文档总数 */
  contentCount: number;
  /** 草稿数 */
  draftCount: number;
  /** 已发布数 */
  publishedCount: number;
  /** 收藏数 */
  favoriteCount: number;
  /** 本地小册数 */
  bookletCount: number;
}

/** 继续阅读项 */
export interface ContinueReading {
  contentId: string;
  title: string;
  type: string;
  percent: number;
  updatedAt: string;
}

/** 工作区文档查询参数 */
export interface WorkspaceContentQuery {
  keyword?: string;
  type?: string;
  status?: string;
  visibility?: string;
}

/** 我的用量统计（Token，来自 Nest 额度账本） */
export interface WorkspaceUsage {
  totalTokens: number;
  usedTokens: number;
  remainingTokens: number;
  recent?: { date: string; tokens: number; reason?: string }[];
}
