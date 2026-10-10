import { useModel } from '@umijs/max';
import React, { useEffect } from 'react';
import { setSiteHead, siteHeadFromConfig } from '@/utils/siteHead';
import {
  bootstrapThemeRuntime,
  setPublicThemeSettings,
  setWorkspaceThemeSettings,
} from '@/utils/themeRuntime';

/**
 * 在 Router / Model 上下文内，把 @@initialState 主题同步到 themeRuntime
 * 供 rootContainer 中的 ThemeProvider 订阅（不可在 rootContainer 内 useModel）
 */
const ThemeRuntimeSync: React.FC = () => {
  const { initialState } = useModel('@@initialState');

  useEffect(() => {
    if (!initialState) return;
    bootstrapThemeRuntime({
      publicSettings: initialState.publicSettings,
      settings: initialState.settings,
    });
  }, [initialState?.publicSettings, initialState?.settings]);

  useEffect(() => {
    if (initialState?.publicSettings) {
      setPublicThemeSettings(initialState.publicSettings);
    }
  }, [initialState?.publicSettings]);

  useEffect(() => {
    if (initialState?.settings) {
      setWorkspaceThemeSettings(initialState.settings);
    }
  }, [initialState?.settings]);

  useEffect(() => {
    setSiteHead(siteHeadFromConfig(initialState?.systemConfig));
  }, [initialState?.systemConfig]);

  return null;
};

export default ThemeRuntimeSync;
