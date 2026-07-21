import { Link, useRequest } from '@umijs/max';
import { Button, Card, Col, Input, Row, Skeleton, Space, Statistic, Tag } from 'antd';
import React, { useMemo, useState } from 'react';
import type {
  AiGenerationStatus,
  AiTemplate,
  AiTool,
  AiToolStatus,
  AiToolType,
} from '@personal-hub/shared-types';
import { AiPageHeader, AiTemplateCard } from '@/components/ai';
import AiLayout from '@/layouts/AiLayout';
import { fetchAiHome } from '@/services/ai';
import { ResultState } from '@/components/shared';

const toolStatusMeta: Record<AiToolStatus, { color: string; text: string }> = {
  enabled: { color: 'blue', text: '可用' },
  comingSoon: { color: 'default', text: '即将上线' },
  disabled: { color: 'red', text: '暂不可用' },
};

const activityToolMeta: Record<
  Extract<AiToolType, 'chat' | 'text' | 'image' | 'video'>,
  { color: string; text: string }
> = {
  chat: { color: 'blue', text: '对话' },
  text: { color: 'green', text: '文本' },
  image: { color: 'purple', text: '图片' },
  video: { color: 'magenta', text: '视频' },
};

const activityStatusMeta: Record<AiGenerationStatus, { color: string; text: string }> = {
  idle: { color: 'default', text: '待开始' },
  generating: { color: 'processing', text: '生成中' },
  done: { color: 'success', text: '已完成' },
  failed: { color: 'error', text: '失败' },
  stopped: { color: 'warning', text: '已停止' },
};

function includesKeyword(values: Array<string | undefined>, keyword: string) {
  if (!keyword) return true;
  return values.join(' ').toLowerCase().includes(keyword);
}

function filterTools(tools: AiTool[], keyword: string) {
  return tools.filter((tool) =>
    includesKeyword(
      [
        tool.name,
        tool.description,
        tool.defaultModelId,
        tool.tokenCostLabel,
        toolStatusMeta[tool.status].text,
        ...(tool.modelTags ?? []),
      ],
      keyword,
    ),
  );
}

function filterTemplates(templates: AiTemplate[], keyword: string) {
  return templates.filter((template) =>
    includesKeyword(
      [
        template.title,
        template.description,
        template.modelId,
        template.prompt,
        ...(template.tags ?? []),
      ],
      keyword,
    ),
  );
}

const AiHome: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const { data, loading, error, refresh } = useRequest(fetchAiHome);
  const home = data;
  const enabledToolCount =
    home?.tools.filter((tool) => tool.status === 'enabled').length ?? 0;
  const normalizedKeyword = keyword.trim().toLowerCase();
  const visibleTools = useMemo(
    () => (home ? filterTools(home.tools, normalizedKeyword) : []),
    [home, normalizedKeyword],
  );
  const visibleTemplates = useMemo(
    () => (home ? filterTemplates(home.templates, normalizedKeyword) : []),
    [home, normalizedKeyword],
  );

  return (
    <AiLayout
      brandName={home?.brandName}
      quotaText={
        home
          ? `${home.quota.remainingTokens.toLocaleString()} Token`
          : undefined
      }
    >
      <AiPageHeader
        description="聚合对话、文本、图片、视频和模板入口，阶段 5 先以 mock 跑通完整体验。"
        title="AI 工作台"
      />

      {loading && <Skeleton active paragraph={{ rows: 8 }} />}
      {error && (
        <ResultState
          description="AI 首页数据加载失败，请稍后重试。"
          status="error"
          onRetry={refresh}
        />
      )}

      {home && (
        <>
          <Card className="ph-ai-home-search-card">
            <Input.Search
              allowClear
              placeholder="搜索工具、模板、模型或能力"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={setKeyword}
            />
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col lg={8} md={12} xs={24}>
              <Card>
                <Statistic
                  suffix="Token"
                  title="剩余额度"
                  value={home.quota.remainingTokens}
                />
              </Card>
            </Col>
            <Col lg={8} md={12} xs={24}>
              <Card>
                <Statistic title="可用工具" value={enabledToolCount} />
              </Card>
            </Col>
            <Col lg={8} md={12} xs={24}>
              <Card>
                <Statistic title="最近创作" value={home.recentActivities.length} />
              </Card>
            </Col>
          </Row>

          <Card
            extra={normalizedKeyword ? `匹配 ${visibleTools.length} 个工具` : undefined}
            title="一键使用顶尖视频 / 图片 / 文本模型"
            style={{ marginBottom: 20 }}
          >
            {visibleTools.length === 0 ? (
              <ResultState
                status="filtered-empty"
                description="未找到匹配工具，换个关键词试试。"
                clearText="清除搜索"
                onClear={() => setKeyword('')}
              />
            ) : (
              <div className="ph-ai-card-grid">
                {visibleTools.map((tool) => {
                  const statusMeta = toolStatusMeta[tool.status];
                  const enabled = tool.status === 'enabled';

                  return (
                    <Card
                      className={enabled ? undefined : 'ph-ai-tool-card-disabled'}
                      hoverable={enabled}
                      key={tool.code}
                      size="small"
                    >
                      <Space size={6} wrap>
                        <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
                        {tool.guestTrialEnabled && <Tag color="green">游客试用</Tag>}
                        {tool.requiresLogin && <Tag>需登录</Tag>}
                      </Space>
                      <h3 style={{ margin: '12px 0 6px' }}>{tool.name}</h3>
                      <p className="ph-text-secondary">{tool.description}</p>
                      <div className="ph-ai-tool-card-meta">
                        {tool.defaultModelId && <span>默认模型：{tool.defaultModelId}</span>}
                        {tool.tokenCostLabel && <span>{tool.tokenCostLabel}</span>}
                      </div>
                      {enabled ? (
                        <Link to={tool.path}>
                          <Button block type="primary">
                            使用工具
                          </Button>
                        </Link>
                      ) : (
                        <Button block disabled>
                          {statusMeta.text}
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            extra={<Link to="/workspace/ai/history">查看会话历史</Link>}
            title="最近创作"
            style={{ marginBottom: 20 }}
          >
            <div className="ph-ai-recent-activity-list">
              {home.recentActivities.map((activity) => {
                const toolMeta = activityToolMeta[activity.toolType];
                const statusMeta = activityStatusMeta[activity.status];

                return (
                  <Link
                    className="ph-ai-recent-activity-item"
                    key={activity.id}
                    to={activity.path}
                  >
                    <div className="ph-ai-recent-activity-main">
                      <Space size={6} wrap>
                        <Tag color={toolMeta.color}>{toolMeta.text}</Tag>
                        <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
                        <Tag>{activity.modelId}</Tag>
                      </Space>
                      <strong>{activity.title}</strong>
                      {activity.description && <span>{activity.description}</span>}
                    </div>
                    <time>{new Date(activity.createdAt).toLocaleString()}</time>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card
            extra={
              normalizedKeyword ? `匹配 ${visibleTemplates.length} 个模板` : undefined
            }
            title="推荐模板"
          >
            {visibleTemplates.length === 0 ? (
              <ResultState
                status="filtered-empty"
                description="未找到匹配模板，换个关键词试试。"
                clearText="清除搜索"
                onClear={() => setKeyword('')}
              />
            ) : (
              <div className="ph-ai-card-grid">
                {visibleTemplates.map((template) => (
                  <AiTemplateCard key={template.id} template={template} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </AiLayout>
  );
};

export default AiHome;
