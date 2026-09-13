import {
  ApiOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  GiftOutlined,
  SendOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link, history, useLocation, useModel } from '@umijs/max';
import { Alert, Button, Card, List, Space, Statistic, Tag } from 'antd';
import React, { useMemo, useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { AiPageHeader } from '@/components/ai';
import { buildAdminWebUrl } from '@personal-hub/app-origins';
import AiLayout from '@/layouts/AiLayout';
import {
  fetchAiCreationCenter,
  fetchAiMembership,
  fetchAiProfileSummary,
  fetchAiPublishDrafts,
  fetchAiTutorials,
  isLoggedIn,
} from '@/services/ai';

interface AiPlaceholderToolProps {
  title?: string;
}

interface PlaceholderConfig {
  title: string;
  description: string;
  statusLabel: string;
  statusColor: string;
  icon: React.ReactNode;
  capabilities: string[];
  backendNeeds: string[];
  nextActions: Array<{ label: string; to: string }>;
  metricLabel: string;
  metricValue: string | number;
  /** 无真实业务模型的入口只展示禁用说明，不提供伪成功操作。 */
  unavailable?: boolean;
}

const placeholderConfigMap: Record<string, PlaceholderConfig> = {
  '/ai/profile': {
    title: '个人中心',
    description: '汇总账号套餐、额度、会话和资产数量，数据来自 Nest 权益与任务表。',
    statusLabel: '已接入',
    statusColor: 'blue',
    icon: <UserOutlined />,
    capabilities: ['账号资料概览', '额度摘要', '会话与资产统计'],
    backendNeeds: ['偏好接口后置', '收藏模板后置'],
    nextActions: [
      { label: '查看会员中心', to: '/ai/membership' },
      { label: '查看用量', to: '/workspace/usage' },
    ],
    metricLabel: '任务数',
    metricValue: '-',
  },
  '/ai/creation-center': {
    title: '创作中心',
    description: '汇总生成任务、资产和内容草稿数量，最近任务来自后端生成历史。',
    statusLabel: '已接入',
    statusColor: 'purple',
    icon: <AppstoreOutlined />,
    capabilities: ['任务数量', '草稿数量', '最近生成任务'],
    backendNeeds: ['跨工具继续编辑后置'],
    nextActions: [
      { label: '查看最近创作', to: '/ai' },
      { label: '管理 AI 资产', to: '/ai/assets' },
    ],
    metricLabel: '任务队列',
    metricValue: '-',
  },
  '/ai/team': {
    title: '创建团队',
    description: '团队空间尚未开放，导航可配置为禁用或即将上线，本页不提供假保存。',
    statusLabel: '暂未开放',
    statusColor: 'default',
    icon: <TeamOutlined />,
    capabilities: ['团队成员管理', '共享资产空间', '团队用量统计'],
    backendNeeds: ['团队模型', '成员权限', '团队资产归属'],
    nextActions: [
      { label: '进入个人中心', to: '/ai/profile' },
      { label: '管理 AI 资产', to: '/ai/assets' },
    ],
    metricLabel: '团队能力',
    metricValue: 0,
    unavailable: true,
  },
  '/ai/invite': {
    title: '邀请有礼',
    description: '邀请奖励尚未实现，本页只说明后续能力，不会写入假领取记录。',
    statusLabel: '暂未开放',
    statusColor: 'default',
    icon: <GiftOutlined />,
    capabilities: ['邀请码展示', '奖励 Token 记录', '好友完成任务进度'],
    backendNeeds: ['邀请关系接口', '奖励发放流水', '防刷校验规则'],
    nextActions: [
      { label: '查看会员中心', to: '/ai/membership' },
      { label: '查看会员权益', to: '/ai/membership' },
    ],
    metricLabel: '奖励规则',
    metricValue: 0,
    unavailable: true,
  },
  '/ai/publish': {
    title: '发布',
    description: '读取当前用户内容草稿列表；完整发布审核仍走工作区内容流程。',
    statusLabel: '已接入草稿',
    statusColor: 'cyan',
    icon: <SendOutlined />,
    capabilities: ['查看内容草稿', '跳转工作区编辑', '后续接资产转内容'],
    backendNeeds: ['资产转内容接口', '发布审核状态', '外部渠道配置'],
    nextActions: [
      { label: '选择 AI 资产', to: '/ai/assets' },
      { label: '新建内容', to: '/workspace/content/new' },
    ],
    metricLabel: '草稿',
    metricValue: '-',
  },
  '/ai/tutorials': {
    title: '教程',
    description: '展示服务端返回的入门说明，帮助理解对话、图片和额度结算。',
    statusLabel: '已接入',
    statusColor: 'green',
    icon: <FileTextOutlined />,
    capabilities: ['新手教程', '工具入口说明', '额度预占说明'],
    backendNeeds: ['阅读进度后置', '教程与工具关联后置'],
    nextActions: [
      { label: '进入 AI 首页', to: '/ai' },
      { label: '浏览内容中心', to: '/content' },
    ],
    metricLabel: '教程主题',
    metricValue: '-',
  },
  '/ai/api': {
    title: 'API',
    description: '开放 API 控制台尚未实现，本页只展示禁用说明。',
    statusLabel: '暂未开放',
    statusColor: 'default',
    icon: <ApiOutlined />,
    capabilities: ['API Key 管理', '调用统计', '模型与工具接口文档'],
    backendNeeds: ['Key 签发与脱敏', '调用限流', '审计日志'],
    nextActions: [
      { label: '查看 AI 配置', to: '/admin/ai/config' },
      { label: '查看 AI 统计', to: '/admin/ai/stats' },
    ],
    metricLabel: '预留接口',
    metricValue: 0,
    unavailable: true,
  },
  '/ai/webui': {
    title: 'WebUI',
    description: '专业绘图工作台尚未接入执行后端，状态由 AI 导航配置控制。',
    statusLabel: '即将上线',
    statusColor: 'default',
    icon: <AppstoreOutlined />,
    capabilities: ['模型 checkpoint 选择', '图生图参数', '历史批量任务'],
    backendNeeds: ['绘图任务队列', '模型资源管理', '生成文件存储'],
    nextActions: [
      { label: '先用图片生成', to: '/ai/image' },
      { label: '管理生成资产', to: '/ai/assets' },
    ],
    metricLabel: '工作台模块',
    metricValue: 0,
    unavailable: true,
  },
  '/ai/comfyui': {
    title: 'ComfyUI',
    description: '节点式工作流尚未接入执行平台，本页不创建空接口。',
    statusLabel: '即将上线',
    statusColor: 'default',
    icon: <DeploymentUnitOutlined />,
    capabilities: ['节点工作流列表', '工作流参数表单', '任务运行状态'],
    backendNeeds: ['ComfyUI 代理服务', '工作流 JSON 存储', '任务进度推送'],
    nextActions: [
      { label: '进入图片生成', to: '/ai/image' },
      { label: '查看教程', to: '/ai/tutorials' },
    ],
    metricLabel: '预留节点',
    metricValue: 0,
    unavailable: true,
  },
  '/ai/lora': {
    title: 'LoRA 训练',
    description: '个人风格训练尚未开放，导航可配置为即将上线或隐藏。',
    statusLabel: '即将上线',
    statusColor: 'default',
    icon: <ExperimentOutlined />,
    capabilities: ['训练素材集', '训练参数', '模型版本管理'],
    backendNeeds: ['训练任务调度', '素材审核与存储', '模型文件管理'],
    nextActions: [
      { label: '整理素材资产', to: '/ai/assets' },
      { label: '查看会员权益', to: '/ai/membership' },
    ],
    metricLabel: '训练阶段',
    metricValue: 0,
    unavailable: true,
  },
  '/ai/apps': {
    title: 'AI 应用',
    description: '应用广场尚未实现运行记录，本页只保留入口说明。',
    statusLabel: '即将上线',
    statusColor: 'default',
    icon: <AppstoreOutlined />,
    capabilities: ['常用工作流', '模板应用', '自定义应用配置'],
    backendNeeds: ['应用配置模型', '参数 schema', '运行记录'],
    nextActions: [
      { label: '使用推荐模板', to: '/ai' },
      { label: '进入文本生成', to: '/ai/text' },
    ],
    metricLabel: '应用类型',
    metricValue: 0,
    unavailable: true,
  },
};

const fallbackConfig: PlaceholderConfig = {
  title: '功能即将上线',
  description: '该入口尚未接入业务能力，状态以后台 AI 导航为准。',
  statusLabel: '待接入',
  statusColor: 'default',
  icon: <AppstoreOutlined />,
  capabilities: ['工具说明', '状态展示'],
  backendNeeds: ['业务接口', '权限校验', '数据持久化'],
  nextActions: [{ label: '返回 AI 首页', to: '/ai' }],
  metricLabel: '预留能力',
  metricValue: 0,
  unavailable: true,
};

function navStatusLabel(status?: string, visible?: boolean) {
  if (visible === false) return { text: '已隐藏', color: 'default' };
  if (status === 'comingSoon') return { text: '即将上线', color: 'warning' };
  if (status === 'disabled') return { text: '暂不可用', color: 'default' };
  if (status === 'enabled') return { text: '已启用', color: 'success' };
  return undefined;
}

const AiPlaceholderTool: React.FC<AiPlaceholderToolProps> = ({ title }) => {
  const location = useLocation();
  const config = useMemo(
    () => placeholderConfigMap[location.pathname] ?? fallbackConfig,
    [location.pathname],
  );
  const resolvedTitle = title ?? config.title;
  const loggedIn = isLoggedIn();
  const { navigation } = useModel('ai');
  const { data: profile } = useRequest(fetchAiProfileSummary, {
    ready: loggedIn && location.pathname === '/ai/profile',
  });
  const { data: creation } = useRequest(fetchAiCreationCenter, {
    ready: loggedIn && location.pathname === '/ai/creation-center',
  });
  const { data: tutorials } = useRequest(fetchAiTutorials, {
    ready: location.pathname === '/ai/tutorials',
  });
  const { data: drafts } = useRequest(fetchAiPublishDrafts, {
    ready: loggedIn && location.pathname === '/ai/publish',
  });
  const [pendingAction, setPendingAction] = useState<string>();
  const currentNav = navigation?.find((item) => item.path === location.pathname);

  /**
   * 会员中心以后台导航 + GET /membership 为准。
   * 先等接口，409 时停在当前页，避免先跳过去再显示「暂不可用」。
   */
  const handleNextAction = async (to: string) => {
    if (to.startsWith('/admin')) {
      window.location.assign(buildAdminWebUrl(to));
      return;
    }
    if (to !== '/ai/membership') {
      history.push(to);
      return;
    }
    setPendingAction(to);
    try {
      await fetchAiMembership();
      history.push(to);
    } catch {
      // 409 / 其它失败由全局 errorHandler 提示
    } finally {
      setPendingAction(undefined);
    }
  };
  const status = navStatusLabel(currentNav?.status, currentNav?.visible) ?? {
    text: config.statusLabel,
    color: config.statusColor,
  };
  const metricValue =
    location.pathname === '/ai/profile'
      ? (profile?.jobCount ?? config.metricValue)
      : location.pathname === '/ai/creation-center'
        ? (creation?.jobCount ?? config.metricValue)
        : location.pathname === '/ai/tutorials'
          ? (tutorials?.list.length ?? config.metricValue)
          : location.pathname === '/ai/publish'
            ? (drafts?.total ?? config.metricValue)
            : config.metricValue;

  return (
    <AiLayout>
      <AiPageHeader
        description={config.description}
        title={resolvedTitle}
      />

      <div className="ph-ai-placeholder-shell">
        {config.unavailable ? (
          <Alert
            showIcon
            type="info"
            title="本能力尚未开放"
            description="后台可以把该入口设为隐藏、禁用或即将上线。页面不会保存上线提醒，也不提供伪成功操作。"
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Card className="ph-ai-placeholder-hero">
          <Space align="start" size={16}>
            <div className="ph-ai-placeholder-icon">{config.icon}</div>
            <div>
              <Space wrap>
                <Tag color={status.color}>{status.text}</Tag>
                {currentNav?.requiresLogin ? <Tag>需登录</Tag> : null}
              </Space>
              <h2>{resolvedTitle}</h2>
              <p>{config.description}</p>
              <Space wrap>
                {config.nextActions.map((action) => (
                  <Button
                    key={action.to + action.label}
                    loading={pendingAction === action.to}
                    onClick={() => {
                      void handleNextAction(action.to);
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </Space>
            </div>
          </Space>
        </Card>

        <div className="ph-ai-placeholder-grid">
          <Card title="当前数据">
            <Statistic title={config.metricLabel} value={metricValue} />
            {location.pathname === '/ai/profile' && profile ? (
              <div className="ph-ai-placeholder-list">
                <div className="ph-ai-placeholder-list-item">
                  <CheckCircleOutlined />
                  <span>套餐 {profile.currentPlanName}</span>
                </div>
                <div className="ph-ai-placeholder-list-item">
                  <CheckCircleOutlined />
                  <span>剩余 {profile.quota.remainingTokens.toLocaleString()} Token</span>
                </div>
                <div className="ph-ai-placeholder-list-item">
                  <CheckCircleOutlined />
                  <span>资产 {profile.assetCount} · 会话 {profile.sessionCount}</span>
                </div>
              </div>
            ) : location.pathname === '/ai/creation-center' && creation ? (
              <div className="ph-ai-placeholder-list">
                <div className="ph-ai-placeholder-list-item">
                  <CheckCircleOutlined />
                  <span>资产 {creation.assetCount} · 草稿 {creation.draftCount}</span>
                </div>
                {creation.recentJobs.slice(0, 5).map((job) => (
                  <div className="ph-ai-placeholder-list-item" key={job.id}>
                    <CheckCircleOutlined />
                    <span>{job.title || job.prompt || job.id}</span>
                  </div>
                ))}
              </div>
            ) : location.pathname === '/ai/tutorials' && tutorials ? (
              <List
                size="small"
                dataSource={tutorials.list}
                renderItem={(item) => (
                  <List.Item>
                    <Link to={item.path}>{item.title}</Link>
                  </List.Item>
                )}
              />
            ) : location.pathname === '/ai/publish' && drafts ? (
              <List
                size="small"
                dataSource={drafts.list}
                locale={{ emptyText: '暂无内容草稿' }}
                renderItem={(item) => (
                  <List.Item>
                    <Link to={item.path}>{item.title}</Link>
                  </List.Item>
                )}
              />
            ) : (
              <div className="ph-ai-placeholder-list">
                {config.capabilities.map((item) => (
                  <div className="ph-ai-placeholder-list-item" key={item}>
                    <CheckCircleOutlined />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="后续后端能力">
            <div className="ph-ai-placeholder-list">
              {config.backendNeeds.map((item) => (
                <div className="ph-ai-placeholder-list-item" key={item}>
                  <CheckCircleOutlined />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AiLayout>
  );
};

export default AiPlaceholderTool;
