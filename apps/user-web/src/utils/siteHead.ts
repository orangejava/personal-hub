import type { SystemPublicConfig } from '@personal-hub/shared-types';

export interface SiteHead {
  title: string;
  description: string;
  keywords: string;
  faviconUrl: string | null;
}

type Listener = () => void;

const fallback: SiteHead = {
  title: 'Personal Hub',
  description: '',
  keywords: '',
  faviconUrl: null,
};

let current: SiteHead = { ...fallback };
const listeners = new Set<Listener>();

/** 与公开站默认主色一致。配置里的颜色不合法时用它，避免把任意字符串写进 SVG。 */
const DEFAULT_BRAND_COLOR = '#722ed1';
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function brandFill(color: string | undefined): string {
  if (color && HEX_COLOR.test(color)) return color;
  return DEFAULT_BRAND_COLOR;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}

/**
 * 浏览器图标没有文字类型，文字模式画成一张小 SVG，不走上传。
 * 底色用站点主色，这样后台改主色后，文字图标和页头是同一种颜色。
 */
export function faviconTextDataUrl(text: string, color?: string): string {
  const label = escapeXml(text.trim().slice(0, 2) || 'P');
  const fill = brandFill(color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${fill}"/><text x="16" y="21" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#ffffff">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function resolveFaviconHref(config: SystemPublicConfig): string | null {
  const mode = config.faviconMode ?? (config.faviconUrl ? 'image' : 'text');
  if (mode === 'image' && config.faviconUrl) return config.faviconUrl;
  const source = config.faviconText?.trim() || config.siteName?.trim() || fallback.title;
  return faviconTextDataUrl(source, config.theme?.colorPrimary);
}

/** 公开配置里的站点身份，供 rootContainer 的 Helmet 读取。空字段不输出对应节点。 */
export function siteHeadFromConfig(config?: SystemPublicConfig | null): SiteHead {
  if (!config) return { ...fallback };
  return {
    title: config.siteName?.trim() || fallback.title,
    description: config.siteDescription?.trim() ?? '',
    keywords: config.keywords?.trim() ?? '',
    faviconUrl: resolveFaviconHref(config),
  };
}

export function getSiteHead(): SiteHead {
  return current;
}

export function setSiteHead(next: SiteHead): void {
  current = next;
  for (const listener of listeners) listener();
}

export function subscribeSiteHead(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
