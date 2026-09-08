import type {
  SiteAboutConfig,
  SiteLayoutConfig,
  SystemPublicConfig,
  ThemeConfig,
  ThemeMode,
} from '@personal-hub/shared-types';
import { readNestData, type NestEnvelope } from './http';

export interface NestPublicSiteConfig {
  siteName: string;
  siteDescription?: string;
  keywords?: string;
  logoFileId?: string | null;
  theme: {
    colorPrimary: string;
    colorSuccess?: string;
    colorWarning?: string;
    colorError?: string;
    borderRadius?: number;
    fontFamily?: string;
    mode: 'light' | 'dark' | 'auto';
    allowUserSwitch?: boolean;
  };
  homepage: {
    hero: {
      title: string;
      subtitle: string;
      primaryAction: { label: string; target: string };
      secondaryAction: { label: string; target: string };
    };
  };
  navigation: {
    publicPosition: 'top' | 'left' | 'right';
  };
  about?: SiteAboutConfig;
  layout?: SiteLayoutConfig;
  aiEnabled?: boolean;
}

/**
 * Canonical 嵌套公开配置 → 当前 React 仍使用的扁平 SystemPublicConfig。
 */
export function mapPublicSiteConfig(
  input: NestPublicSiteConfig | NestEnvelope<NestPublicSiteConfig>,
): SystemPublicConfig {
  const payload = readNestData(input);
  const themeIn = payload.theme;
  const mode: ThemeMode = themeIn?.mode ?? 'auto';
  const theme: ThemeConfig = {
    colorPrimary: themeIn?.colorPrimary ?? '#1677ff',
    colorSuccess: themeIn?.colorSuccess,
    colorWarning: themeIn?.colorWarning,
    colorError: themeIn?.colorError,
    borderRadius: themeIn?.borderRadius,
    fontFamily: themeIn?.fontFamily,
    mode,
  };
  const layoutIn = payload.layout;
  const layout: SiteLayoutConfig | undefined = layoutIn
    ? {
        homeHeroStyle: layoutIn.homeHeroStyle ?? 'split',
        contentCardStyle: layoutIn.contentCardStyle ?? 'cover',
        contentReaderWidth: layoutIn.contentReaderWidth ?? 'comfortable',
        showBreadcrumb: layoutIn.showBreadcrumb ?? true,
        projectsTitle: layoutIn.projectsTitle,
        projectsIntro: layoutIn.projectsIntro,
      }
    : undefined;
  const aboutIn = payload.about;
  const about: SiteAboutConfig | undefined = aboutIn
    ? {
        title: aboutIn.title ?? '关于我',
        markdown: aboutIn.markdown ?? '',
      }
    : undefined;
  return {
    siteName: payload.siteName,
    siteDescription: payload.siteDescription,
    heroTitle: payload.homepage?.hero?.title,
    heroSubtitle: payload.homepage?.hero?.subtitle,
    navigation: payload.navigation?.publicPosition ?? 'top',
    theme,
    aiEnabled: payload.aiEnabled,
    about,
    layout,
  };
}
