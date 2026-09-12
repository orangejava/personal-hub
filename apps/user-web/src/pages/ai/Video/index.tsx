import { useModel, useSearchParams } from '@umijs/max';
import { useRequest } from '@/hooks/useRequest';
import type { AiAsset } from '@personal-hub/shared-types';
import {
  App,
  Alert,
  Button,
  Descriptions,
  Drawer,
  Skeleton,
  Space,
  Tag,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiComposer,
  AiConfigPopover,
  type AiConfigGroup,
  AiAuthenticatedMedia,
  AiGenerationStream,
  AiGuestLimitAlert,
  AiMediaListToolbar,
  type AiMediaTimePreset,
  AiQuotaAlert,
  AiWorkspaceFrame,
  useAiAvailableModels,
  useAiGeneration,
} from '@/components/ai';
import AiLayout from '@/layouts/AiLayout';
import { fetchAiGenerationJobs, fetchAiHome } from '@/services/ai';

const videoSizeOptions = [
  { label: '横屏 16:9', value: '16:9' },
  { label: '竖屏 9:16', value: '9:16' },
  { label: '方形 1:1', value: '1:1' },
];

const durationOptions = [
  { label: '5 秒', value: 5 },
  { label: '6 秒', value: 6 },
  { label: '8 秒', value: 8 },
  { label: '10 秒', value: 10 },
];

type MediaSize = '1:1' | '16:9' | '9:16';

const videoStyleOptions = [
  { label: '产品运镜', value: '产品运镜' },
  { label: '柔和光线', value: '柔和光线' },
  { label: '工作台特写', value: '工作台特写' },
  { label: '电影感', value: '电影感' },
];

function getVideoRatioIcon(size?: string) {
  if (size === '9:16') return 'ph-ai-ratio-icon ph-ai-ratio-icon-portrait';
  if (size === '16:9') return 'ph-ai-ratio-icon ph-ai-ratio-icon-wide';
  return 'ph-ai-ratio-icon ph-ai-ratio-icon-square';
}

const AiVideoPage: React.FC = () => {
  const { message } = App.useApp();
  const { data: jobsPage, loading } = useRequest(() =>
    fetchAiGenerationJobs({ toolType: 'video', pageSize: 20 }),
  );
  const [searchParams] = useSearchParams();
  const { initialState } = useModel('@@initialState');
  const { runtimeConfig } = useModel('ai');
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
  const historyTasks = useMemo(() => jobsPage?.list ?? [], [jobsPage?.list]);
  const initialAssets = useMemo(
    () => historyTasks[0]?.assets ?? [],
    [historyTasks],
  );
  const initialTask = useMemo(
    () =>
      historyTasks[0] ?? {
        id: '',
        toolType: 'video' as const,
        title: '',
        prompt: '',
        modelId: '',
        status: 'idle' as const,
        assetIds: [],
        params: { size: '16:9' as const, durationSeconds: 6, count: 1 as const },
        createdAt: new Date().toISOString(),
      },
    [historyTasks],
  );
  const generation = useAiGeneration({
    toolType: 'video',
    initialAssets,
    initialTask,
  });
  const activeTemplate = useMemo(
    () =>
      homeData?.templates.find(
        (template) => template.id === templateId && template.toolType === 'video',
      ),
    [homeData?.templates, templateId],
  );
  const modelState = useAiAvailableModels({
    toolType: 'video',
    value: generation.draft.modelId,
    onDefaultModel: (modelId) => generation.updateDraft({ modelId }),
  });
  const estimatedTokens = 1500 * (generation.draft.params.count ?? 1);
  const quotaInsufficient =
    runtimeConfig.quota !== undefined &&
    runtimeConfig.quota.remainingTokens < estimatedTokens;
  const isGuest = !initialState?.currentUser;
  const guestLimitExceeded = Boolean(homeData?.guestTrial?.exceeded);
  const configGroups = useMemo<AiConfigGroup[]>(
    () => [
      {
        key: 'size',
        title: '视频比例',
        type: 'grid',
        columns: 3,
        value: generation.draft.params.size,
        options: videoSizeOptions.map((option) => ({
          ...option,
          icon: <span className={getVideoRatioIcon(String(option.value))} />,
        })),
        onChange: (size) => generation.updateParams({ size: String(size) as MediaSize }),
      },
      {
        key: 'duration',
        title: '视频时长',
        type: 'segmented',
        value: generation.draft.params.durationSeconds,
        options: durationOptions,
        onChange: (durationSeconds) =>
          generation.updateParams({ durationSeconds: Number(durationSeconds) }),
      },
      {
        key: 'style',
        title: '镜头风格',
        type: 'grid',
        columns: 4,
        value: generation.draft.params.style,
        options: videoStyleOptions,
        onChange: (style) => generation.updateParams({ style: String(style) }),
      },
    ],
    [generation.draft.params, generation.updateParams],
  );
  const configSummary = useMemo(
    () =>
      `${generation.draft.params.size ?? '16:9'} | ${generation.draft.params.durationSeconds ?? 6}秒 | ${generation.draft.params.style ?? '产品运镜'}`,
    [
      generation.draft.params.durationSeconds,
      generation.draft.params.size,
      generation.draft.params.style,
    ],
  );

  useEffect(() => {
    if (!activeTemplate || appliedTemplateIdRef.current === activeTemplate.id) return;
    appliedTemplateIdRef.current = activeTemplate.id;
    generation.applyDraft({
      title: activeTemplate.title,
      prompt: activeTemplate.prompt,
      modelId: activeTemplate.modelId,
      params: activeTemplate.params,
    });
    message.info(`已应用模板：${activeTemplate.title}`);
  }, [activeTemplate, generation.applyDraft, message]);

  const generateAndConsumeQuota = async () => {
    await generation.regenerate();
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
              title: '描述一个想生成的视频画面',
              description: '输入脚本或镜头想法，设置比例、时长与风格，先用 mock 创作流验证整体体验。',
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
                  history={historyTasks}
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
                    placeholder: '选择视频模型',
                    onChange: (modelId) => generation.updateDraft({ modelId }),
                  }}
                  placeholder="描述视频内容、镜头和节奏"
                  submitDisabled={!modelState.hasModels || quotaInsufficient || guestLimitExceeded}
                  submitLabel="生成视频"
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
                        title="视频生成配置"
                      />
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
                  onOptimize={(prompt) => `更适合视频生成的分镜提示词：${prompt.trim()}，包含主体、镜头运动、节奏、光线和画面氛围`}
                  onStop={() => {
                    void generation.stop();
                  }}
                  onSubmit={generateAndConsumeQuota}
                />
                <AiQuotaAlert
                  estimatedTokens={estimatedTokens}
                  quota={runtimeConfig.quota}
                  toolName="视频生成"
                />
                <AiGuestLimitAlert
                  dailyLimit={homeData?.guestTrial?.dailyLimit}
                  exceeded={guestLimitExceeded}
                  isGuest={isGuest}
                  remainingUses={homeData?.guestTrial?.remaining}
                  toolName="视频生成"
                />
              </Space>
            )}
          />

          <Drawer
            destroyOnHidden
            open={Boolean(detailAsset)}
            size="large"
            title="视频详情"
            onClose={() => setDetailAsset(null)}
          >
            {detailAsset && (
              <div className="ph-ai-asset-detail">
                {detailAsset && (
                  <AiAuthenticatedMedia
                    asset={detailAsset}
                    className="ph-ai-asset-detail-preview"
                  />
                )}
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="标题">
                    {detailAsset.title}
                  </Descriptions.Item>
                  <Descriptions.Item label="模型">
                    {detailAsset.modelId}
                  </Descriptions.Item>
                  <Descriptions.Item label="比例">
                    {generation.task.params?.size}
                  </Descriptions.Item>
                  <Descriptions.Item label="时长">
                    {generation.task.params?.durationSeconds} 秒
                  </Descriptions.Item>
                  <Descriptions.Item label="预计消耗">
                    1500 Token / 条
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

export default AiVideoPage;
