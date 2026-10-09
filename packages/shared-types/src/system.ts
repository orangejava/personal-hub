/**
 * 系统配置类型
 */

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** 导航栏位置 */
export type NavigationPosition = 'top' | 'left' | 'right';

/** 页头 Logo / 浏览器图标用文字还是图片。 */
export type SiteBrandMode = 'text' | 'image';

/** 作品矩阵中可配置视觉资产的固定端。 */
export const PROJECT_SHOWCASE_KEYS = [
  'user-web',
  'admin-web',
  'server',
  'flutter',
  'desktop',
] as const;

export type ProjectShowcaseKey = (typeof PROJECT_SHOWCASE_KEYS)[number];

/** 后台写入的项目视觉资产：只保存文件 ID。 */
export interface ProjectVisualAssetConfig {
  key: ProjectShowcaseKey;
  coverFileId: string | null;
  screenshotFileIds: string[];
}

/** 公开端消费的项目视觉资产：服务端已把文件 ID 转成短期签名 URL。 */
export interface PublicProjectVisualAsset {
  key: ProjectShowcaseKey;
  coverUrl: string | null;
  screenshotUrls: string[];
}

/** 主题配置，前端启动时注入 Ant Design ConfigProvider */
export interface ThemeConfig {
  colorPrimary: string;
  colorSuccess?: string;
  colorWarning?: string;
  colorError?: string;
  colorSecondary?: string;
  colorAccent?: string;
  borderRadius?: number;
  fontFamily?: string;
  mode: ThemeMode;
  allowUserSwitch?: boolean;
}

/** 公开导航的完整运行时配置；`navigation` 保留旧位置字段以兼容既有页面。 */
export interface PublicNavigationConfig {
  publicPosition: NavigationPosition;
  publicSticky: boolean;
  publicBlur: boolean;
  publicShowLogo: boolean;
  publicShowAuthEntry: boolean;
}

/** 关于我页配置（对应 Nest `site.about`） */
export interface SiteAboutConfig {
  title: string;
  markdown: string;
}

/** 内容中心与项目页布局（对应 Nest `site.layout`） */
export interface SiteLayoutConfig {
  homeHeroStyle: 'split' | 'center' | 'minimal';
  contentCardStyle: 'cover' | 'compact';
  contentReaderWidth: 'narrow' | 'comfortable' | 'wide';
  showBreadcrumb: boolean;
  projectsTitle?: string;
  projectsIntro?: string;
}

/** 后台 `site.layout` 配置，额外保存项目图片的文件 ID。 */
export interface AdminSiteLayoutConfig extends SiteLayoutConfig {
  projectVisualAssets: ProjectVisualAssetConfig[];
}

/** 站点公开系统配置 */
export interface SystemPublicConfig {
  siteName: string;
  siteDescription?: string;
  /** SEO keywords。空字符串表示不输出 meta。 */
  keywords?: string;
  /** 未上传或选择文字时不使用 logo。 */
  logo?: string;
  logoMode?: SiteBrandMode;
  /** 文字 Logo。空字符串表示用站点名称。 */
  logoText?: string;
  /** 已签名的 favicon 地址。文字模式或空图时由前台另画图标。 */
  faviconUrl?: string | null;
  faviconMode?: SiteBrandMode;
  /** 文字图标，最多 2 个字。空字符串表示用站点名称的第一个字。 */
  faviconText?: string;
  /** 首页 Hero 文案 */
  heroTitle?: string;
  heroSubtitle?: string;
  navigation: NavigationPosition;
  navigationConfig?: PublicNavigationConfig;
  theme: ThemeConfig;
  /** 是否启用 AI 工具入口（本阶段仅占位） */
  aiEnabled?: boolean;
  about?: SiteAboutConfig;
  layout?: SiteLayoutConfig;
  projectVisualAssets?: PublicProjectVisualAsset[];
}
