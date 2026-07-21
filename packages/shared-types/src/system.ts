/**
 * 系统配置类型
 */

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** 导航栏位置 */
export type NavigationPosition = 'top' | 'left' | 'right';

/** 主题配置，前端启动时注入 Ant Design ConfigProvider */
export interface ThemeConfig {
  colorPrimary: string;
  colorSuccess?: string;
  colorWarning?: string;
  colorError?: string;
  borderRadius?: number;
  fontFamily?: string;
  mode: ThemeMode;
}

/** 站点公开系统配置 */
export interface SystemPublicConfig {
  siteName: string;
  siteDescription?: string;
  logo?: string;
  /** 首页 Hero 文案 */
  heroTitle?: string;
  heroSubtitle?: string;
  navigation: NavigationPosition;
  theme: ThemeConfig;
  /** 是否启用 AI 工具入口（本阶段仅占位） */
  aiEnabled?: boolean;
}
