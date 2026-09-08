import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { MenuItem } from '@personal-hub/shared-types';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import { Button, message } from 'antd';
import React from 'react';
import { ErrorBoundary, Footer } from '@/components';
import { AvatarDropdown } from '@/components/RightContent/AvatarDropdown';
import { LangDropdown } from '@/components/RightContent/LangDropdown';
import { ThemeSettingButton } from '@/components/RightContent/ThemeSettingButton';
import { PageTransition } from '@/components/shared';
import ThemeProvider from '@/components/ThemeProvider';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import {
  buildUserWebLoginUrl,
  getUserWebOrigin,
} from '@personal-hub/app-origins';
import { fetchCurrentUser, fetchPermissions, nestHttpStatus } from '@/services/auth';
import { fetchPublicConfig } from '@/services/system';
import type { InitialState } from '@/types/app';
import { getThemePreference } from '@/utils/clientPreferences';
import { ensureActiveLocale } from '@/utils/locale';
import { localizeMenu } from '@/utils/localizeMenu';
import { withMenuIcons } from '@/utils/menuIcons';
import { resolveMenuSelectedKey } from '@/utils/menuSelection';
import { bootstrapThemeRuntime } from '@/utils/themeRuntime';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

const isDev = process.env.NODE_ENV === 'development';

/** 只展示 Nest / mock 菜单里的后台子树 */
function pickAdminMenu(menu: MenuItem[] | undefined): MenuItem[] {
  if (!menu) return [];
  const ad = menu.find((m) => m.path === '/admin');
  return ad?.children ?? menu.filter((m) => m.path.startsWith('/admin'));
}

/**
 * 启动期恢复会话：Access Token 在内存，跨应用跳转后必须靠 Refresh Cookie 换票。
 */
export async function getInitialState(): Promise<InitialState> {
  ensureActiveLocale();

  const fetchUserInfo = async (): Promise<{
    user: InitialState['currentUser'];
    restoreFailed: boolean;
  }> => {
    try {
      // 启动拉取失败不能弹 toast，否则未登录进后台会刷「未登录」。
      const user = await fetchCurrentUser({ skipErrorHandler: true });
      return { user, restoreFailed: false };
    } catch (error: unknown) {
      if (nestHttpStatus(error) === 401) {
        return { user: undefined, restoreFailed: false };
      }
      return { user: undefined, restoreFailed: true };
    }
  };

  const state: InitialState = {
    settings: defaultSettings as Partial<LayoutSettings>,
    workspaceSettingDrawerOpen: false,
  };
  bootstrapThemeRuntime(state);

  try {
    const sys = await fetchPublicConfig();
    if (sys) {
      state.systemConfig = sys;
      if (sys.theme) {
        const navTheme = sys.theme.mode === 'dark' ? 'realDark' : 'light';
        const colorPrimary = sys.theme.colorPrimary;
        state.settings = {
          ...state.settings,
          navTheme,
          ...(colorPrimary ? { colorPrimary } : {}),
        };
      }
    }
  } catch {
    // 系统配置失败不阻塞后台
  }

  const localTheme = getThemePreference();
  if (localTheme) {
    state.settings = {
      ...state.settings,
      navTheme: localTheme.navTheme,
      colorPrimary: localTheme.colorPrimary,
    };
  }
  bootstrapThemeRuntime(state);

  const { user: currentUser, restoreFailed } = await fetchUserInfo();
  if (restoreFailed) {
    state.sessionRestoreFailed = true;
    message.error('无法恢复登录态，当前登录可能仍有效，请稍后刷新');
  }
  if (currentUser) {
    state.currentUser = currentUser;
    try {
      const perm = await fetchPermissions();
      if (perm) {
        state.permissions = perm.permissions;
        state.permissionGrants = perm.permissionGrants;
        state.menu = perm.menu;
        state.currentUser = {
          ...currentUser,
          permissions: perm.permissions,
        };
      }
    } catch {
      // 权限拉取失败不阻塞
    }
    if (currentUser.mustChangePassword) {
      window.location.replace(
        `${getUserWebOrigin()}/user/change-password?redirect=${encodeURIComponent(window.location.href)}`,
      );
    }
  }
  return state;
}

export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  const menuData = localizeMenu(
    withMenuIcons(pickAdminMenu(initialState?.menu)),
  );
  const {
    layout: _omitLayout,
    navTheme,
    collapsed: _omitSettingsCollapsed,
    ...restSettings
  } = (initialState?.settings ?? {}) as Record<string, unknown>;
  const selectedMenuKey = resolveMenuSelectedKey(
    history.location.pathname,
    menuData,
  );

  return {
    title: initialState?.systemConfig?.siteName ?? 'Personal Hub 管理台',
    logo: false,
    layout: 'mix',
    navTheme: (navTheme as 'light' | 'realDark' | undefined) ?? 'light',
    splitMenus: false,
    menuHeaderRender: undefined,
    headerContentRender: false,
    menuDataRender: () => menuData,
    menuProps: {
      selectedKeys: [selectedMenuKey],
    },
    menuItemRender: (item, dom) =>
      item.path ? (
        <Link to={item.path} prefetch>
          {dom}
        </Link>
      ) : (
        dom
      ),
    actionsRender: () => [
      <Button
        key="user-web"
        type="link"
        onClick={() => {
          window.location.href = getUserWebOrigin();
        }}
      >
        返回前台
      </Button>,
      <LangDropdown key="lang" />,
      <ThemeSettingButton key="theme" />,
    ],
    avatarProps: {
      render: () => <AvatarDropdown />,
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      if (initialState?.sessionRestoreFailed) {
        return;
      }
      if (!initialState?.currentUser) {
        window.location.replace(buildUserWebLoginUrl(window.location.href));
      }
    },
    ErrorBoundary,
    childrenRender: (children) => (
      <>
        <ThemeRuntimeSync />
        <PageTransition routeKey={history.location.pathname}>
          {children}
        </PageTransition>
        <SettingDrawer
          disableUrlParams
          enableDarkTheme
          collapse={initialState?.workspaceSettingDrawerOpen}
          onCollapseChange={(open) =>
            setInitialState((s) => ({ ...s, workspaceSettingDrawerOpen: open }))
          }
          settings={initialState?.settings}
          onSettingChange={(settings) =>
            setInitialState((s) => ({ ...s, settings }))
          }
        />
      </>
    ),
    ...restSettings,
    // 必须放在 settings 展开之后，避免被覆盖回默认的 /admin 首页。
    onMenuHeaderClick: () => {
      window.location.href = getUserWebOrigin();
    },
  };
};

export const request: RequestConfig = {
  baseURL: isDev ? '' : '/api',
  ...errorConfig,
};

export function rootContainer(container: React.ReactNode) {
  return (
    <ErrorBoundary>
      <ThemeProvider>{container}</ThemeProvider>
    </ErrorBoundary>
  );
}
