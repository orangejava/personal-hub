import { App, ConfigProvider, theme } from 'antd';
import React, { useEffect, useState } from 'react';
import { publicDefaultSettings } from '@/config/publicDefaultSettings';
import { DEFAULT_TABLE_PAGINATION } from '@/constants/tablePagination';
import {
  getWorkspaceThemeSettings,
  subscribeThemeRuntime,
} from '@/utils/themeRuntime';

function resolveTheme() {
  const workspaceSettings = getWorkspaceThemeSettings();
  const isDark = workspaceSettings.navTheme === 'realDark';
  const colorPrimary =
    workspaceSettings.colorPrimary ?? publicDefaultSettings.colorPrimary;
  return { isDark, colorPrimary };
}

/**
 * 管理端根级主题：只跟工作区/后台 Pro 设置，不走公开前台变量。
 */
const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [, bump] = useState(0);

  useEffect(() => subscribeThemeRuntime(() => bump((n) => n + 1)), []);

  const { isDark, colorPrimary } = resolveTheme();

  return (
    <ConfigProvider
      pagination={DEFAULT_TABLE_PAGINATION}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary,
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
};

export default ThemeProvider;
