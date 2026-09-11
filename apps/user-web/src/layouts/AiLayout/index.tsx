import type {
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
  LogoutOutlined,
  SettingOutlined,
  PlusOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { history, Link, useLocation, useModel } from '@umijs/max';
import { Avatar, Button, Drawer, Popover, Space, Tag, Tooltip } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { AiXProvider } from '@/components/ai-x';
import ThemeRuntimeSync from '@/components/ThemeRuntimeSync';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { buildLoginPath } from '@/utils/loginPath';
import { loginOut } from '@/utils/loginOut';
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
        collapseOnClick: true,
      },
      {
        path: '/ai/webui',
        label: 'WebUI',
        icon: <AppstoreOutlined />,
        toolCode: 'webui',
        collapseOnClick: true,
      },
      {
        path: '/ai/comfyui',
        label: 'ComfyUI',
        icon: <DeploymentUnitOutlined />,
        toolCode: 'comfyui',
        collapseOnClick: true,
      },
      {
        path: '/ai/lora',
        label: '训练 LoRA',
        icon: <ExperimentOutlined />,
        toolCode: 'lora',
        collapseOnClick: true,
      },
      {
        path: '/ai/apps',
        label: 'AI 应用',
        icon: <AppstoreOutlined />,
        toolCode: 'apps',
        collapseOnClick: true,
      },
    ],
  },
  { path: '/ai/assets', label: '资产', icon: <FolderOutlined /> },
  { path: '/ai/profile', label: '个人中心', icon: <UserOutlined />, dividerBefore: true },
  { path: '/ai/team', label: '创建团队', icon: <TeamOutlined /> },
  { path: '/ai/creation-center', label: '创作中心', icon: <AppstoreOutlined /> },
  { path: '/ai/membership', label: '会员中心', icon: <CrownOutlined /> },
  { path: '/ai/publish', label: '发布', icon: <SendOutlined /> },
  { path: '/ai/tutorials', label: '教程', icon: <FileTextOutlined /> },
  { path: '/ai/api', label: 'API', icon: <ApiOutlined /> },
];

interface AiNavigationProps {
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
      const toolConfig = getToolConfig(tools, child.toolCode);
      const status = toolConfig?.status;
      const unavailable = status === 'comingSoon' || status === 'disabled';
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
          <span>{child.label}</span>
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
  collapsed = false,
  selectedPath,
  tools,
  onNavigate,
  onCollapseRequest,
}) => (
  <nav className="ph-ai-sidebar-nav" aria-label="AI 工作台导航">
    {navItems.map((item) => {
      const itemActive =
        selectedPath === item.path ||
        item.children?.some((child) => selectedPath === child.path);
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
            className={[
              'ph-ai-nav-link',
              itemActive && !item.children ? 'ph-ai-nav-link-active' : '',
              item.children ? 'ph-ai-nav-link-parent' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            to={item.children ? item.children[0]?.path ?? '/ai' : item.path}
            onClick={(event) => {
              if (item.children && !collapsed) {
                event.preventDefault();
                return;
              }
              onNavigate?.();
            }}
          >
            {item.icon}
            <span className="ph-ai-nav-label">{item.label}</span>
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
          <Tooltip key={item.path} placement="right" title={item.label}>
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
}

const AiUserPopover: React.FC<AiUserPopoverProps> = ({ quotaText }) => {
  const { initialState, setInitialState } = useModel('@@initialState');
  const user = initialState?.currentUser;

  if (!user) {
    return (
      <Link to={buildLoginPath()}>
        <Button type="primary">登录</Button>
      </Link>
    );
  }

  const displayName = user.nickname ?? user.email;
  const card = (
    <div className="ph-ai-user-card">
      <div className="ph-ai-user-card-header">
        <Avatar size={52} src={user.avatar} icon={<UserOutlined />} />
        <div>
          <strong>{displayName}</strong>
          <span>
            UUID
            <CopyOutlined />
          </span>
        </div>
        <Button icon={<PlusOutlined />} type="text">
          创建团队
        </Button>
      </div>
      <div className="ph-ai-user-card-plan">
        <div className="ph-ai-user-card-plan-head">
          <strong>免费用户</strong>
          <Button type="primary">开通会员</Button>
        </div>
        <span>活动权益：Seedream 4.5 限时5折 有效期 1天</span>
      </div>
      <div className="ph-ai-user-card-quota">
        <div>
          <strong>积分余额 {quotaText}</strong>
          <span>通用 {quotaText}</span>
        </div>
        <Space separator={<span className="ph-ai-user-card-split" />}>
          <Link to="/ai/membership">充值</Link>
          <Link to="/ai/membership">设置消耗顺序</Link>
        </Space>
      </div>
      <div className="ph-ai-user-card-metrics">
        <div>
          <span>训练加速余额</span>
          <strong>0 次</strong>
        </div>
        <div>
          <span>存储空间</span>
          <strong>0.0G <small>/3G</small></strong>
        </div>
      </div>
      <div className="ph-ai-user-card-actions">
        <Link to="/ai/profile">
          <UserOutlined />
          个人中心
        </Link>
        <Link to="/workspace/profile">
          <SettingOutlined />
          账号设置
        </Link>
        <button
          type="button"
          onClick={() => {
            void loginOut(setInitialState);
          }}
        >
          <LogoutOutlined />
          退出登录
        </button>
      </div>
    </div>
  );

  return (
    <Popover
      arrow={false}
      content={card}
      classNames={{ root: 'ph-ai-user-popover' }}
      placement="bottomRight"
      trigger={['hover', 'click']}
    >
      <Button className="ph-ai-user-trigger" type="text">
        <Avatar size={28} src={user.avatar} icon={<UserOutlined />} />
        <span>{displayName}</span>
      </Button>
    </Popover>
  );
};

/**
 * AI 独立工作台布局。
 *
 * 该布局只服务 `/ai/*`，不复用公开前台 PublicLayout，
 * 避免阶段 5 的侧边栏、顶部工具条和输入区影响既有页面。
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

  const selectedPath = useMemo(() => {
    const pathname = location.pathname;
    const flatItems = navItems.flatMap((item) => item.children ?? [item]);
    return (
      flatItems.find((item) =>
        item.path === '/ai' ? pathname === '/ai' : pathname.startsWith(item.path),
      )?.path ?? '/ai'
    );
  }, [location.pathname]);
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
              <Tag color="blue">Mock</Tag>
              <span>AI 工作台</span>
            </Space>
            <Space size={12}>
              <Link to="/">
                <Button aria-label="返回首页" icon={<HomeOutlined />} type="text">
                  首页
                </Button>
              </Link>
              <Tag color="green">{resolvedQuotaText}</Tag>
              <AiUserPopover quotaText={resolvedQuotaText} />
            </Space>
          </header>
          <section className="ph-ai-content">{children}</section>
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
