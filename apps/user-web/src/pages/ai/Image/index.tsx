import { useModel, useSearchParams } from '@umijs/max';
import { useRequest } from '@/hooks/useRequest';
import type { AiAsset, AiGenerationTask } from '@personal-hub/shared-types';
import {
  App,
  Alert,
  Skeleton,
  Space,
  Tag,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiComposer,
  AiConfigPopover,
  type AiConfigGroup,
  AiGenerationStream,
  AiGuestLimitAlert,
  AiMediaDetailModal,
  AiMediaListToolbar,
  type AiMediaTimePreset,
  AiQuotaAlert,
  AiWorkspaceFrame,
  useAiAvailableModels,
  useAiGeneration,
  useAiMediaJobHistory,
} from '@/components/ai';
import AiLayout from '@/layouts/AiLayout';
import { fetchAiHome } from '@/services/ai';

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
  const {
    historyTasks,
    loading,
    visibleCount: visibleRecordCount,
    loadMore: loadMoreMediaRecords,
    resetVisible,
  } = useAiMediaJobHistory('image');
  const [searchParams] = useSearchParams();
  const { initialState } = useModel('@@initialState');
  const { runtimeConfig } = useModel('ai');
  const templateId = searchParams.get('templateId');
  const appliedTemplateIdRef = useRef<string | undefined>(undefined);
  const { data: homeData } = useRequest(fetchAiHome);
  const [detail, setDetail] = useState<{
    asset: AiAsset;
    assets: AiAsset[];
    task: AiGenerationTask;
  } | null>(null);
  const [mediaKeyword, setMediaKeyword] = useState('');
  const [timePreset, setTimePreset] = useState<AiMediaTimePreset>('all');
  const [dateRange, setDateRange] = useState<[string | undefined, string | undefined]>([
    undefined,
    undefined,
  ]);
  const initialAssets = useMemo(
    () => historyTasks[0]?.assets ?? [],
    [historyTasks],
  );
  const initialTask = useMemo(
    () =>
      historyTasks[0] ?? {
        id: '',
        toolType: 'image' as const,
        title: '',
        prompt: '',
        modelId: '',
        status: 'idle' as const,
        assetIds: [],
        params: { size: '16:9' as const, style: '科技感', count: 1 as const },
        createdAt: new Date().toISOString(),
      },
    [historyTasks],
  );
  const generation = useAiGeneration({
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
  const modelNames = useMemo(() => {
    const fromHistory = historyTasks.flatMap((task) =>
      task.modelName ? ([[task.modelId, task.modelName]] as const) : [],
    );
    const fromAvailable = modelState.models.map((model) => [model.id, model.name] as const);
    return Object.fromEntries([...fromHistory, ...fromAvailable]);
  }, [historyTasks, modelState.models]);
  const estimatedTokens = 500 * (generation.draft.params.count ?? 1);
  const isGuest = !initialState?.currentUser;
  const imageTool = homeData?.tools.find((tool) => tool.code === 'image');
  const requiresLogin = Boolean(imageTool?.requiresLogin);
  const quotaInsufficient =
    !isGuest &&
    runtimeConfig.quota !== undefined &&
    runtimeConfig.quota.remainingTokens < estimatedTokens;
  const guestLimitExceeded = Boolean(homeData?.guestTrial?.exceeded);
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
        value: generation.draft.params.size ?? '16:9',
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
        value: generation.draft.params.style ?? '科技感',
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
    });
    message.info(`已应用模板：${activeTemplate.title}`);
  }, [activeTemplate, generation.applyDraft, message]);

  const generateAndConsumeQuota = async (source?: AiGenerationTask) => {
    await generation.regenerate(source);
  };
  const handleViewDetail = useCallback(
    (asset: AiAsset, siblings: AiAsset[] = [], task?: AiGenerationTask) => {
      setDetail({
        asset,
        assets: siblings.length > 0 ? siblings : [asset],
        task: task ?? generation.task,
      });
    },
    [generation.task],
  );
  useEffect(() => {
    resetVisible();
  }, [mediaKeyword, timePreset, dateRange, resetVisible]);

  return (
    <AiLayout>
      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <AiWorkspaceFrame
            autoScrollKey={`${historyTasks.length}:${generation.task.id}:${generation.assets.length}`}
            onLoadMoreBefore={loadMoreMediaRecords}
            showWelcome={
              historyTasks.length === 0 &&
              generation.assets.length === 0 &&
              generation.task.status !== 'failed' &&
              generation.task.status !== 'generating'
            }
            welcome={{
              title: '开始你的第一张创作图像',
              description: '输入提示词、选择模型和参数，也可以补充附件与尺寸配置，快速生成想要的画面。',
            }}
            rightPanel={(
              <AiMediaListToolbar
                dateRange={dateRange}
                keyword={mediaKeyword}
                timePreset={timePreset}
                onDateRangeChange={setDateRange}
                onKeywordChange={setMediaKeyword}
                onTimePresetChange={setTimePreset}
              />
            )}
            messageArea={(
              <div className="ph-ai-media-workspace">
                <AiGenerationStream
                  assets={generation.assets}
                  dateRange={dateRange}
                  history={historyTasks}
                  keyword={mediaKeyword}
                  modelNames={modelNames}
                  prompt={generation.task.prompt}
                  task={generation.task}
                  timePreset={timePreset}
                  title={generation.task.title}
                  visibleCount={visibleRecordCount}
                  onCopyPrompt={(nextPrompt) => generation.updateDraft({ prompt: nextPrompt })}
                  onEditAgain={generation.editAgain}
                  onRegenerate={generateAndConsumeQuota}
                  onUseAsAttachment={generation.useAsAttachment}
                  onViewDetail={handleViewDetail}
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
                  submitDisabled={
                    !modelState.hasModels ||
                    quotaInsufficient ||
                    (isGuest && requiresLogin) ||
                    (isGuest && guestLimitExceeded)
                  }
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
                  leadingActions={
                    <AiConfigPopover
                      buttonText={`生成配置 ${configSummary}`}
                      groups={configGroups}
                      title="图片生成配置"
                    />
                  }
                  onChange={(prompt) => generation.updateDraft({ prompt })}
                  onClear={() => {
                    generation.updateDraft({ prompt: '' });
                    generation.updateParams({ attachments: [] });
                  }}
                  onOptimize={(prompt) => `更具体、更适合图像生成的提示词：${prompt.trim()}，高质量细节，主体明确，光影自然`}
                  onStop={() => {
                    void generation.stop();
                  }}
                  onSubmit={() => {
                    void generateAndConsumeQuota();
                  }}
                />
                <AiQuotaAlert
                  estimatedTokens={estimatedTokens}
                  quota={runtimeConfig.quota}
                  toolName="图片生成"
                  visible={!isGuest}
                />
                <AiGuestLimitAlert
                  dailyLimit={homeData?.guestTrial?.dailyLimit}
                  exceeded={guestLimitExceeded}
                  isGuest={isGuest}
                  remainingUses={homeData?.guestTrial?.remaining}
                  requiresLogin={requiresLogin}
                  toolName="图片生成"
                />
              </Space>
            )}
          />

          <AiMediaDetailModal
            asset={detail?.asset}
            assets={detail?.assets}
            modelLabel={
              detail?.asset.modelId
                ? (modelNames[detail.asset.modelId] ?? detail.asset.modelId)
                : undefined
            }
            open={Boolean(detail)}
            task={detail?.task}
            onClose={() => setDetail(null)}
          />
        </>
      )}
    </AiLayout>
  );
};

export default AiImagePage;
