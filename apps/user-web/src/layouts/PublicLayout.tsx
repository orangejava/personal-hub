import { MenuOutlined } from '@ant-design/icons';
import type { MenuItem } from '@personal-hub/shared-types';
import { history, Link, useLocation, useModel } from '@umijs/max';
import { Button, Drawer } from 'antd';
import React, { useEffect, useState } from 'react';
import PublicThemeDrawer from '@/components/PublicThemeDrawer';
import { PageTransition } from '@/components/shared';
import PublicHeaderActions from '@/layouts/PublicHeaderActions';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import { publicDefaultSettings } from '@/config/publicDefaultSettings';
import { publicMenu } from '@/config/publicMenu';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { useViewportBand } from '@/hooks/useViewportBand';
import { setThemePreference } from '@/utils/clientPreferences';
import { getPageTransitionKey } from '@/utils/pageTransitionKey';
import { hideClosedAiMenu, isPublicReaderPath } from '@/layouts/publicNav';

function PublicBrand({
  siteName,
  logoUrl,
  logoMode,
  logoText,
}: {
  siteName: string;
  logoUrl?: string;
  logoMode: 'text' | 'image';
  logoText?: string;
}) {
  const text = logoText?.trim() || siteName;
  const showImage = logoMode === 'image' && !!logoUrl;
  return (
    <Link to="/" className="ph-public-logo">
      {showImage ? <img alt={siteName} className="ph-public-logo-image" src={logoUrl} /> : text}
    </Link>
  );
}

function PublicNavLinks({
  menu,
  activeKey,
  className,
  onNavigate,
}: {
  menu: MenuItem[];
  activeKey: string;
  className: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className={className} aria-label="公开导航">
      {menu.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={activeKey === item.path ? 'active' : undefined}
          onClick={onNavigate}
        >
          {/* 公开导航固定渲染接口 name，不用 localizeMenu，避免英文环境变成 Home */}
          {item.name}
        </Link>
      ))}
    </nav>
  );
}

/**
 * 公开前台布局：顶栏或左右侧栏 + 内容区
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
  const logoUrl = initialState?.systemConfig?.logo || undefined;
  // 旧页面还没带模式时：有签名地址就显示图片，否则显示站点名称。
  const logoMode =
    initialState?.systemConfig?.logoMode ?? (logoUrl ? 'image' : 'text');
  const logoText = initialState?.systemConfig?.logoText;
  const showThemeButton = initialState?.systemConfig?.theme.allowUserSwitch !== false;
  const configuredPosition =
    initialState?.systemConfig?.navigationConfig?.publicPosition ??
    initialState?.systemConfig?.navigation ??
    'top';

  // 顶栏只用公开导航；登录后 initialState.menu 含工作区，不能混进前台
  const menu = hideClosedAiMenu(
    (initialState?.publicMenu ?? publicMenu).filter(
      (item) => !item.path.startsWith('/workspace') && !item.path.startsWith('/admin'),
    ),
    initialState?.systemConfig?.aiEnabled,
  );
  // 平板、矮屏和阅读页优先使用 Drawer，侧栏配置不占内容宽度。
  const compactNavigation = band !== 'desktop' || short || isPublicReaderPath(location.pathname);
  const sidePosition =
    !compactNavigation && (configuredPosition === 'left' || configuredPosition === 'right')
      ? configuredPosition
      : null;

  const firstSegment = location.pathname.split('/')[1];
  const activeKey = firstSegment ? `/${firstSegment}` : '/';

  const openThemeSettings = () => {
    setInitialState((state) => ({ ...state, publicSettingDrawerOpen: true }));
  };

  // 路由切换后关闭移动端菜单，避免 Drawer 残留在下一页上方。
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!compactNavigation) setMobileMenuOpen(false);
  }, [compactNavigation]);

  const main = (
    <main
      className={fullWidth ? 'ph-public-main-full' : 'ph-container'}
      style={fullWidth ? undefined : { padding: 'var(--ph-page-padding)' }}
    >
      <PageTransition routeKey={getPageTransitionKey(history.location.pathname)}>
        {children}
      </PageTransition>
    </main>
  );

  const themeDrawer = (
    <PublicThemeDrawer
      open={!!initialState?.publicSettingDrawerOpen}
      settings={publicSettings ?? publicDefaultSettings}
      onClose={() =>
        setInitialState((state) => ({ ...state, publicSettingDrawerOpen: false }))
      }
      onChange={(next) => {
        setThemePreference(next);
        setInitialState((state) => ({ ...state, publicSettings: next }));
      }}
    />
  );

  return (
    <div
      className={[
        isDark ? 'ph-public-layout ph-public-dark' : 'ph-public-layout',
        sidePosition ? `ph-public-layout-side ph-public-layout-side-${sidePosition}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--ph-color-primary' as string]: publicSettings.colorPrimary }}
    >
      <ThemeRuntimeSync />
      {sidePosition ? (
        <aside className="ph-public-sider">
          <div className="ph-public-sider-brand">
            <PublicBrand
              logoMode={logoMode}
              logoText={logoText}
              logoUrl={logoUrl}
              siteName={siteName}
            />
          </div>
          <PublicNavLinks menu={menu} activeKey={activeKey} className="ph-public-sider-nav" />
          <PublicHeaderActions
            showThemeButton={showThemeButton}
            onOpenThemeSettings={openThemeSettings}
          />
        </aside>
      ) : (
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
          <PublicBrand
            logoMode={logoMode}
            logoText={logoText}
            logoUrl={logoUrl}
            siteName={siteName}
          />
          <PublicNavLinks
            menu={menu}
            activeKey={activeKey}
            className={compactNavigation ? 'ph-public-nav ph-public-nav-compact' : 'ph-public-nav'}
          />
          <PublicHeaderActions
            showThemeButton={showThemeButton}
            onOpenThemeSettings={openThemeSettings}
          />
        </header>
      )}
      {sidePosition ? <div className="ph-public-side-main">{main}</div> : main}
      {/* 紧凑视口和阅读页统一使用 Drawer，路由切换时由上面的 effect 关闭。 */}
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
          <PublicNavLinks
            menu={menu}
            activeKey={activeKey}
            className="ph-public-mobile-nav"
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </Drawer>
      )}
      {themeDrawer}
    </div>
  );
};

export default PublicLayout;
