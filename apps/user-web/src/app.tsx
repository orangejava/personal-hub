import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { MenuItem } from '@personal-hub/shared-types';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import { Button, message } from 'antd';
import React from 'react';
import { ErrorBoundary, Footer } from '@/components';
import { AvatarDropdown } from '@/components/RightContent/AvatarDropdown';
import { ThemeSettingButton } from '@/components/RightContent/ThemeSettingButton';
import { PageTransition } from '@/components/shared';
import ThemeProvider from '@/components/ThemeProvider';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import { publicDefaultSettings } from '@/config/publicDefaultSettings';
import { publicMenu } from '@/config/publicMenu';
import { buildAdminWebUrl } from '@personal-hub/app-origins';
import { fetchCurrentUser, fetchPermissions, nestHttpStatus } from '@/services/auth';
import { fetchPublicConfig, fetchPublicNavigation } from '@/services/system';
import type { InitialState } from '@/types/app';
import { getThemePreference } from '@/utils/clientPreferences';
import { ensureActiveLocale } from '@/utils/locale';
import { localizeMenu } from '@/utils/localizeMenu';
import { withMenuIcons } from '@/utils/menuIcons';
import { resolveMenuSelectedKey } from '@/utils/menuSelection';
import { bootstrapThemeRuntime } from '@/utils/themeRuntime';
import { mapPublicNavigation } from '@/auth/routeRegistry';
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
const workspaceDirectCreationPaths = new Set([
  '/workspace/markdown',
  '/workspace/richtext',
  '/workspace/booklets',
]);

/** 递归过滤工作区菜单中的直接创建入口，兼容接口菜单与路由兜底菜单。 */
function filterWorkspaceDirectCreationMenus<
  T extends { path?: string; children?: T[] },
>(items: T[]): T[] {
  return items
    .filter((item) => !workspaceDirectCreationPaths.has(item.path ?? ''))
    .map((item) => ({
      ...item,
      children: item.children
        ? filterWorkspaceDirectCreationMenus(item.children)
        : undefined,
    }));
}

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
  // 统一由“新建内容”选择类型后进入编辑器，仍保留路由供已有草稿继续编辑。
  return filterWorkspaceDirectCreationMenus(ws?.children ?? []);
}

/** 仅两种在线编辑器需要临时移除工作区框架。 */
function isWorkspaceEditorPath(pathname: string): boolean {
  return (
    pathname.startsWith('/workspace/markdown') ||
    pathname.startsWith('/workspace/richtext')
  );
}

/**
 * @name 全局初始状态
 * 启动期拉取当前用户、权限菜单、系统配置，写入 @@initialState 供全应用共享
 */
export async function getInitialState(): Promise<InitialState> {
  ensureActiveLocale();
  const fetchUserInfo = async (): Promise<{
    user: InitialState['currentUser'];
    restoreFailed: boolean;
  }> => {
    try {
      // 启动拉取失败不能弹 toast，否则未登录进首页会刷「未登录」。
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
    publicSettings: publicDefaultSettings,
    workspaceSettingDrawerOpen: false,
    publicSettingDrawerOpen: false,
    menu: publicMenu,
    publicMenu,
  };
  bootstrapThemeRuntime(state);

  // 公开系统配置和公开导航不依赖登录态，未登录首页/关于页也需要正常展示
  try {
    const sys = await fetchPublicConfig();
    if (sys) {
      state.systemConfig = sys;
      if (sys.theme) {
        const navTheme = sys.theme.mode === 'dark' ? 'realDark' : 'light';
        const colorPrimary =
          sys.theme.colorPrimary ?? publicDefaultSettings.colorPrimary;
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

  try {
    const nav = await fetchPublicNavigation();
    if (nav?.length) {
      const mapped = mapPublicNavigation(nav);
      if (mapped.length > 0) {
        state.publicMenu = mapped;
      }
    }
  } catch (_e) {
    // 公开导航失败时继续使用写死的 publicMenu
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
      if (perm) {
        state.permissions = perm.permissions;
        state.permissionGrants = perm.permissionGrants;
        state.menu = perm.menu;
        state.currentUser = {
          ...currentUser,
          permissions: perm.permissions,
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
  const workspaceEditorRoute =
    region === 'workspace' &&
    isWorkspaceEditorPath(history.location.pathname);
  const workspaceEditorFullscreen =
    workspaceEditorRoute &&
    !!initialState?.workspaceEditorFullscreen;
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
    collapsed: _omitSettingsCollapsed,
    ...restSettings
  } = (initialState?.settings ?? {}) as Record<string, unknown>;

  const workspaceNavTheme =
    (navTheme as 'light' | 'realDark' | undefined) ?? 'light';

  // 编辑路由已从菜单中隐藏；仍归属于“文档管理”，否则 ProLayout 找不到激活项而收起 Content 菜单组。
  const selectedMenuKey = workspaceEditorRoute
    ? resolveMenuSelectedKey('/workspace/content', menuData)
    : resolveMenuSelectedKey(history.location.pathname, menuData);
  // 工作区仅有内容中心这一层目录菜单；首次进入默认展开，之后由用户点击结果接管。
  const workspaceMenuOpenKeys =
    initialState?.workspaceMenuOpenKeys ?? ['/workspace/content-center'];

  return {
    title: initialState?.systemConfig?.siteName ?? 'Personal Hub',
    logo: false,
    className: region === 'workspace' ? 'ph-workspace-pro-layout' : undefined,
    layout: layoutMode,
    navTheme: workspaceNavTheme,
    splitMenus: false,
    menuHeaderRender: undefined,
    headerRender: workspaceEditorFullscreen ? false : undefined,
    headerContentRender: workspaceEditorFullscreen ? false : false,
    menuRender: workspaceEditorFullscreen ? false : undefined,
    siderWidth: workspaceEditorFullscreen ? 0 : undefined,
    menuDataRender: (routeMenus) =>
      // 接口菜单还未恢复时，ProLayout 会提供路由生成的菜单；同样需要过滤。
      menuData.length > 0
        ? filterWorkspaceDirectCreationMenus(menuData)
        : filterWorkspaceDirectCreationMenus(routeMenus),
    menuProps: {
      selectedKeys: [selectedMenuKey],
      ...(region === 'workspace'
        ? {
            openKeys: workspaceMenuOpenKeys,
            onOpenChange: (openKeys) => {
              void setInitialState((state) => ({
                ...state,
                workspaceMenuOpenKeys: openKeys,
              }));
            },
          }
        : {}),
    },
    menuItemRender: (item, dom) => {
      // 兼容菜单接口未恢复时 ProLayout 的路由兜底菜单，避免隐藏规则被绕过。
      if (workspaceDirectCreationPaths.has(item.path ?? '')) {
        return null;
      }
      return item.path ? (
        <Link to={item.path} prefetch>
          {dom}
        </Link>
      ) : (
        dom
      );
    },
    // 拆成独立 action，避免三个按钮共享同一个 hover 容器
    actionsRender: () => [
      ...(region === 'workspace'
        ? [
            <Button
              key="public-home"
              type="link"
              onClick={() => {
                history.push('/');
              }}
            >
              返回前台
            </Button>,
          ]
        : []),
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
      <ThemeSettingButton key="theme" />,
    ],
    avatarProps: {
      render: () => <AvatarDropdown />,
    },
    footerRender: workspaceEditorFullscreen
      ? false
      : () => (
          <div className="ph-workspace-footer">
            <Footer />
          </div>
        ),
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
        <div
          className={
            workspaceEditorRoute
              ? 'ph-workspace-page-shell ph-workspace-editor-shell'
              : 'ph-workspace-page-shell'
          }
        >
          <PageTransition routeKey={history.location.pathname}>
            {children}
          </PageTransition>
        </div>
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
    // 侧栏折叠独立于菜单组 openKeys。全屏只隐藏框架，不能把折叠状态写死成 false。
    collapsed: workspaceEditorFullscreen
      ? false
      : Boolean(initialState?.workspaceSiderCollapsed),
    onCollapse: (collapsed) => {
      if (workspaceEditorFullscreen) {
        return;
      }
      void setInitialState((state) => ({
        ...state,
        workspaceSiderCollapsed: collapsed,
      }));
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
