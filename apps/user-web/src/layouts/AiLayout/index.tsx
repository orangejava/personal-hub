import type {
  AiNavigationItem,
  AiTool,
  AiToolStatus,
  AiToolType,
} from '@personal-hub/shared-types';
import {
  ApiOutlined,
  AppstoreOutlined,
  CrownOutlined,
  FileTextOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  PictureOutlined,
  RobotOutlined,
  ExperimentOutlined,
  DeploymentUnitOutlined,
  SendOutlined,
  UserOutlined,
  VideoCameraOutlined,
  FolderOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { history, Link, useLocation, useModel } from '@umijs/max';
import { Button, Drawer, Popover, Space, Tag, Tooltip } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { AiXProvider } from '@/components/ai-x';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import UserAccountPopover from '@/components/shared/UserAccountPopover';
import { useRequest } from '@/hooks/useRequest';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { fetchAiNavigation } from '@/services/ai';
import '@/styles/ai-layout.less';
import '@/styles/ai-components.less';
import '@/styles/ai-motion.less';

interface AiLayoutProps {
  brandName?: string;
  quotaText?: string;
  children: React.ReactNode;
}

interface AiNavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  toolCode?: AiToolType;
  navStatus?: AiToolStatus;
  children?: AiNavItem[];
  collapseOnClick?: boolean;
  dividerBefore?: boolean;
}

const navItems: AiNavItem[] = [
  { path: '/ai', label: '首页', icon: <HomeOutlined /> },
  {
    path: '/ai/create',
    label: '创作',
    icon: <DeploymentUnitOutlined />,
    children: [
      {
        path: '/ai/chat',
        label: 'AI 对话',
        icon: <RobotOutlined />,
        toolCode: 'chat',
        collapseOnClick: true,
      },
      {
        path: '/ai/text',
        label: '文本生成',
        icon: <FileTextOutlined />,
        toolCode: 'text',
        collapseOnClick: true,
      },
      {
        path: '/ai/image',
        label: '图片生成',
        icon: <PictureOutlined />,
        toolCode: 'image',
        collapseOnClick: true,
      },
      {
        path: '/ai/video',
        label: '视频生成',
        icon: <VideoCameraOutlined />,
        toolCode: 'video',
        navStatus: 'comingSoon',
        collapseOnClick: true,
      },
      {
        path: '/ai/webui',
        label: 'WebUI',
        icon: <AppstoreOutlined />,
        toolCode: 'webui',
        navStatus: 'comingSoon',
        collapseOnClick: true,
      },
      {
        path: '/ai/comfyui',
        label: 'ComfyUI',
        icon: <DeploymentUnitOutlined />,
        toolCode: 'comfyui',
        navStatus: 'comingSoon',
        collapseOnClick: true,
      },
      {
        path: '/ai/lora',
        label: '训练 LoRA',
        icon: <ExperimentOutlined />,
        toolCode: 'lora',
        navStatus: 'comingSoon',
        collapseOnClick: true,
      },
      {
        path: '/ai/apps',
        label: 'AI 应用',
        icon: <AppstoreOutlined />,
        toolCode: 'apps',
        navStatus: 'comingSoon',
        collapseOnClick: true,
      },
    ],
  },
  { path: '/ai/assets', label: '资产', icon: <FolderOutlined /> },
  { path: '/ai/profile', label: '个人中心', icon: <UserOutlined />, dividerBefore: true },
  { path: '/ai/team', label: '创建团队', icon: <TeamOutlined />, navStatus: 'disabled' },
  { path: '/ai/creation-center', label: '创作中心', icon: <AppstoreOutlined /> },
  { path: '/ai/membership', label: '会员中心', icon: <CrownOutlined /> },
  { path: '/ai/publish', label: '发布', icon: <SendOutlined /> },
  { path: '/ai/tutorials', label: '教程', icon: <FileTextOutlined /> },
  { path: '/ai/api', label: 'API', icon: <ApiOutlined />, navStatus: 'disabled' },
];

const iconByName: Record<string, React.ReactNode> = {
  home: <HomeOutlined />,
  robot: <RobotOutlined />,
  edit: <FileTextOutlined />,
  picture: <PictureOutlined />,
  videoCamera: <VideoCameraOutlined />,
  appstore: <AppstoreOutlined />,
  deployment: <DeploymentUnitOutlined />,
  experiment: <ExperimentOutlined />,
  folder: <FolderOutlined />,
  user: <UserOutlined />,
  team: <TeamOutlined />,
  crown: <CrownOutlined />,
  send: <SendOutlined />,
  fileText: <FileTextOutlined />,
  api: <ApiOutlined />,
};

function buildNavItems(apiItems?: AiNavigationItem[]): AiNavItem[] {
  if (!apiItems?.length) {
    return navItems;
  }
  const childrenOf = (parentId: string | null) =>
    apiItems
      .filter((item) => (item.parentId ?? null) === parentId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  return childrenOf(null).map((item, index, list) => {
    const children = childrenOf(item.id).map((child) => ({
      path: child.path,
      label: child.label,
      icon: iconByName[child.icon] ?? <AppstoreOutlined />,
      toolCode: child.toolCode,
      navStatus: child.status,
      collapseOnClick: true,
    }));
    const previous = list[index - 1];
    return {
      path: item.path,
      label: item.label,
      icon: iconByName[item.icon] ?? <AppstoreOutlined />,
      toolCode: item.toolCode,
      navStatus: item.status,
      // 只在账号组第一项画分隔，避免个人中心/创建团队/创作中心各撑出一块空白。
      dividerBefore: item.group === 'profile' && previous?.group !== 'profile',
      children: children.length > 0 ? children : undefined,
    };
  });
}

interface AiNavigationProps {
  items: AiNavItem[];
  collapsed?: boolean;
  selectedPath: string;
  tools?: AiTool[];
  onNavigate?: () => void;
  onCollapseRequest?: () => void;
}

const toolStatusText: Record<Exclude<AiToolStatus, 'enabled'>, string> = {
  comingSoon: '即将上线',
  disabled: '暂不可用',
};

function getToolConfig(tools: AiTool[] | undefined, code: AiToolType | undefined) {
  if (!code) return undefined;
  return tools?.find((tool) => tool.code === code);
}

/** 导航表状态优先；绑定了 AiTool 时，工具禁用/即将上线会压过导航 ENABLED。 */
function resolveNavStatus(item: AiNavItem, tools?: AiTool[]): AiToolStatus | undefined {
  const toolStatus = getToolConfig(tools, item.toolCode)?.status;
  if (toolStatus && toolStatus !== 'enabled') {
    return toolStatus;
  }
  return item.navStatus;
}

function isUnavailableStatus(status?: AiToolStatus) {
  return status === 'comingSoon' || status === 'disabled';
}

function leafNavItems(items: AiNavItem[]): AiNavItem[] {
  return items.flatMap((item) => item.children ?? [item]);
}

function firstAvailableChild(item: AiNavItem, tools?: AiTool[]) {
  return item.children?.find(
    (child) => !isUnavailableStatus(resolveNavStatus(child, tools)),
  );
}

function handleTopNavClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  item: AiNavItem,
  collapsed: boolean,
  tools: AiTool[] | undefined,
  onNavigate?: () => void,
) {
  if (item.children) {
    if (!collapsed || !firstAvailableChild(item, tools)) {
      event.preventDefault();
      return;
    }
    onNavigate?.();
    return;
  }
  if (isUnavailableStatus(resolveNavStatus(item, tools))) {
    event.preventDefault();
    return;
  }
  onNavigate?.();
}

interface AiNavChildListProps {
  items: AiNavItem[];
  selectedPath: string;
  tools?: AiTool[];
  onNavigate?: () => void;
  onCollapseRequest?: () => void;
}

/** 创作类子页面链接，展开侧栏与折叠浮层共用，避免两套状态文案。 */
const AiNavChildList: React.FC<AiNavChildListProps> = ({
  items,
  selectedPath,
  tools,
  onNavigate,
  onCollapseRequest,
}) => (
  <>
    {items.map((child) => {
      const active = selectedPath === child.path;
      const status = resolveNavStatus(child, tools);
      const unavailable = isUnavailableStatus(status);
      const statusLabel =
        status && status !== 'enabled' ? toolStatusText[status] : undefined;
      return (
        <Link
          key={child.path}
          className={[
            'ph-ai-nav-child-link',
            active ? 'ph-ai-nav-child-link-active' : '',
            unavailable ? 'ph-ai-nav-link-disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          to={child.path}
          onClick={(event) => {
            if (unavailable) {
              event.preventDefault();
              return;
            }
            if (child.collapseOnClick) {
              onCollapseRequest?.();
            }
            onNavigate?.();
          }}
        >
          <span className="ph-ai-nav-label">{child.label}</span>
          {statusLabel && (
            <span className="ph-ai-nav-status">{statusLabel}</span>
          )}
        </Link>
      );
    })}
  </>
);

/**
 * AI 工作台导航列表。
 *
 * 桌面侧栏和移动端抽屉共用同一份导航渲染，避免后续新增工具入口时漏改某一端。
 */
const AiNavigation: React.FC<AiNavigationProps> = ({
  items,
  collapsed = false,
  selectedPath,
  tools,
  onNavigate,
  onCollapseRequest,
}) => (
  <nav className="ph-ai-sidebar-nav" aria-label="AI 工作台导航">
    {items.map((item) => {
      const itemActive =
        selectedPath === item.path ||
        item.children?.some((child) => selectedPath === child.path);
      const status = resolveNavStatus(item, tools);
      const unavailable =
        !item.children && isUnavailableStatus(status);
      const statusLabel =
        unavailable && status && status !== 'enabled'
          ? toolStatusText[status]
          : undefined;
      const targetPath = item.children
        ? firstAvailableChild(item, tools)?.path ?? item.path
        : item.path;
      const itemNode = (
        <div
          className={[
            'ph-ai-nav-group',
            item.dividerBefore ? 'ph-ai-nav-group-divided' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          key={item.path}
        >
          <Link
            aria-disabled={unavailable || undefined}
            className={[
              'ph-ai-nav-link',
              itemActive && !item.children ? 'ph-ai-nav-link-active' : '',
              item.children ? 'ph-ai-nav-link-parent' : '',
              unavailable ? 'ph-ai-nav-link-disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            to={targetPath}
            onClick={(event) =>
              handleTopNavClick(event, item, collapsed, tools, onNavigate)
            }
          >
            {item.icon}
            <span className="ph-ai-nav-label">{item.label}</span>
            {statusLabel && (
              <span className="ph-ai-nav-status">{statusLabel}</span>
            )}
            {item.children && !collapsed && (
              <MenuFoldOutlined className="ph-ai-nav-parent-arrow" />
            )}
          </Link>
          {item.children && !collapsed && (
            <div className="ph-ai-nav-children">
              <AiNavChildList
                items={item.children}
                selectedPath={selectedPath}
                tools={tools}
                onNavigate={onNavigate}
                onCollapseRequest={onCollapseRequest}
              />
            </div>
          )}
        </div>
      );

      if (collapsed && item.children) {
        return (
          <Popover
            key={item.path}
            arrow={false}
            content={
              <div className="ph-ai-nav-flyout">
                <AiNavChildList
                  items={item.children}
                  selectedPath={selectedPath}
                  tools={tools}
                  onNavigate={onNavigate}
                  onCollapseRequest={onCollapseRequest}
                />
              </div>
            }
            classNames={{ root: 'ph-ai-nav-flyout-popover' }}
            mouseEnterDelay={0.08}
            placement="rightTop"
            trigger={['hover']}
          >
            <div>{itemNode}</div>
          </Popover>
        );
      }

      if (!item.children && collapsed) {
        return (
          <Tooltip
            key={item.path}
            placement="right"
            title={statusLabel ? `${item.label}（${statusLabel}）` : item.label}
          >
            <div>{itemNode}</div>
          </Tooltip>
        );
      }

      return itemNode;
    })}
  </nav>
);

interface AiUserPopoverProps {
  quotaText: string;
  planName?: string;
}

const AiUserPopover: React.FC<AiUserPopoverProps> = ({ quotaText, planName }) => (
  <UserAccountPopover
    planName={planName}
    quotaText={quotaText}
    triggerClassName="ph-ai-user-trigger"
    variant="ai"
  />
);

const AiUnavailableNotice: React.FC<{
  label: string;
  status?: AiToolStatus;
}> = ({ label, status }) => {
  const statusLabel =
    status && status !== 'enabled' ? toolStatusText[status] : '暂不可用';
  return (
    <div className="ph-ai-unavailable">
      <h2>{label}</h2>
      <p>{statusLabel}，后台恢复启用后即可进入。</p>
    </div>
  );
};

/**
 * AI 独立工作台布局。
 *
 * 该布局只服务 `/ai/*`，不复用公开前台 PublicLayout，
 * 避免 AI 侧边栏、顶部工具条和输入区影响既有页面。
 */
const AiLayout: React.FC<AiLayoutProps> = ({
  brandName,
  quotaText,
  children,
}) => {
  const location = useLocation();
  const { initialState } = useModel('@@initialState');
  const { colorPrimary, isDark } = usePublicTheme();
  const { runtimeConfig, loadHomeConfig } = useModel('ai');
  const { data: navigation } = useRequest(fetchAiNavigation, {
    refreshOnWindowFocus: true,
  });
  const resolvedNavItems = useMemo(() => buildNavItems(navigation), [navigation]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (runtimeConfig.quota && runtimeConfig.tools) return;
    loadHomeConfig();
  }, [loadHomeConfig, runtimeConfig.quota, runtimeConfig.tools]);

  // layout: false 时 ProLayout 的 onPageChange 不执行；客户端在 /ai 内跳转也要拦。
  useEffect(() => {
    if (initialState?.currentUser?.mustChangePassword) {
      history.replace('/user/change-password');
    }
  }, [initialState?.currentUser?.mustChangePassword]);

  const resolvedBrandName = brandName ?? runtimeConfig.brandName;
  const resolvedQuotaText =
    quotaText ??
    (runtimeConfig.quota
      ? `${runtimeConfig.quota.remainingTokens.toLocaleString()} Token`
      : '加载中');

  const currentLeaf = useMemo(() => {
    const pathname = location.pathname;
    return leafNavItems(resolvedNavItems).find((item) =>
      item.path === '/ai' ? pathname === '/ai' : pathname.startsWith(item.path),
    );
  }, [location.pathname, resolvedNavItems]);
  const selectedPath = currentLeaf?.path ?? '/ai';
  const currentNavStatus = currentLeaf
    ? resolveNavStatus(currentLeaf, runtimeConfig.tools)
    : undefined;
  const pageUnavailable = isUnavailableStatus(currentNavStatus);
  const autoCollapsedPaths = [
    '/ai/chat',
    '/ai/text',
    '/ai/image',
    '/ai/video',
    '/ai/webui',
    '/ai/comfyui',
    '/ai/lora',
    '/ai/apps',
  ];
  const isFocusedWorkspace = autoCollapsedPaths.some((path) =>
    location.pathname.startsWith(path),
  );

  useEffect(() => {
    if (autoCollapsedPaths.some((path) => location.pathname.startsWith(path))) {
      setCollapsed(true);
    }
  }, [location.pathname]);

  return (
    <AiXProvider>
      <div
        className={[
          'ph-public-layout',
          'ph-ai-layout',
          isDark ? 'ph-public-dark' : '',
          collapsed ? 'ph-ai-layout-collapsed' : '',
          isFocusedWorkspace ? 'ph-ai-layout-focused' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ ['--ph-color-primary' as string]: colorPrimary }}
      >
        <ThemeRuntimeSync />
        <aside className="ph-ai-sidebar">
          <div className="ph-ai-sidebar-header">
            <Link className="ph-ai-brand-link" to="/">
              <RobotOutlined />
              <span className="ph-ai-brand">{resolvedBrandName}</span>
            </Link>
            <Button
              aria-label={collapsed ? '展开 AI 侧边栏' : '折叠 AI 侧边栏'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              size="small"
              type="text"
              onClick={() => setCollapsed((value) => !value)}
            />
          </div>

          <AiNavigation
            collapsed={collapsed}
            items={resolvedNavItems}
            selectedPath={selectedPath}
            tools={runtimeConfig.tools}
            onCollapseRequest={() => setCollapsed(true)}
          />
        </aside>

        <main className="ph-ai-main">
          <header className="ph-ai-topbar">
            <Space size={12}>
              <Button
                aria-label="打开 AI 导航"
                className="ph-ai-mobile-menu-button"
                icon={<MenuOutlined />}
                type="text"
                onClick={() => setMobileDrawerOpen(true)}
              />
              <Tag color="blue">工作台</Tag>
              <span>AI 工作台</span>
            </Space>
            <Space size={12}>
              <Link to="/">
                <Button aria-label="返回首页" icon={<HomeOutlined />} type="text">
                  首页
                </Button>
              </Link>
              <Tag color="green">{resolvedQuotaText}</Tag>
              <AiUserPopover
                planName={runtimeConfig.currentPlanName}
                quotaText={resolvedQuotaText}
              />
            </Space>
          </header>
          <section className="ph-ai-content">
            {pageUnavailable && currentLeaf ? (
              <AiUnavailableNotice
                label={currentLeaf.label}
                status={currentNavStatus}
              />
            ) : (
              children
            )}
          </section>
        </main>

        <Drawer
          className="ph-ai-mobile-drawer"
          destroyOnHidden={false}
          open={mobileDrawerOpen}
          placement="left"
          size={300}
          title={
            <Space size={8}>
              <RobotOutlined />
              <span>{resolvedBrandName}</span>
            </Space>
          }
          onClose={() => setMobileDrawerOpen(false)}
        >
          <AiNavigation
            items={resolvedNavItems}
            selectedPath={selectedPath}
            tools={runtimeConfig.tools}
            onNavigate={() => setMobileDrawerOpen(false)}
            onCollapseRequest={() => setCollapsed(true)}
          />
        </Drawer>
      </div>
    </AiXProvider>
  );
};

export default AiLayout;
