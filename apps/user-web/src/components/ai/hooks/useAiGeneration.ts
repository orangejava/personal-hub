import type {
  AiAsset,
  AiGenerationParams,
  AiGenerationTask,
  AiToolType,
} from '@personal-hub/shared-types';
import { App } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

function normalizeMediaParams(
  toolType: Extract<AiToolType, 'image' | 'video'>,
  params: AiGenerationParams,
): AiGenerationParams {
  if (toolType === 'video') {
    return { ...params, count: 1 };
  }
  const count = params.count ?? 1;
  return { ...params, count: Math.min(Math.max(count, 1), 4) as 1 | 2 | 4 };
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
    params: initialTask.params ?? {},
  });

  useEffect(() => {
    setAssets(initialAssets);
    setTask(initialTask);
    setDraft({
      title: initialTask.title,
      prompt: initialTask.prompt,
      modelId: initialTask.modelId,
      params: initialTask.params ?? {},
    });
  }, [initialAssets, initialTask]);

  const attachmentAssets = useMemo(
    () =>
      (draft.params.attachments ?? [])
        .map((assetId) => assets.find((asset) => asset.id === assetId))
        .filter((asset): asset is AiAsset => Boolean(asset)),
    [assets, draft.params.attachments],
  );

  const updateDraft = useCallback((patch: Partial<GenerationDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const updateParams = useCallback((patch: AiGenerationParams) => {
    setDraft((current) => ({
      ...current,
      params: { ...current.params, ...patch },
    }));
  }, []);

  const applyDraft = useCallback((nextDraft: Partial<GenerationDraft>) => {
    setDraft((current) => ({
      ...current,
      ...nextDraft,
      params: nextDraft.params ? { ...current.params, ...nextDraft.params } : current.params,
    }));
  }, []);

  const editAgain = useCallback(() => {
    setDraft({
      title: task.title,
      prompt: task.prompt,
      modelId: task.modelId,
      params: task.params ?? {},
    });
    message.info('已把本次输入回填到输入区');
  }, [message, task]);

  const regenerate = useCallback(async () => {
    setIsSavingAssets(true);
    try {
      const generate = toolType === 'image' ? generateAiImage : generateAiVideo;
      const normalizedDraft = {
        ...draft,
        params: normalizeMediaParams(toolType, draft.params),
      };
      const result = await generate({
        title: normalizedDraft.title,
        prompt: normalizedDraft.prompt,
        modelId: normalizedDraft.modelId,
        params: normalizedDraft.params,
      });
      const nextAssets = result.assets ?? [];
      const nextTask = result.task ?? createFallbackTask(toolType, normalizedDraft, 'done');
      setAssets(nextAssets);
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
      setAssets([]);
      setTask(createFallbackTask(toolType, draft, 'failed'));
      message.error(_error instanceof Error ? _error.message : '生成失败，请稍后重试');
      return undefined;
    } finally {
      setIsSavingAssets(false);
    }
  }, [draft, message, toolType]);

  const stop = useCallback(async () => {
    if (!task.id || task.status !== 'generating') {
      return;
    }
    try {
      const next = await cancelAiMediaJob(toolType, task.id);
      setTask(next);
      message.info('已请求停止当前任务');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '停止失败');
    }
  }, [message, task.id, task.status, toolType]);

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
