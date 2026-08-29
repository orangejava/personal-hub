/**
 * 系统配置服务
 */
import { request } from '@umijs/max';
import type { ApiResponse, SystemPublicConfig, ThemeConfig } from '@personal-hub/shared-types';

export async function fetchPublicConfig() {
  return request<ApiResponse<SystemPublicConfig>>('/api/system/config/public');
}

export async function fetchThemeConfig() {
  return request<ApiResponse<ThemeConfig>>('/api/system/theme');
}
