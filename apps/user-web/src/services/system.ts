/**
 * 系统配置服务。公开读取走 Nest；失败由调用方 try/catch，不再回落 mock。
 * skipErrorHandler：getInitialState 失败应静默回退，不能每页弹 toast。
 */
import type { SystemPublicConfig, ThemeConfig } from '@personal-hub/shared-types';
import {
  mapPublicSiteConfig,
  readNestData,
  type NestMenuNode,
  type NestPublicSiteConfig,
} from '@personal-hub/api-client';
import { request } from '@umijs/max';

export interface PublicHomepageModule {
  key: string;
  title: string;
  visible: boolean;
  sort: number;
}

export interface PublicHomepageConfig {
  hero: {
    title: string;
    subtitle: string;
    primaryAction: { label: string; target: string };
    secondaryAction: { label: string; target: string };
  };
  modules: PublicHomepageModule[];
  aiTools: { key: string; title: string; description: string; enabled: boolean }[];
  techStack: { name: string; icon?: string; category: string }[];
}

/** 公开配置在扁平字段之外，再带上首页区块。页面读的是解包后的对象。 */
export type PublicSiteView = SystemPublicConfig & {
  homepage?: PublicHomepageConfig;
};

type PublicSitePayload = NestPublicSiteConfig & {
  homepage?: NestPublicSiteConfig['homepage'] & {
    modules?: PublicHomepageModule[];
    aiTools?: PublicHomepageConfig['aiTools'];
    techStack?: PublicHomepageConfig['techStack'];
  };
};

function readHomepage(payload: PublicSitePayload): PublicHomepageConfig | undefined {
  const homepage = payload.homepage;
  if (!homepage?.hero?.title) return undefined;
  return {
    hero: {
      title: homepage.hero.title,
      subtitle: homepage.hero.subtitle,
      primaryAction: homepage.hero.primaryAction ?? { label: '浏览内容', target: '/content' },
      secondaryAction: homepage.hero.secondaryAction ?? { label: '关于我', target: '/about' },
    },
    modules: homepage.modules ?? [],
    aiTools: homepage.aiTools ?? [],
    techStack: homepage.techStack ?? [],
  };
}

/**
 * api-client 热更新滞后时，从 Nest 原始 payload 补齐 about/layout。
 * 首页区块不写入共享的扁平配置，避免和其他 worktree 抢同一处类型。
 */
function enrichPublicConfig(payload: PublicSitePayload, mapped: SystemPublicConfig): PublicSiteView {
  const about = payload.about;
  const layout = payload.layout;
  return {
    ...mapped,
    logo: payload.logoUrl || mapped.logo,
    logoMode: payload.logoMode ?? mapped.logoMode,
    logoText: payload.logoText ?? mapped.logoText,
    faviconUrl: payload.faviconUrl ?? mapped.faviconUrl ?? null,
    faviconMode: payload.faviconMode ?? mapped.faviconMode,
    faviconText: payload.faviconText ?? mapped.faviconText,
    loadingStyle: payload.loadingStyle ?? mapped.loadingStyle,
    loadingTitle: payload.loadingTitle ?? mapped.loadingTitle,
    loadingSubtitle: payload.loadingSubtitle ?? mapped.loadingSubtitle,
    loadingImageUrl: payload.loadingImageUrl ?? mapped.loadingImageUrl ?? null,
    loadingSvg: payload.loadingSvg ?? mapped.loadingSvg,
    loadingShowSkeleton: payload.loadingShowSkeleton ?? mapped.loadingShowSkeleton,
    loadingMotion: payload.loadingMotion ?? mapped.loadingMotion,
    loadingSizeMode: payload.loadingSizeMode ?? mapped.loadingSizeMode,
    loadingMaxWidth: payload.loadingMaxWidth ?? mapped.loadingMaxWidth,
    loadingMaxHeight: payload.loadingMaxHeight ?? mapped.loadingMaxHeight,
    loadingWidth: payload.loadingWidth ?? mapped.loadingWidth,
    loadingHeight: payload.loadingHeight ?? mapped.loadingHeight,
    loadingVideoUrl: payload.loadingVideoUrl ?? mapped.loadingVideoUrl ?? null,
    keywords: payload.keywords ?? mapped.keywords,
    about: mapped.about ?? (about
      ? { title: about.title ?? '关于我', markdown: about.markdown ?? '' }
      : undefined),
    layout: mapped.layout ?? layout,
    homepage: readHomepage(payload),
  };
}

export async function fetchPublicConfig() {
  const res = await request<PublicSitePayload>('/api/v1/public/site-config', {
    skipErrorHandler: true,
  });
  const payload = readNestData(res);
  return enrichPublicConfig(payload, mapPublicSiteConfig(payload));
}

export async function fetchPublicNavigation() {
  const res = await request<NestMenuNode[]>('/api/v1/public/navigation', {
    skipErrorHandler: true,
  });
  return readNestData(res);
}

export async function fetchThemeConfig() {
  return request<ThemeConfig>('/api/system/theme');
}
