import { useModel } from '@umijs/max';
import { publicDefaultSettings } from '@/config/publicDefaultSettings';

/**
 * 公开前台主题上下文：布局与子组件统一读取，避免暗色模式下半套 token
 */
export function usePublicTheme() {
  const { initialState } = useModel('@@initialState');
  const settings = initialState?.publicSettings ?? publicDefaultSettings;
  const isDark = settings.navTheme === 'realDark';

  return {
    settings,
    isDark,
    colorPrimary: settings.colorPrimary,
    menuTheme: isDark ? ('dark' as const) : ('light' as const),
  };
}
