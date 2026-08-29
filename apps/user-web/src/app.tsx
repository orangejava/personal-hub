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
import { publicDefaultSettings } from '@/config/publicDefaultSettings';
import { publicMenu } from '@/config/publicMenu';
import { buildAdminWebUrl } from '@personal-hub/app-origins';
import { fetchCurrentUser, fetchPermissions, nestHttpStatus } from '@/services/auth';
import { fetchPublicConfig } from '@/services/system';
import type { InitialState } from '@/types/app';
import { getThemePreference } from '@/utils/clientPreferences';
import { localizeMenu } from '@/utils/localizeMenu';
import { withMenuIcons } from '@/utils/menuIcons';
import { resolveMenuSelectedKey } from '@/utils/menuSelection';
import { bootstrapThemeRuntime } from '@/utils/themeRuntime';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

const isDev = process.env.NODE_ENV === 'development';
const loginPath = '/user/login';
const changePasswordPath = '/user/change-password';
const authPublicPaths = [
  loginPath,
  '/user/register',
  '/user/register-result',
  '/user/verify-email',
  '/user/forgot-password',
  '/user/reset-password',
  changePasswordPath,
];

/** 根据当前路径判断所处布局区域 */
function getRegion(pathname: string): 'public' | 'workspace' {
  if (pathname.startsWith('/workspace')) return 'workspace';
  return 'public';
}

/** 从完整菜单中取出当前区域应展示的菜单 */
function pickMenu(
  menu: MenuItem[] | undefined,
  region: 'public' | 'workspace',
): MenuItem[] {
  if (!menu) return [];
  if (region === 'public') {
    return menu.filter(
      (m) => !m.path.startsWith('/workspace') && !m.path.startsWith('/admin'),
    );
  }
  const ws = menu.find((m) => m.path === '/workspace');
  return ws?.children ?? [];
}

/**
 * @name 全局初始状态
 * 启动期拉取当前用户、权限菜单、系统配置，写入 @@initialState 供全应用共享
 */
export async function getInitialState(): Promise<InitialState> {
  const fetchUserInfo = async (): Promise<{
    user: InitialState['currentUser'];
    restoreFailed: boolean;
  }> => {
    try {
      const res = await fetchCurrentUser({ skipErrorHandler: true });
      return { user: res?.data, restoreFailed: false };
    } catch (error: unknown) {
      if (nestHttpStatus(error) === 401) {
        return { user: undefined, restoreFailed: false };
      }
      return { user: undefined, restoreFailed: true };
    }
  };

  const state: InitialState = {
    settings: defaultSettings as Partial<LayoutSettings>,
    publicSettings: publicDefaultSettings,
    workspaceSettingDrawerOpen: false,
    publicSettingDrawerOpen: false,
    menu: publicMenu,
  };
  bootstrapThemeRuntime(state);

  // 公开系统配置和公开导航不依赖登录态，未登录首页/关于页也需要正常展示
  try {
    const sys = await fetchPublicConfig();
    if (sys?.code === 0) {
      state.systemConfig = sys.data;
      if (sys.data?.theme) {
        const navTheme = sys.data.theme.mode === 'dark' ? 'realDark' : 'light';
        const colorPrimary =
          sys.data.theme.colorPrimary ?? publicDefaultSettings.colorPrimary;
        state.publicSettings = { navTheme, colorPrimary };
        state.settings = {
          ...state.settings,
          navTheme,
          colorPrimary,
        };
      }
    }
  } catch (_e) {
    // 系统配置拉取失败不阻塞页面
  }

  // 用户本地主题覆盖站点默认，直到用户再次修改
  const localTheme = getThemePreference();
  if (localTheme) {
    state.publicSettings = localTheme;
    state.settings = {
      ...state.settings,
      navTheme: localTheme.navTheme,
      colorPrimary: localTheme.colorPrimary,
    };
  }
  bootstrapThemeRuntime(state);

  const { location } = history;
  // 登录 / 注册 / 验证页不拉用户信息；改密页需要恢复会话才能提交
  if (
    [
      loginPath,
      '/user/register',
      '/user/register-result',
      '/user/verify-email',
      '/user/forgot-password',
      '/user/reset-password',
    ].includes(location.pathname)
  ) {
    return state;
  }

  const { user: currentUser, restoreFailed } = await fetchUserInfo();
  if (restoreFailed) {
    state.sessionRestoreFailed = true;
    message.error('无法恢复登录态，当前登录可能仍有效，请稍后刷新');
  }
  if (currentUser) {
    state.currentUser = currentUser;
    try {
      const perm = await fetchPermissions();
      if (perm?.code === 0) {
        state.permissions = perm.data.permissions;
        state.permissionGrants = perm.data.permissionGrants;
        state.menu = perm.data.menu;
        state.currentUser = {
          ...currentUser,
          permissions: perm.data.permissions,
        };
      }
    } catch (_e) {
      // 权限拉取失败不阻塞
    }
    // /ai 使用 layout: false，ProLayout.onPageChange 不会跑；启动态统一拦到改密页。
    if (currentUser.mustChangePassword && location.pathname !== changePasswordPath) {
      history.replace(changePasswordPath);
    }
  }
  return state;
}

// ProLayout 运行时配置
export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  const region = getRegion(history.location.pathname);
  const menuData = localizeMenu(
    withMenuIcons(pickMenu(initialState?.menu, region)),
  );

  // 工作区用 mix 布局保留顶栏；关闭 splitMenus，避免一级菜单跑到顶部
  const layoutMode: 'side' | 'top' | 'mix' =
    region === 'public' ? 'top' : 'mix';

  // settings 里自带 layout: 'mix'，这里剔除后再用 layoutMode 覆盖，避免被还原
  const {
    layout: _omitLayout,
    navTheme,
    ...restSettings
  } = (initialState?.settings ?? {}) as Record<string, unknown>;

  const workspaceNavTheme =
    (navTheme as 'light' | 'realDark' | undefined) ?? 'light';

  const selectedMenuKey = resolveMenuSelectedKey(
    history.location.pathname,
    menuData,
  );

  return {
    title: initialState?.systemConfig?.siteName ?? 'Personal Hub',
    logo: false,
    layout: layoutMode,
    navTheme: workspaceNavTheme,
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
    // 拆成独立 action，避免三个按钮共享同一个 hover 容器
    actionsRender: () => [
      ...(initialState?.currentUser?.role === 'admin' ||
      initialState?.currentUser?.permissions?.includes('admin:access')
        ? [
            <Button
              key="admin"
              type="link"
              onClick={() => {
                window.location.href = buildAdminWebUrl();
              }}
            >
              后台管理
            </Button>,
          ]
        : []),
      <LangDropdown key="lang" />,
      <ThemeSettingButton key="theme" />,
    ],
    avatarProps: {
      render: () => <AvatarDropdown />,
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      if (authPublicPaths.includes(location.pathname)) {
        return;
      }
      if (!initialState?.currentUser) {
        if (initialState?.sessionRestoreFailed) {
          return;
        }
        history.replace(
          `${loginPath}?redirect=${encodeURIComponent(location.pathname + location.search + location.hash)}`,
        );
        return;
      }
      if (initialState.currentUser.mustChangePassword) {
        history.replace(changePasswordPath);
      }
    },
    ErrorBoundary,
    childrenRender: (children) => (
      <>
        <ThemeRuntimeSync />
        <PageTransition routeKey={history.location.pathname}>
          {children}
        </PageTransition>
        {/* 主题设置面板：触发按钮已移到顶栏右侧，这里隐藏其自带浮动把手 */}
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
