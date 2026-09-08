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

/**
 * api-client 热更新滞后时，从 Nest 原始 payload 补齐 about/layout。
 */
function enrichPublicConfig(
  payload: NestPublicSiteConfig,
  mapped: SystemPublicConfig,
): SystemPublicConfig {
  const about = payload.about;
  const layout = payload.layout;
  return {
    ...mapped,
    about: mapped.about ?? (about
      ? { title: about.title ?? '关于我', markdown: about.markdown ?? '' }
      : undefined),
    layout: mapped.layout ?? layout,
  };
}

export async function fetchPublicConfig() {
  const res = await request<NestPublicSiteConfig>('/api/v1/public/site-config', {
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
