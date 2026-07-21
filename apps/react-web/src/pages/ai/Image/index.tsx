import { useModel, useRequest, useSearchParams } from '@umijs/max';
import type { AiAsset } from '@personal-hub/shared-types';
import {
  App,
  Alert,
  Button,
  Descriptions,
  Drawer,
  Skeleton,
  Space,
  Switch,
  Tag,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiComposer,
  AiConfigPopover,
  type AiConfigGroup,
  AiGenerationStream,
  AiGuestLimitAlert,
  AiMediaListToolbar,
  type AiMediaTimePreset,
  AiQuotaAlert,
  AiWorkspaceFrame,
  useAiAvailableModels,
  useAiGenerationMock,
} from '@/components/ai';
import AiLayout from '@/layouts/AiLayout';
import { fetchAiAssets, fetchAiHome } from '@/services/ai';

const imageStyleOptions = [
  { label: '科技感', value: '科技感' },
  { label: '写实摄影', value: '写实摄影' },
  { label: '扁平插画', value: '扁平插画' },
  { label: '赛博霓虹', value: '赛博霓虹' },
];

const sizeOptions = [
  { label: '方图 1:1', value: '1:1' },
  { label: '横图 16:9', value: '16:9' },
  { label: '竖图 9:16', value: '9:16' },
];

const countOptions = [
  { label: '1 张', value: 1 },
  { label: '2 张', value: 2 },
  { label: '4 张', value: 4 },
];

type MediaSize = '1:1' | '16:9' | '9:16';

const imageQualityOptions = [
  { label: '低画质', value: 'low' },
  { label: '标准画质', value: 'standard' },
  { label: '高画质', value: 'high' },
];

const imageResolutionOptions = [
  { label: '1K', value: '1k' },
  { label: '2K', value: '2k' },
  { label: '4K', value: '4k' },
];

function getRatioIcon(size?: string) {
  if (size === '9:16') return 'ph-ai-ratio-icon ph-ai-ratio-icon-portrait';
  if (size === '16:9') return 'ph-ai-ratio-icon ph-ai-ratio-icon-wide';
  return 'ph-ai-ratio-icon ph-ai-ratio-icon-square';
}

const AiImagePage: React.FC = () => {
  const { message } = App.useApp();
  const { data, loading } = useRequest(fetchAiAssets);
  const [searchParams] = useSearchParams();
  const { initialState } = useModel('@@initialState');
  const { consumeQuota, runtimeConfig } = useModel('ai');
  const templateId = searchParams.get('templateId');
  const appliedTemplateIdRef = useRef<string | undefined>(undefined);
  const { data: homeData } = useRequest(fetchAiHome);
  const [detailAsset, setDetailAsset] = useState<AiAsset | null>(null);
  const [mediaKeyword, setMediaKeyword] = useState('');
  const [timePreset, setTimePreset] = useState<AiMediaTimePreset>('all');
  const [dateRange, setDateRange] = useState<[string | undefined, string | undefined]>([
    undefined,
    undefined,
  ]);
  const [visibleRecordCount, setVisibleRecordCount] = useState(10);
  const initialAssets = useMemo(
    () => (data ?? []).filter((asset) => asset.type === 'image'),
    [data],
  );
  const initialTask = useMemo(
    () => ({
      id: 'mock-image-task',
      toolType: 'image' as const,
      title: '知识文章封面',
      prompt: 'React 工程化文章封面，蓝绿色科技风，简洁排版。',
      modelId: 'qwen-image',
      status: 'done' as const,
      assetIds: initialAssets.map((asset) => asset.id),
      params: { size: '16:9' as const, style: '科技感', count: 1 as const },
      createdAt: new Date().toISOString(),
    }),
    [initialAssets],
  );
  const generation = useAiGenerationMock({
    toolType: 'image',
    initialAssets,
    initialTask,
  });
  const activeTemplate = useMemo(
    () =>
      homeData?.templates.find(
        (template) => template.id === templateId && template.toolType === 'image',
      ),
    [homeData?.templates, templateId],
  );
  const modelState = useAiAvailableModels({
    toolType: 'image',
    value: generation.draft.modelId,
    onDefaultModel: (modelId) => generation.updateDraft({ modelId }),
  });
  const estimatedTokens = 500 * (generation.draft.params.count ?? 1);
  const quotaInsufficient =
    runtimeConfig.quota !== undefined &&
    runtimeConfig.quota.remainingTokens < estimatedTokens;
  const forceGuestMode = searchParams.get('guestMode') === '1';
  const isGuest = forceGuestMode || !initialState?.currentUser;
  const guestLimitExceeded =
    isGuest && searchParams.get('guestLimit') === 'exceeded';
  const configGroups = useMemo<AiConfigGroup[]>(
    () => [
      {
        key: 'quality',
        title: '图像质量',
        type: 'segmented',
        value: generation.draft.params.quality ?? 'standard',
        options: imageQualityOptions,
        onChange: (quality) => generation.updateParams({ quality: String(quality) }),
      },
      {
        key: 'resolution',
        title: '清晰度',
        type: 'segmented',
        value: generation.draft.params.resolution ?? '2k',
        options: imageResolutionOptions,
        onChange: (resolution) =>
          generation.updateParams({ resolution: String(resolution) }),
      },
      {
        key: 'size',
        title: '图片尺寸',
        type: 'grid',
        columns: 3,
        value: generation.draft.params.size,
        options: sizeOptions.map((option) => ({
          ...option,
          icon: <span className={getRatioIcon(String(option.value))} />,
        })),
        onChange: (size) => generation.updateParams({ size: String(size) as MediaSize }),
      },
      {
        key: 'count',
        title: '生成数量',
        type: 'segmented',
        value: generation.draft.params.count ?? 1,
        options: countOptions,
        onChange: (count) => generation.updateParams({ count: Number(count) as 1 | 2 | 4 }),
      },
      {
        key: 'style',
        title: '图像风格',
        type: 'grid',
        columns: 4,
        value: generation.draft.params.style,
        options: imageStyleOptions,
        onChange: (style) => generation.updateParams({ style: String(style) }),
      },
    ],
    [generation.draft.params, generation.updateParams],
  );
  const qualityLabel = useMemo(
    () =>
      imageQualityOptions.find(
        (option) => option.value === (generation.draft.params.quality ?? 'standard'),
      )?.label ?? '标准画质',
    [generation.draft.params.quality],
  );
  const configSummary = useMemo(
    () =>
      `${generation.draft.params.size ?? '16:9'} | ${generation.draft.params.count ?? 1}张 | ${qualityLabel}`,
    [generation.draft.params.count, generation.draft.params.size, qualityLabel],
  );

  useEffect(() => {
    if (!activeTemplate || appliedTemplateIdRef.current === activeTemplate.id) return;
    appliedTemplateIdRef.current = activeTemplate.id;
    generation.applyDraft({
      title: activeTemplate.title,
      prompt: activeTemplate.prompt,
      modelId: activeTemplate.modelId,
      params: activeTemplate.params,
      simulateFailure: false,
    });
    message.info(`已应用模板：${activeTemplate.title}`);
  }, [activeTemplate, generation.applyDraft, message]);

  const generateAndConsumeQuota = async () => {
    const savedAssets = await generation.regenerate();
    if (!savedAssets?.length) return;
    const result = await consumeQuota({
      tokens: estimatedTokens,
      toolType: 'image',
      reason: `图片生成 ${savedAssets.length} 张`,
    });
    if (result?.reason === 'insufficient') {
      message.warning('Token 余额不足，本次 mock 未扣减');
    }
  };
  const loadMoreMediaRecords = useCallback(() => {
    setVisibleRecordCount((count) => Math.min(count + 10, 18));
  }, []);

  useEffect(() => {
    setVisibleRecordCount(10);
  }, [mediaKeyword, timePreset, dateRange]);

  return (
    <AiLayout>
      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <AiWorkspaceFrame
            autoScrollKey={`${generation.task.id}:${generation.assets.length}`}
            onLoadMoreBefore={loadMoreMediaRecords}
            showWelcome={generation.assets.length === 0}
            welcome={{
              title: '开始你的第一张创作图像',
              description: '输入提示词、选择模型和参数，也可以补充附件与尺寸配置，快速生成想要的画面。',
            }}
            messageArea={(
              <div className="ph-ai-media-workspace">
                <AiMediaListToolbar
                  dateRange={dateRange}
                  keyword={mediaKeyword}
                  timePreset={timePreset}
                  onDateRangeChange={setDateRange}
                  onKeywordChange={setMediaKeyword}
                  onTimePresetChange={setTimePreset}
                />
                <AiGenerationStream
                  assets={generation.assets}
                  dateRange={dateRange}
                  keyword={mediaKeyword}
                  prompt={generation.task.prompt}
                  task={generation.task}
                  timePreset={timePreset}
                  title={generation.task.title}
                  visibleCount={visibleRecordCount}
                  onEditAgain={generation.editAgain}
                  onRegenerate={generateAndConsumeQuota}
                  onUseAsAttachment={generation.useAsAttachment}
                  onViewDetail={setDetailAsset}
                />
              </div>
            )}
            composer={(
              <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                {activeTemplate && (
                  <Alert
                    showIcon
                    className="ph-ai-template-applied-alert"
                    title={`已应用模板：${activeTemplate.title}`}
                    type="info"
                  />
                )}
                <AiComposer
                  loading={generation.isSavingAssets}
                  model={{
                    value: generation.draft.modelId,
                    options: modelState.options,
                    loading: modelState.loading,
                    disabled: !modelState.hasModels,
                    placeholder: '选择图片模型',
                    onChange: (modelId) => generation.updateDraft({ modelId }),
                  }}
                  placeholder="描述你想象中的画面"
                  submitDisabled={!modelState.hasModels || quotaInsufficient || guestLimitExceeded}
                  submitLabel="生成图片"
                  value={generation.draft.prompt}
                  attachments={
                    generation.attachmentAssets.length > 0 ? (
                      <div className="ph-ai-sender-attachments">
                        {generation.attachmentAssets.map((asset) => (
                          <Tag color="blue" key={asset.id}>
                            附件：{asset.title}
                          </Tag>
                        ))}
                      </div>
                    ) : undefined
                  }
                  leadingActions={(
                    <>
                      <AiConfigPopover
                        buttonText={`生成配置 ${configSummary}`}
                        groups={configGroups}
                        title="图片生成配置"
                      />
                      <Space size={6}>
                        <span className="ph-text-secondary">模拟失败</span>
                        <Switch
                          checked={generation.draft.simulateFailure}
                          size="small"
                          onChange={(simulateFailure) =>
                            generation.updateDraft({ simulateFailure })
                          }
                        />
                      </Space>
                    </>
                  )}
                  extraActions={(
                    <Button
                      disabled={generation.isSavingAssets}
                      size="small"
                      onClick={generateAndConsumeQuota}
                    >
                      重新生成
                    </Button>
                  )}
                  onChange={(prompt) => generation.updateDraft({ prompt })}
                  onClear={() => {
                    generation.updateDraft({ prompt: '' });
                    generation.updateParams({ attachments: [] });
                  }}
                  onOptimize={(prompt) => `更具体、更适合图像生成的提示词：${prompt.trim()}，高质量细节，主体明确，光影自然`}
                  onStop={() => message.info('图片生成当前为 mock 请求，暂无可停止的真实任务')}
                  onSubmit={generateAndConsumeQuota}
                />
                <AiQuotaAlert
                  estimatedTokens={estimatedTokens}
                  quota={runtimeConfig.quota}
                  toolName="图片生成"
                />
                <AiGuestLimitAlert
                  exceeded={guestLimitExceeded}
                  isGuest={isGuest}
                  toolName="图片生成"
                />
              </Space>
            )}
          />

          <Drawer
            destroyOnHidden
            open={Boolean(detailAsset)}
            size="large"
            title="图片详情"
            onClose={() => setDetailAsset(null)}
          >
            {detailAsset && (
              <div className="ph-ai-asset-detail">
                {detailAsset.thumbnailUrl && (
                  <img
                    alt={detailAsset.title}
                    className="ph-ai-asset-detail-preview"
                    src={detailAsset.thumbnailUrl}
                  />
                )}
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="标题">
                    {detailAsset.title}
                  </Descriptions.Item>
                  <Descriptions.Item label="模型">
                    {detailAsset.modelId}
                  </Descriptions.Item>
                  <Descriptions.Item label="尺寸">
                    {generation.task.params?.size}
                  </Descriptions.Item>
                  <Descriptions.Item label="风格">
                    {generation.task.params?.style ?? '未设置'}
                  </Descriptions.Item>
                  <Descriptions.Item label="预计消耗">
                    500 Token / 张
                  </Descriptions.Item>
                  <Descriptions.Item label="Prompt">
                    {detailAsset.prompt}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}
          </Drawer>
        </>
      )}
    </AiLayout>
  );
};

export default AiImagePage;
