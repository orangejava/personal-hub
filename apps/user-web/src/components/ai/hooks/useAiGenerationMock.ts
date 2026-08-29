import type {
  AiAsset,
  AiGenerationParams,
  AiGenerationTask,
  AiToolType,
} from '@personal-hub/shared-types';
import { App } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateAiImage, generateAiVideo } from '@/services/ai';

interface GenerationDraft {
  title: string;
  prompt: string;
  modelId: string;
  params: AiGenerationParams;
  simulateFailure: boolean;
}

interface UseAiGenerationMockOptions {
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
 * 图片 / 视频生成 mock 状态流。
 *
 * 用一个 hook 统一处理“再次编辑、重新生成、引用为附件”。生成结果通过
 * `/api/ai/image|video/generate` mock 契约返回，页面只负责展示状态流。
 */
export function useAiGenerationMock({
  toolType,
  initialAssets,
  initialTask,
}: UseAiGenerationMockOptions) {
  const { message } = App.useApp();
  const [assets, setAssets] = useState(initialAssets);
  const [task, setTask] = useState(initialTask);
  const [isSavingAssets, setIsSavingAssets] = useState(false);
  const [draft, setDraft] = useState<GenerationDraft>({
    title: initialTask.title,
    prompt: initialTask.prompt,
    modelId: initialTask.modelId,
    params: initialTask.params ?? {},
    simulateFailure: false,
  });

  useEffect(() => {
    setAssets(initialAssets);
    setTask(initialTask);
    setDraft({
      title: initialTask.title,
      prompt: initialTask.prompt,
      modelId: initialTask.modelId,
      params: initialTask.params ?? {},
      simulateFailure: false,
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
      simulateFailure: false,
    });
    message.info('已把本次输入和附件回填到输入区');
  }, [task]);

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
        simulateFailure: normalizedDraft.simulateFailure,
      });
      const nextAssets = result.data?.assets ?? [];
      const nextTask =
        result.data?.task ??
        createFallbackTask(
          toolType,
          normalizedDraft,
          normalizedDraft.simulateFailure ? 'failed' : 'done',
        );
      setAssets(nextAssets);
      setTask(nextTask);
      if (nextTask.status === 'failed') {
        message.error('已模拟生成失败，请调整参数后重试');
        return undefined;
      }
      message.success('已生成 mock 结果并保存到 AI 资产');
      return nextAssets;
    } catch (_error) {
      setAssets([]);
      setTask(createFallbackTask(toolType, draft, 'failed'));
      message.error('生成 mock 请求失败，请稍后重试');
      return undefined;
    } finally {
      setIsSavingAssets(false);
    }
  }, [draft, message, toolType]);

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
  }, []);

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
    useAsAttachment,
  };
}
