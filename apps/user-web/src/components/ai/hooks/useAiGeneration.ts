import type {
  AiAsset,
  AiGenerationParams,
  AiGenerationTask,
  AiToolType,
} from '@personal-hub/shared-types';
import { App } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cancelAiMediaJob, generateAiImage, generateAiVideo } from '@/services/ai';

interface GenerationDraft {
  title: string;
  prompt: string;
  modelId: string;
  params: AiGenerationParams;
}

interface UseAiGenerationOptions {
  toolType: Extract<AiToolType, 'image' | 'video'>;
  initialAssets: AiAsset[];
  initialTask: AiGenerationTask;
}

function createFallbackTask(
  toolType: Extract<AiToolType, 'image' | 'video'>,
  draft: GenerationDraft,
  status: AiGenerationTask['status'],
): AiGenerationTask {
  return {
    id: `task-${toolType}-${Date.now()}`,
    toolType,
    title: draft.title,
    prompt: draft.prompt,
    modelId: draft.modelId,
    status,
    assetIds: [],
    params: draft.params,
    createdAt: new Date().toISOString(),
  };
}

function withParamDefaults(
  toolType: Extract<AiToolType, 'image' | 'video'>,
  params: AiGenerationParams = {},
): AiGenerationParams {
  if (toolType === 'video') {
    return {
      size: '16:9',
      durationSeconds: 6,
      count: 1,
      style: '产品运镜',
      ...params,
    };
  }
  return {
    size: '16:9',
    count: 1,
    quality: 'standard',
    resolution: '2k',
    style: '科技感',
    ...params,
  };
}

function normalizeMediaParams(
  toolType: Extract<AiToolType, 'image' | 'video'>,
  params: AiGenerationParams,
): AiGenerationParams {
  const next = withParamDefaults(toolType, params);
  if (toolType === 'video') {
    return { ...next, count: 1 };
  }
  const count = next.count ?? 1;
  return { ...next, count: Math.min(Math.max(count, 1), 4) as 1 | 2 | 4 };
}

/**
 * 图片 / 视频生成状态。结果只来自当前 job 的 assets，额度由服务端预占结算。
 */
export function useAiGeneration({
  toolType,
  initialAssets,
  initialTask,
}: UseAiGenerationOptions) {
  const { message } = App.useApp();
  const [assets, setAssets] = useState(initialAssets);
  const [task, setTask] = useState(initialTask);
  const [isSavingAssets, setIsSavingAssets] = useState(false);
  const [draft, setDraft] = useState<GenerationDraft>({
    title: initialTask.title,
    prompt: initialTask.prompt,
    modelId: initialTask.modelId,
    params: withParamDefaults(toolType, initialTask.params),
  });
  const jobIdRef = useRef(initialTask.id);
  const draftTouchedRef = useRef(false);
  const taskStatusRef = useRef(task.status);
  taskStatusRef.current = task.status;

  useEffect(() => {
    if (isSavingAssets || taskStatusRef.current === 'generating') return;
    setAssets(initialAssets);
    setTask(initialTask);
    jobIdRef.current = initialTask.id;
  }, [initialAssets, initialTask, isSavingAssets, toolType]);

  useEffect(() => {
    if (draftTouchedRef.current) return;
    setDraft({
      title: initialTask.title,
      prompt: initialTask.prompt,
      modelId: initialTask.modelId,
      params: withParamDefaults(toolType, initialTask.params),
    });
  }, [initialAssets, initialTask, toolType]);

  const attachmentAssets = useMemo(
    () =>
      (draft.params.attachments ?? [])
        .map((assetId) => assets.find((asset) => asset.id === assetId))
        .filter((asset): asset is AiAsset => Boolean(asset)),
    [assets, draft.params.attachments],
  );

  const updateDraft = useCallback((patch: Partial<GenerationDraft>) => {
    draftTouchedRef.current = true;
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const updateParams = useCallback((patch: AiGenerationParams) => {
    draftTouchedRef.current = true;
    setDraft((current) => ({
      ...current,
      params: { ...current.params, ...patch },
    }));
  }, []);

  const applyDraft = useCallback((nextDraft: Partial<GenerationDraft>) => {
    draftTouchedRef.current = true;
    setDraft((current) => ({
      ...current,
      ...nextDraft,
      params: nextDraft.params ? { ...current.params, ...nextDraft.params } : current.params,
    }));
  }, []);

  const toDraft = useCallback((source: AiGenerationTask): GenerationDraft => ({
    title: source.title,
    prompt: source.prompt,
    modelId: source.modelId,
    params: withParamDefaults(toolType, source.params),
  }), [toolType]);

  const editAgain = useCallback((source?: AiGenerationTask) => {
    const next = toDraft(source ?? task);
    draftTouchedRef.current = true;
    setDraft(next);
    message.info('已把本次输入回填到输入区');
  }, [message, task, toDraft]);

  const regenerate = useCallback(async (source?: AiGenerationTask) => {
    // Composer onSubmit 会传入字符串；只有历史任务对象才能回填草稿。
    const taskSource =
      source && typeof source === 'object' && typeof source.prompt === 'string'
        ? source
        : undefined;
    const nextDraft = taskSource ? toDraft(taskSource) : draft;
    if (taskSource) {
      draftTouchedRef.current = true;
      setDraft(nextDraft);
    }
    setIsSavingAssets(true);
    try {
      const generate = toolType === 'image' ? generateAiImage : generateAiVideo;
      const normalizedDraft = {
        ...nextDraft,
        params: normalizeMediaParams(toolType, nextDraft.params),
      };
      const result = await generate(
        {
          title: normalizedDraft.title,
          prompt: normalizedDraft.prompt,
          modelId: normalizedDraft.modelId,
          params: normalizedDraft.params,
        },
        (created) => {
          jobIdRef.current = created.id;
          setTask(created);
        },
      );
      const nextAssets = result.assets ?? [];
      const nextTask = result.task ?? createFallbackTask(toolType, normalizedDraft, 'done');
      jobIdRef.current = nextTask.id;
      if (nextAssets.length > 0) {
        setAssets(nextAssets);
      }
      setTask(nextTask);
      if (nextTask.status === 'failed') {
        message.error('生成失败，请调整参数后重试');
        return undefined;
      }
      if (nextTask.status === 'stopped') {
        message.info('任务已停止');
        return undefined;
      }
      message.success('已生成并保存到 AI 资产');
      return nextAssets;
    } catch (_error) {
      setTask(createFallbackTask(toolType, nextDraft, 'failed'));
      message.error(_error instanceof Error ? _error.message : '生成失败，请稍后重试');
      return undefined;
    } finally {
      setIsSavingAssets(false);
    }
  }, [draft, message, toDraft, toolType]);

  const stop = useCallback(async () => {
    const jobId = jobIdRef.current;
    if (!jobId || jobId.startsWith('task-')) {
      return;
    }
    try {
      const next = await cancelAiMediaJob(toolType, jobId);
      setTask(next);
      message.info('已请求停止当前任务');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '停止失败');
    }
  }, [message, toolType]);

  const useAsAttachment = useCallback((asset: AiAsset) => {
    setDraft((current) => {
      const attachments = current.params.attachments ?? [];
      if (attachments.includes(asset.id)) return current;
      return {
        ...current,
        params: {
          ...current.params,
          attachments: [...attachments, asset.id],
        },
      };
    });
    message.success('已引用为下一次生成的附件');
  }, [message]);

  return {
    assets,
    task,
    draft,
    attachmentAssets,
    isSavingAssets,
    updateDraft,
    updateParams,
    applyDraft,
    editAgain,
    regenerate,
    stop,
    useAsAttachment,
  };
}
