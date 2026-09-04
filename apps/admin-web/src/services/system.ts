/**
 * 系统配置服务。公开读取走 Nest；失败由调用方 try/catch，不再回落 mock。
 */
import type { ThemeConfig } from '@personal-hub/shared-types';
import {
  mapPublicSiteConfig,
  readNestData,
  type NestPublicSiteConfig,
} from '@personal-hub/api-client';
import { request } from '@umijs/max';

export async function fetchPublicConfig() {
  const res = await request<NestPublicSiteConfig>('/api/v1/public/site-config', {
    skipErrorHandler: true,
  });
  return mapPublicSiteConfig(readNestData(res));
}

export async function fetchThemeConfig() {
  return request<ThemeConfig>('/api/system/theme');
}
