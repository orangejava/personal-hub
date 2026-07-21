/**
 * 小册（掘金小册 / 本地小册）类型
 */

/** 小册元信息 */
export interface Booklet {
  id: string;
  title: string;
  author: string;
  summary: string;
  cover?: string;
  categorySlug?: string;
  tags?: string[];
  /** 章节总数 */
  chapterCount: number;
  /** 同步来源：mock 静态数据或本地文件夹扫描 */
  source: 'mock' | 'local';
  /** 本地同步时间，仅 source=local 时有值 */
  syncedAt?: string;
  /** 同步过程中的告警信息 */
  warnings?: string[];
}

/** 小册章节 */
export interface BookletChapter {
  id: string;
  bookletId: string;
  /** 章节序号，按文件名数字前缀排序 */
  order: number;
  title: string;
  /** Markdown 正文 */
  body: string;
  /** 章节内目录（二级标题） */
  toc?: { level: number; text: string; anchor: string }[];
  /** 是否空内容 */
  empty?: boolean;
}
