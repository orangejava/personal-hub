import { SettingOutlined } from '@ant-design/icons';
import type { MenuItem } from '@personal-hub/shared-types';
import { history, Link, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Avatar, Button, Dropdown } from 'antd';
import React from 'react';
import PublicThemeDrawer from '@/components/PublicThemeDrawer';
import { PageTransition } from '@/components/shared';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import { publicDefaultSettings } from '@/config/publicDefaultSettings';
import { publicMenu } from '@/config/publicMenu';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { loginOut } from '@/utils/loginOut';
import { localizeMenu } from '@/utils/localizeMenu';

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

  // 顶栏仅展示公开导航项；登录后 full menu 含工作区/后台，需过滤
  const basePublicMenu = user
    ? (initialState?.menu ?? publicMenu)
    : publicMenu;
  const menu: MenuItem[] = basePublicMenu.filter(
    (m) => !m.path.startsWith('/workspace') && !m.path.startsWith('/admin'),
  );
  const displayMenu = localizeMenu(menu);

  const firstSegment = history.location.pathname.split('/')[1];
  const activeKey = firstSegment ? `/${firstSegment}` : '/';

  const isAdmin = user?.role === 'admin';

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
              ? [{ key: 'admin', label: <Link to="/admin/dashboard">后台管理</Link> }]
              : []),
            { key: 'logout', label: '退出登录' },
          ]
        : [{ key: 'login', label: <Link to="/user/login">登录</Link> }]),
    ],
    onClick: ({ key }) => {
      if (key === 'logout') loginOut();
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
        <PageTransition routeKey={history.location.pathname}>
          {children}
        </PageTransition>
      </main>
      <PublicThemeDrawer
        open={!!initialState?.publicSettingDrawerOpen}
        settings={publicSettings ?? publicDefaultSettings}
        onClose={() =>
          setInitialState((s) => ({ ...s, publicSettingDrawerOpen: false }))
        }
        onChange={(next) =>
          setInitialState((s) => ({ ...s, publicSettings: next }))
        }
      />
    </div>
  );
};

export default PublicLayout;
