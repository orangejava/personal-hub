import { SettingOutlined } from '@ant-design/icons';
import type { MenuItem } from '@personal-hub/shared-types';
import { history, Link, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Avatar, Button, Dropdown } from 'antd';
import React from 'react';
import PublicThemeDrawer from '@/components/PublicThemeDrawer';
import { PageTransition } from '@/components/shared';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import { buildAdminWebUrl } from '@personal-hub/app-origins';
import { publicDefaultSettings } from '@/config/publicDefaultSettings';
import { publicMenu } from '@/config/publicMenu';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { setThemePreference } from '@/utils/clientPreferences';
import { buildLoginPath } from '@/utils/loginPath';
import { loginOut } from '@/utils/loginOut';
import { getPageTransitionKey } from '@/utils/pageTransitionKey';

/**
 * 公开前台布局：顶栏 + 内容区
 * Ant Design token 由根级 ThemeProvider 注入；本布局负责 CSS 语义变量
 */
const PublicLayout: React.FC<{
  children: React.ReactNode;
  fullWidth?: boolean;
}> = ({ children, fullWidth = false }) => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const { settings: publicSettings, isDark } = usePublicTheme();
  const siteName = initialState?.systemConfig?.siteName ?? 'Personal Hub';
  const user = initialState?.currentUser;

  // 顶栏只用公开导航；登录后 initialState.menu 含工作区，不能混进前台
  const menu: MenuItem[] = (initialState?.publicMenu ?? publicMenu).filter(
    (m) => !m.path.startsWith('/workspace') && !m.path.startsWith('/admin'),
  );
  const displayMenu = menu;

  const firstSegment = history.location.pathname.split('/')[1];
  const activeKey = firstSegment ? `/${firstSegment}` : '/';

  const isAdmin =
    user?.role === 'admin' ||
    Boolean(user?.permissions?.includes('admin:access'));

  const userMenu: MenuProps = {
    items: [
      ...(user
        ? [
            {
              key: 'profile',
              label: <Link to="/workspace/profile">个人中心</Link>,
            },
            { key: 'workspace', label: <Link to="/workspace">工作区</Link> },
            ...(isAdmin
              ? [
                  {
                    key: 'admin',
                    label: (
                      <a href={buildAdminWebUrl()}>后台管理</a>
                    ),
                  },
                ]
              : []),
            { key: 'logout', label: '退出登录' },
          ]
        : [{ key: 'login', label: <Link to={buildLoginPath()}>登录</Link> }]),
    ],
    onClick: ({ key }) => {
      if (key === 'logout') {
        void loginOut(setInitialState);
      }
    },
  };

  return (
    <div
      className={
        isDark ? 'ph-public-layout ph-public-dark' : 'ph-public-layout'
      }
      style={{ ['--ph-color-primary' as string]: publicSettings.colorPrimary }}
    >
      <ThemeRuntimeSync />
      <header className="ph-public-header">
        <Link to="/" className="ph-public-logo">
          {siteName}
        </Link>
        <nav className="ph-public-nav">
          {displayMenu.map((m) => (
            <Link
              key={m.path}
              to={m.path}
              className={activeKey === m.path ? 'active' : undefined}
            >
              {/* 公开顶栏固定渲染接口 name，不用 localizeMenu，避免英文环境变成 Home */}
              {m.name}
            </Link>
          ))}
        </nav>
        <div className="ph-public-header-actions">
          <Button
            type="text"
            aria-label="主题设置"
            icon={<SettingOutlined />}
            onClick={() =>
              setInitialState((s) => ({ ...s, publicSettingDrawerOpen: true }))
            }
          />
          <Dropdown menu={userMenu} placement="bottomRight">
            <Avatar src={user?.avatar} style={{ cursor: 'pointer' }}>
              {user?.nickname?.[0] ?? '游客'}
            </Avatar>
          </Dropdown>
        </div>
      </header>
      <main
        className={fullWidth ? 'ph-public-main-full' : 'ph-container'}
        style={fullWidth ? undefined : { padding: 'var(--ph-page-padding)' }}
      >
        <PageTransition routeKey={getPageTransitionKey(history.location.pathname)}>
          {children}
        </PageTransition>
      </main>
      <PublicThemeDrawer
        open={!!initialState?.publicSettingDrawerOpen}
        settings={publicSettings ?? publicDefaultSettings}
        onClose={() =>
          setInitialState((s) => ({ ...s, publicSettingDrawerOpen: false }))
        }
        onChange={(next) => {
          setThemePreference(next);
          setInitialState((s) => ({ ...s, publicSettings: next }));
        }}
      />
    </div>
  );
};

export default PublicLayout;
