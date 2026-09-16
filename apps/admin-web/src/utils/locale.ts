import { getLocale, setLocale } from '@umijs/max';

/** 当前运营的语言；其它 locale 文件已挪出 `src/locales`，Umi 不会加载 */
export const ACTIVE_LOCALES = ['zh-CN', 'en-US'] as const;

export type ActiveLocale = (typeof ACTIVE_LOCALES)[number];

/**
 * 是否为当前会加载的语言。
 *
 * @param locale Umi `getLocale()` 或 localStorage 中的值
 */
export function isActiveLocale(locale: string): locale is ActiveLocale {
  return (ACTIVE_LOCALES as readonly string[]).includes(locale);
}

/**
 * 纠正历史会话里残留的 ja-JP 等 locale。
 * 必须在 Umi 运行时就绪后调用（例如 getInitialState），不能在 app.tsx 顶层执行。
 * 不注册的语言会导致文案 key 原样显示。
 */
export function ensureActiveLocale(): void {
  if (!isActiveLocale(getLocale())) {
    setLocale('zh-CN', false);
  }
}
