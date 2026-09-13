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
  const {
    historyTasks,
    loading,
    visibleCount: visibleRecordCount,
    loadMore: loadMoreMediaRecords,
    resetVisible,
  } = useAiMediaJobHistory('video');
  const [searchParams] = useSearchParams();
  const { initialState } = useModel('@@initialState');
  const { runtimeConfig } = useModel('ai');
  const templateId = searchParams.get('templateId');
  const appliedTemplateIdRef = useRef<string | undefined>(undefined);
  const { data: homeData } = useRequest(fetchAiHome);
  const [detail, setDetail] = useState<{
    asset: AiAsset;
    assets: AiAsset[];
    task?: AiGenerationTask;
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
  const modelNames = useMemo(() => {
    const fromHistory = historyTasks.flatMap((task) =>
      task.modelName ? ([[task.modelId, task.modelName]] as const) : [],
    );
    const fromAvailable = modelState.models.map((model) => [model.id, model.name] as const);
    return Object.fromEntries([...fromHistory, ...fromAvailable]);
  }, [historyTasks, modelState.models]);
  const estimatedTokens = 1500 * (generation.draft.params.count ?? 1);
  const isGuest = !initialState?.currentUser;
  const videoTool = homeData?.tools.find((tool) => tool.code === 'video');
  const requiresLogin = Boolean(videoTool?.requiresLogin);
  const quotaInsufficient =
    !isGuest &&
    runtimeConfig.quota !== undefined &&
    runtimeConfig.quota.remainingTokens < estimatedTokens;
  const guestLimitExceeded = Boolean(homeData?.guestTrial?.exceeded);
  const configGroups = useMemo<AiConfigGroup[]>(
    () => [
      {
        key: 'size',
        title: '视频比例',
        type: 'grid',
        columns: 3,
        value: generation.draft.params.size ?? '16:9',
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
        value: generation.draft.params.durationSeconds ?? 6,
        options: durationOptions,
        onChange: (durationSeconds) =>
          generation.updateParams({ durationSeconds: Number(durationSeconds) }),
      },
      {
        key: 'style',
        title: '镜头风格',
        type: 'grid',
        columns: 4,
        value: generation.draft.params.style ?? '产品运镜',
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
              title: '描述一个想生成的视频画面',
              description: '输入脚本或镜头想法，设置比例、时长与风格。',
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
                    placeholder: '选择视频模型',
                    onChange: (modelId) => generation.updateDraft({ modelId }),
                  }}
                  placeholder="描述视频内容、镜头和节奏"
                  submitDisabled={
                    !modelState.hasModels ||
                    quotaInsufficient ||
                    (isGuest && requiresLogin) ||
                    (isGuest && guestLimitExceeded)
                  }
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
                  onChange={(prompt) => generation.updateDraft({ prompt })}
                  onClear={() => {
                    generation.updateDraft({ prompt: '' });
                    generation.updateParams({ attachments: [] });
                  }}
                  onOptimize={(prompt) => `更适合视频生成的分镜提示词：${prompt.trim()}，包含主体、镜头运动、节奏、光线和画面氛围`}
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
                  toolName="视频生成"
                  visible={!isGuest}
                />
                <AiGuestLimitAlert
                  dailyLimit={homeData?.guestTrial?.dailyLimit}
                  exceeded={guestLimitExceeded}
                  isGuest={isGuest}
                  remainingUses={homeData?.guestTrial?.remaining}
                  requiresLogin={requiresLogin}
                  toolName="视频生成"
                />
              </Space>
            )}
          />

          <AiMediaDetailModal
            asset={detail?.asset}
            assets={detail?.assets}
            modelLabel={
              detail
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

export default AiVideoPage;
