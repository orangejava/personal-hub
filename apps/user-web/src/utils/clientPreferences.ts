/**
 * 客户端用户偏好：主题与阅读进度等落在 localStorage。
 * 优先级：用户本地偏好 > 站点系统默认；后续可再同步到数据库。
 */

import type { PublicThemeSettings } from '@/types/app';

const STORAGE_KEY = 'ph.prefs.v1';
const MAX_READING_PROGRESS_ENTRIES = 100;

/** 单篇/小册阅读进度 */
export interface LocalReadingProgress {
  /** 小册章节 id；Markdown 单篇可无 */
  chapterId?: string;
  /** 章内/页内纵向滚动位置（px） */
  scrollY: number;
  /** 0–100 阅读百分比 */
  percent: number;
  /** PDF 按页恢复；旧的滚动记录没有该字段时仍按 scrollY 兼容。 */
  page?: number;
  totalPages?: number;
  kind?: 'scroll' | 'page';
  updatedAt: string;
}

export interface ClientPreferences {
  theme?: PublicThemeSettings;
  reading?: Record<string, LocalReadingProgress>;
  /** 登录页勾选「记住用户名」后保存的邮箱 */
  rememberedLoginEmail?: string;
}

function readAll(): ClientPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ClientPreferences;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(next: ClientPreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / 隐私模式：忽略写入失败，不影响阅读
  }
}

/** 读取用户主题偏好；无则返回 undefined（沿用站点默认） */
export function getThemePreference(): PublicThemeSettings | undefined {
  const theme = readAll().theme;
  if (!theme?.navTheme || !theme?.colorPrimary) return undefined;
  if (theme.navTheme !== 'light' && theme.navTheme !== 'realDark') return undefined;
  return theme;
}

/** 保存用户主题（覆盖站点默认，直到再次修改） */
export function setThemePreference(theme: PublicThemeSettings) {
  const all = readAll();
  writeAll({ ...all, theme });
}

/** 读取某内容的阅读进度 */
export function getReadingProgress(
  contentId: string,
): LocalReadingProgress | undefined {
  const item = readAll().reading?.[contentId];
  if (!item || typeof item.scrollY !== 'number') return undefined;
  return item;
}

/** 写入阅读进度（按 contentId 合并） */
export function setReadingProgress(
  contentId: string,
  progress: Omit<LocalReadingProgress, 'updatedAt'> & { updatedAt?: string },
) {
  const all = readAll();
  const reading = { ...(all.reading ?? {}) };
  reading[contentId] = {
    chapterId: progress.chapterId,
    scrollY: Math.max(0, Math.round(progress.scrollY)),
    percent: Math.min(100, Math.max(0, Math.round(progress.percent))),
    page:
      typeof progress.page === 'number' ? Math.max(1, Math.round(progress.page)) : undefined,
    totalPages:
      typeof progress.totalPages === 'number'
        ? Math.max(1, Math.round(progress.totalPages))
        : undefined,
    kind: progress.kind,
    updatedAt: progress.updatedAt ?? new Date().toISOString(),
  };
  // 阅读记录只用于恢复最近内容的位置，不能随着长期使用无限占用同一份偏好存储。
  const overflow = Object.entries(reading)
    .sort(([, left], [, right]) => left.updatedAt.localeCompare(right.updatedAt))
    .slice(0, Math.max(0, Object.keys(reading).length - MAX_READING_PROGRESS_ENTRIES));
  overflow.forEach(([id]) => {
    delete reading[id];
  });
  writeAll({ ...all, reading });
}

/** 阅读检查点按约四分之一屏保存，并限制极端屏幕的写入频率。 */
export function getReadingCheckpointDistance(viewportHeight: number): number {
  return Math.min(240, Math.max(160, Math.round(viewportHeight * 0.25)));
}

/** 判断当前快照是否已经跨过需要落盘的阅读检查点。 */
export function shouldPersistReadingProgress(
  previous: LocalReadingProgress | undefined,
  next: LocalReadingProgress,
  viewportHeight: number,
  atBoundary = false,
): boolean {
  if (!previous) return true;
  if (next.chapterId !== previous.chapterId) return true;
  if (next.kind === 'page' || previous.kind === 'page') {
    return next.page !== previous.page || next.totalPages !== previous.totalPages;
  }
  // 顶部/底部只保证位置发生变化时落盘，避免滚动回弹事件连续改写 localStorage。
  if (atBoundary) return next.scrollY !== previous.scrollY || next.percent !== previous.percent;
  return Math.abs(next.scrollY - previous.scrollY) >= getReadingCheckpointDistance(viewportHeight);
}

/**
 * 根据文档高度与当前 scrollY 估算阅读百分比。
 */
/** 读取登录页记住的邮箱；未勾选或无效时返回 undefined */
export function getRememberedLoginEmail(): string | undefined {
  const email = readAll().rememberedLoginEmail?.trim().toLowerCase();
  if (!email?.includes('@')) return undefined;
  return email;
}

/** 勾选记住用户名且已输入邮箱时写入；取消勾选时清空 */
export function setRememberedLoginEmail(email: string | undefined) {
  const all = readAll();
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    const { rememberedLoginEmail: _omit, ...rest } = all;
    writeAll(rest);
    return;
  }
  writeAll({ ...all, rememberedLoginEmail: normalized });
}

export function calcScrollPercent(scrollY: number): number {
  if (typeof window === 'undefined') return 0;
  const max =
    document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((scrollY / max) * 100)));
}
