import { useModel } from '@umijs/max';
import type { CSSProperties } from 'react';
import { usePublicTheme } from '@/hooks/usePublicTheme';

const FALLBACK_COLORS = {
  primary: '#722ed1',
  secondary: '#14B8A6',
  accent: '#F97316',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
};

/** 性能面板跟站点深浅色走，不再单独记一套主题。 */
export function usePerfAppearance() {
  const { initialState } = useModel('@@initialState');
  const { isDark } = usePublicTheme();
  const theme = initialState?.systemConfig?.theme;

  return {
    dark: isDark,
    themeStyle: {
      '--ph-perf-primary': theme?.colorPrimary || FALLBACK_COLORS.primary,
      '--ph-perf-secondary': theme?.colorSecondary || FALLBACK_COLORS.secondary,
      '--ph-perf-accent': theme?.colorAccent || FALLBACK_COLORS.accent,
      '--ph-perf-success': theme?.colorSuccess || FALLBACK_COLORS.success,
      '--ph-perf-warning': theme?.colorWarning || FALLBACK_COLORS.warning,
      '--ph-perf-error': theme?.colorError || FALLBACK_COLORS.error,
    } as CSSProperties,
  };
}
