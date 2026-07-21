import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { MenuItem } from '@personal-hub/shared-types';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import { Button } from 'antd';
import React from 'react';
import { ErrorBoundary, Footer } from '@/components';
import { PageTransition } from '@/components/shared';
import ThemeProvider from '@/components/ThemeProvider';
import { AvatarDropdown } from '@/components/RightContent/AvatarDropdown';
import { LangDropdown } from '@/components/RightContent/LangDropdown';
import { ThemeSettingButton } from '@/components/RightContent/ThemeSettingButton';
import { publicMenu } from '@/config/publicMenu';
import { fetchCurrentUser, fetchPermissions } from '@/services/auth';
import { fetchPublicConfig } from '@/services/system';
import type { InitialState } from '@/types/app';
import { withMenuIcons } from '@/utils/menuIcons';
import { localizeMenu } from '@/utils/localizeMenu';
import { resolveMenuSelectedKey } from '@/utils/menuSelection';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import { publicDefaultSettings } from '@/config/publicDefaultSettings';
import defaultSettings from '../config/defaultSettings';
import { bootstrapThemeRuntime } from '@/utils/themeRuntime';
import { errorConfig } from './requestErrorConfig';

const isDev = process.env.NODE_ENV === 'development';
const loginPath = '/user/login';

/** 根据当前路径判断所处布局区域 */
function getRegion(pathname: string): 'public' | 'workspace' | 'admin' {
  if (pathname.startsWith('/workspace')) return 'workspace';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'public';
}

/** 从完整菜单中取出当前区域应展示的菜单 */
function pickMenu(
  menu: MenuItem[] | undefined,
  region: 'public' | 'workspace' | 'admin',
): MenuItem[] {
  if (!menu) return [];
  if (region === 'public') {
    return menu.filter(
      (m) => !m.path.startsWith('/workspace') && !m.path.startsWith('/admin'),
    );
  }
  if (region === 'workspace') {
    const ws = menu.find((m) => m.path === '/workspace');
    return ws?.children ?? [];
  }
  const ad = menu.find((m) => m.path === '/admin');
  return ad?.children ?? [];
}

/**
 * @name 全局初始状态
 * 启动期拉取当前用户、权限菜单、系统配置，写入 @@initialState 供全应用共享
 */
export async function getInitialState(): Promise<InitialState> {
  const fetchUserInfo = async () => {
    try {
      const res = await fetchCurrentUser({ skipErrorHandler: true });
      return res?.data;
    } catch (_error) {
      return undefined;
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

  const { location } = history;
  // 登录相关页面不拉用户信息
  if (
    [loginPath, '/user/register', '/user/register-result'].includes(
      location.pathname,
    )
  ) {
    return state;
  }

  const currentUser = await fetchUserInfo();
  if (currentUser) {
    state.currentUser = currentUser;
    try {
      const perm = await fetchPermissions();
      if (perm?.code === 0) {
        state.permissions = perm.data.permissions;
        state.menu = perm.data.menu;
      }
    } catch (_e) {
      // 权限拉取失败不阻塞
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
  const menuData = localizeMenu(withMenuIcons(pickMenu(initialState?.menu, region)));

  // 工作区/后台用 mix 布局保留顶栏；关闭 splitMenus，避免一级菜单跑到顶部
  const layoutMode: 'side' | 'top' | 'mix' =
    region === 'public' ? 'top' : 'mix';

  // settings 里自带 layout: 'mix'，这里剔除后再用 layoutMode 覆盖，避免被还原
  const { layout: _omitLayout, navTheme, ...restSettings } = (initialState?.settings ??
    {}) as Record<string, unknown>;

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
      ...(initialState?.currentUser?.role === 'admin' && region !== 'admin'
        ? [
            <Link key="admin" to="/admin/dashboard">
              <Button type="link" icon={null}>
                后台管理
              </Button>
            </Link>,
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
      if (!initialState?.currentUser && location.pathname !== loginPath) {
        history.replace(
          `${loginPath}?redirect=${encodeURIComponent(location.pathname + location.search + location.hash)}`,
        );
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
