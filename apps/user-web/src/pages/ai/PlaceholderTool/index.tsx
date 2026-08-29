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
import { Link, useLocation } from '@umijs/max';
import { App, Button, Card, Space, Statistic, Tag } from 'antd';
import React, { useMemo, useState } from 'react';
import { AiPageHeader } from '@/components/ai';
import { buildAdminWebUrl } from '@personal-hub/app-origins';
import AiLayout from '@/layouts/AiLayout';

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
}

const placeholderConfigMap: Record<string, PlaceholderConfig> = {
  '/ai/profile': {
    title: '个人中心',
    description: '汇总账号、会员、用量和偏好设置，阶段 5 先展示 mock 能力入口。',
    statusLabel: 'Mock 规划中',
    statusColor: 'blue',
    icon: <UserOutlined />,
    capabilities: ['账号资料概览', 'AI 使用偏好', '常用模型与模板收藏'],
    backendNeeds: ['用户偏好接口', '收藏模板接口', '账号权益接口'],
    nextActions: [
      { label: '查看会员中心', to: '/ai/membership' },
      { label: '查看用量', to: '/workspace/usage' },
    ],
    metricLabel: '偏好项',
    metricValue: 6,
  },
  '/ai/creation-center': {
    title: '创作中心',
    description: '集中管理创作任务、草稿和待发布内容，后续承接图片、视频与文本工作流。',
    statusLabel: 'Mock 规划中',
    statusColor: 'purple',
    icon: <AppstoreOutlined />,
    capabilities: ['创作任务队列', '草稿管理', '跨工具继续编辑'],
    backendNeeds: ['任务分页接口', '草稿持久化', '任务状态推送'],
    nextActions: [
      { label: '查看最近创作', to: '/ai' },
      { label: '管理 AI 资产', to: '/ai/assets' },
    ],
    metricLabel: '预留队列',
    metricValue: 3,
  },
  '/ai/team': {
    title: '创建团队',
    description: '后续用于团队空间、成员协作和共享资产管理，阶段 5 先保留入口。',
    statusLabel: 'Mock 规划中',
    statusColor: 'blue',
    icon: <TeamOutlined />,
    capabilities: ['团队成员管理', '共享资产空间', '团队用量统计'],
    backendNeeds: ['团队模型', '成员权限', '团队资产归属'],
    nextActions: [
      { label: '进入个人中心', to: '/ai/profile' },
      { label: '管理 AI 资产', to: '/ai/assets' },
    ],
    metricLabel: '团队能力',
    metricValue: 3,
  },
  '/ai/invite': {
    title: '邀请有礼',
    description: '展示邀请奖励和 Token 赠送记录，阶段 5 复用会员 mock 数据的商业化方向。',
    statusLabel: 'Mock 规划中',
    statusColor: 'gold',
    icon: <GiftOutlined />,
    capabilities: ['邀请码展示', '奖励 Token 记录', '好友完成任务进度'],
    backendNeeds: ['邀请关系接口', '奖励发放流水', '防刷校验规则'],
    nextActions: [
      { label: '查看会员中心', to: '/ai/membership' },
      { label: '查看会员权益', to: '/ai/membership' },
    ],
    metricLabel: '奖励规则',
    metricValue: 2,
  },
  '/ai/publish': {
    title: '发布',
    description: '将 AI 生成结果发布到内容库、作品页或外部分发渠道，阶段 5 先保留流程入口。',
    statusLabel: '待接入',
    statusColor: 'cyan',
    icon: <SendOutlined />,
    capabilities: ['选择 AI 资产', '补充发布元信息', '生成内容库草稿'],
    backendNeeds: ['资产转内容接口', '发布审核状态', '外部渠道配置'],
    nextActions: [
      { label: '选择 AI 资产', to: '/ai/assets' },
      { label: '新建内容', to: '/workspace/content/new' },
    ],
    metricLabel: '发布渠道',
    metricValue: 3,
  },
  '/ai/tutorials': {
    title: '教程',
    description: '沉淀 AI 工具使用教程、模板案例和工作流说明，帮助用户理解每个工具入口。',
    statusLabel: 'Mock 规划中',
    statusColor: 'green',
    icon: <FileTextOutlined />,
    capabilities: ['新手教程', '模板案例', '工具参数说明'],
    backendNeeds: ['教程内容模型', '阅读进度', '教程与工具关联'],
    nextActions: [
      { label: '进入 AI 首页', to: '/ai' },
      { label: '浏览内容中心', to: '/content' },
    ],
    metricLabel: '教程主题',
    metricValue: 5,
  },
  '/ai/api': {
    title: 'API',
    description: '面向后续开放能力的 API 控制台，阶段 5 仅保留 mock 产品形态。',
    statusLabel: '待接入',
    statusColor: 'geekblue',
    icon: <ApiOutlined />,
    capabilities: ['API Key 管理', '调用统计', '模型与工具接口文档'],
    backendNeeds: ['Key 签发与脱敏', '调用限流', '审计日志'],
    nextActions: [
      { label: '查看 AI 配置', to: '/admin/ai/config' },
      { label: '查看 AI 统计', to: '/admin/ai/stats' },
    ],
    metricLabel: '预留接口',
    metricValue: 8,
  },
  '/ai/webui': {
    title: 'WebUI',
    description: '专业绘图工作台入口，后续用于接入独立绘图后端或工作流服务。',
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
    metricValue: 4,
  },
  '/ai/comfyui': {
    title: 'ComfyUI',
    description: '节点式工作流入口，阶段 5 只保留产品占位和后端依赖说明。',
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
    metricValue: 12,
  },
  '/ai/lora': {
    title: 'LoRA 训练',
    description: '个人风格模型训练入口，后续用于管理训练集、训练任务和模型产物。',
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
    metricValue: 4,
  },
  '/ai/apps': {
    title: 'AI 应用',
    description: '沉淀常用工作流和模板应用，阶段 5 先保留应用广场入口。',
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
    metricValue: 3,
  },
};

const fallbackConfig: PlaceholderConfig = {
  title: '功能即将上线',
  description: '阶段 5 先保留入口，后续接入真实工具能力。',
  statusLabel: '待接入',
  statusColor: 'default',
  icon: <AppstoreOutlined />,
  capabilities: ['工具说明', '状态展示', '上线提醒'],
  backendNeeds: ['业务接口', '权限校验', '数据持久化'],
  nextActions: [{ label: '返回 AI 首页', to: '/ai' }],
  metricLabel: '预留能力',
  metricValue: 3,
};

const AiPlaceholderTool: React.FC<AiPlaceholderToolProps> = ({ title }) => {
  const { message } = App.useApp();
  const location = useLocation();
  const [subscribed, setSubscribed] = useState(false);
  const config = useMemo(
    () => placeholderConfigMap[location.pathname] ?? fallbackConfig,
    [location.pathname],
  );
  const resolvedTitle = title ?? config.title;

  return (
    <AiLayout>
      <AiPageHeader
        description={config.description}
        title={resolvedTitle}
      />

      <div className="ph-ai-placeholder-shell">
        <Card className="ph-ai-placeholder-hero">
          <Space align="start" size={16}>
            <div className="ph-ai-placeholder-icon">{config.icon}</div>
            <div>
              <Space wrap>
                <Tag color={config.statusColor}>{config.statusLabel}</Tag>
                <Tag>阶段 5 mock</Tag>
              </Space>
              <h2>{resolvedTitle}</h2>
              <p>{config.description}</p>
              <Space wrap>
                <Button
                  type="primary"
                  disabled={subscribed}
                  onClick={() => {
                    setSubscribed(true);
                    message.success('已记录上线提醒 mock');
                  }}
                >
                  {subscribed ? '已订阅提醒' : '订阅上线提醒'}
                </Button>
                {config.nextActions.map((action) =>
                  action.to.startsWith('/admin') ? (
                    <a key={action.to} href={buildAdminWebUrl(action.to)}>
                      <Button>{action.label}</Button>
                    </a>
                  ) : (
                    <Link key={action.to} to={action.to}>
                      <Button>{action.label}</Button>
                    </Link>
                  ),
                )}
              </Space>
            </div>
          </Space>
        </Card>

        <div className="ph-ai-placeholder-grid">
          <Card title="当前能力状态">
            <Statistic title={config.metricLabel} value={config.metricValue} />
            <div className="ph-ai-placeholder-list">
              {config.capabilities.map((item) => (
                <div className="ph-ai-placeholder-list-item" key={item}>
                  <CheckCircleOutlined />
                  <span>{item}</span>
                </div>
              ))}
            </div>
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
