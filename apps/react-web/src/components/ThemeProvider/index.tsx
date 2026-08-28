import { history } from '@umijs/max';
import { ConfigProvider, theme } from 'antd';
import React, { useEffect, useState } from 'react';
import { publicDefaultSettings } from '@/config/publicDefaultSettings';
import {
  getPublicThemeSettings,
  getWorkspaceThemeSettings,
  subscribeThemeRuntime,
} from '@/utils/themeRuntime';

type Region = 'public' | 'workspace' | 'admin';

function getRegion(pathname: string): Region {
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/admin')) return 'admin';
  // /user 登录注册与公开前台共用主题，不跟工作区
  return 'public';
}

function resolveTheme(pathname: string) {
  const region = getRegion(pathname);
  const publicSettings = getPublicThemeSettings();
  const workspaceSettings = getWorkspaceThemeSettings();
  const isPublic = region === 'public';
  const navTheme = isPublic
    ? publicSettings.navTheme
    : workspaceSettings.navTheme;
  const isDark = navTheme === 'realDark';
  const colorPrimary = isPublic
    ? publicSettings.colorPrimary
    : (workspaceSettings.colorPrimary ?? publicSettings.colorPrimary);

  return { isDark, colorPrimary };
}

/**
 * 根级主题：须在 rootContainer 使用，不可调用 useLocation / useModel
 */
const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [pathname, setPathname] = useState(() => history.location.pathname);
  const [, bump] = useState(0);

  useEffect(
    () => history.listen(({ location }) => setPathname(location.pathname)),
    [],
  );

  useEffect(() => subscribeThemeRuntime(() => bump((n) => n + 1)), []);

  const { isDark, colorPrimary } = resolveTheme(pathname);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: colorPrimary ?? publicDefaultSettings.colorPrimary,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
};

export default ThemeProvider;
