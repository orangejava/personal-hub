import type { AiModel, AiToolType } from '@personal-hub/shared-types';
import { useRequest } from '@umijs/max';
import { useEffect, useMemo } from 'react';
import { fetchAiModels } from '@/services/ai';

interface UseAiAvailableModelsOptions {
  toolType: Extract<AiToolType, 'chat' | 'text' | 'image' | 'video'>;
  value?: string;
  onDefaultModel?: (modelId: string) => void;
}

/**
 * 读取当前用户可见的 AI 模型，并按工具类型过滤。
 *
 * 页面层不再硬编码模型列表，后续后台禁用模型或调整用户可见范围时，
 * 只要 `/api/ai/models` 返回变化，用户端下拉就会自动同步。
 */
export function useAiAvailableModels({
  toolType,
  value,
  onDefaultModel,
}: UseAiAvailableModelsOptions) {
  const { data, loading, error } = useRequest(fetchAiModels);

  const models = useMemo(
    () =>
      (data ?? []).filter(
        (model): model is AiModel =>
          model.enabled && model.toolTypes.includes(toolType),
      ),
    [data, toolType],
  );

  const defaultModel = useMemo(
    () => models.find((model) => model.isDefault) ?? models[0],
    [models],
  );

  useEffect(() => {
    if (!defaultModel) return;
    if (value && models.some((model) => model.id === value)) return;
    onDefaultModel?.(defaultModel.id);
  }, [defaultModel, models, onDefaultModel, value]);

  const options = useMemo(
    () =>
      models.map((model) => ({
        label: `${model.name} · ${model.provider}`,
        value: model.id,
      })),
    [models],
  );

  return {
    models,
    options,
    loading,
    error,
    defaultModel,
    hasModels: models.length > 0,
  };
}
