import { MenuOutlined } from '@ant-design/icons';
import type { MenuItem } from '@personal-hub/shared-types';
import { history, Link, useLocation, useModel } from '@umijs/max';
import { Button, Drawer } from 'antd';
import React, { useEffect, useState } from 'react';
import PublicThemeDrawer from '@/components/PublicThemeDrawer';
import PageTransition from '@/components/shared/PageTransition';
import PerfRouteMarker from '@/components/perf/PerfRouteMarker';
import PublicHeaderActions from '@/layouts/PublicHeaderActions';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import { publicDefaultSettings } from '@/config/publicDefaultSettings';
import { publicMenu } from '@/config/publicMenu';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { useViewportBand } from '@/hooks/useViewportBand';
import { setThemePreference } from '@/utils/clientPreferences';
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
  const location = useLocation();
  const { band, short } = useViewportBand();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const siteName = initialState?.systemConfig?.siteName ?? 'Personal Hub';

  // 顶栏只用公开导航；登录后 initialState.menu 含工作区，不能混进前台
  const menu: MenuItem[] = (initialState?.publicMenu ?? publicMenu).filter(
    (m) => !m.path.startsWith('/workspace') && !m.path.startsWith('/admin'),
  );
  const displayMenu = menu;
  // 平板和矮屏优先使用 Drawer，避免顶栏链接被压缩或横向滚动挤占内容高度。
  const compactNavigation = band !== 'desktop' || short;

  const firstSegment = location.pathname.split('/')[1];
  const activeKey = firstSegment ? `/${firstSegment}` : '/';

  // 路由切换后关闭移动端菜单，避免 Drawer 残留在下一页上方。
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!compactNavigation) setMobileMenuOpen(false);
  }, [compactNavigation]);

  return (
    <div
      className={
        isDark ? 'ph-public-layout ph-public-dark' : 'ph-public-layout'
      }
      style={{ ['--ph-color-primary' as string]: publicSettings.colorPrimary }}
    >
      <ThemeRuntimeSync />
      <header className="ph-public-header">
        <Button
          type="text"
          className={
            compactNavigation
              ? 'ph-public-mobile-menu-button ph-public-mobile-menu-button-visible'
              : 'ph-public-mobile-menu-button'
          }
          aria-label="打开公开导航"
          icon={<MenuOutlined />}
          onClick={() => setMobileMenuOpen(true)}
        />
        <Link to="/" className="ph-public-logo">
          {siteName}
        </Link>
        <nav
          className={
            compactNavigation ? 'ph-public-nav ph-public-nav-compact' : 'ph-public-nav'
          }
        >
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
        <PublicHeaderActions
          onOpenThemeSettings={() =>
            setInitialState((s) => ({ ...s, publicSettingDrawerOpen: true }))
          }
        />
      </header>
      <main
        className={fullWidth ? 'ph-public-main-full' : 'ph-container'}
        style={fullWidth ? undefined : { padding: 'var(--ph-page-padding)' }}
      >
        <PageTransition
          routeKey={getPageTransitionKey(history.location.pathname)}
        >
          <PerfRouteMarker>{children}</PerfRouteMarker>
        </PageTransition>
      </main>
      {/* 紧凑视口统一使用 Drawer，路由切换时由上面的 effect 关闭。 */}
      {compactNavigation && (
        <Drawer
          className="ph-public-mobile-drawer"
          title={siteName}
          placement="left"
          size={280}
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          destroyOnHidden
        >
          <nav className="ph-public-mobile-nav" aria-label="公开导航">
            {displayMenu.map((m) => (
              <Link
                key={m.path}
                to={m.path}
                className={activeKey === m.path ? 'active' : undefined}
                onClick={() => setMobileMenuOpen(false)}
              >
                {m.name}
              </Link>
            ))}
          </nav>
        </Drawer>
      )}
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
