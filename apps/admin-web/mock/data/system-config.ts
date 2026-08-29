/**
 * Mock 系统配置
 */
import type { SystemPublicConfig } from '@personal-hub/shared-types';

export const systemConfig: SystemPublicConfig = {
  siteName: 'Personal Hub',
  siteDescription: '个人知识中台 + 内容管理平台 + AI 工具箱',
  heroTitle: '把知识沉淀成可复用的资产',
  heroSubtitle: '内容阅读 · 内容生产 · AI 工具，一站完成',
  navigation: 'top',
  aiEnabled: false,
  theme: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    mode: 'light',
  },
};
