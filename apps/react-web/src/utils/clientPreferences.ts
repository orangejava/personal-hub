/**
 * 客户端用户偏好：主题与阅读进度等落在 localStorage。
 * 优先级：用户本地偏好 > 站点系统默认；后续可再同步到数据库。
 */

import type { PublicThemeSettings } from '@/types/app';

const STORAGE_KEY = 'ph.prefs.v1';

/** 单篇/小册阅读进度 */
export interface LocalReadingProgress {
  /** 小册章节 id；Markdown 单篇可无 */
  chapterId?: string;
  /** 章内/页内纵向滚动位置（px） */
  scrollY: number;
  /** 0–100 阅读百分比 */
  percent: number;
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
    updatedAt: progress.updatedAt ?? new Date().toISOString(),
  };
  writeAll({ ...all, reading });
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
