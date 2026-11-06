import type { AiModel, AiToolType } from '@personal-hub/shared-types';
import { useRequest } from '@/hooks/useRequest';

import { useEffect, useMemo } from 'react';
import { fetchAiModels, fetchAiUserProviders, isLoggedIn } from '@/services/ai';

interface UseAiAvailableModelsOptions {
  toolType: Extract<AiToolType, 'chat' | 'text' | 'image' | 'video'>;
  value?: string;
  onDefaultModel?: (modelId: string) => void;
  /** 文本/新任务允许纠正已删除的旧默认值；历史会话则保留不可用提示。 */
  replaceUnavailableValue?: boolean;
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
  replaceUnavailableValue = false,
}: UseAiAvailableModelsOptions) {
  const { data, loading, error } = useRequest(fetchAiModels);
  const textTool = toolType === 'chat' || toolType === 'text';
  const needsProviderState = textTool && isLoggedIn();
  // 暂停是账号状态，不能只从模型行推导：没有可见模型时仍须显示恢复指引。
  const { data: providerState, loading: providerLoading, error: providerError } = useRequest(
    fetchAiUserProviders,
    { ready: needsProviderState },
  );

  const models = useMemo(
    () =>
      (data ?? []).filter(
        (model): model is AiModel =>
          model.enabled && model.toolTypes.includes(toolType) && !model.blockedToolTypes?.includes(toolType),
      ),
    [data, toolType],
  );

  const defaultModel = useMemo(
    () =>
      models.find((model) =>
        model.defaultToolTypes ? model.defaultToolTypes.includes(toolType) : model.isDefault,
      ) ?? models[0],
    [models, toolType],
  );

  useEffect(() => {
    if (!defaultModel) return;
    const valueIsAvailable = Boolean(value && models.some((model) => model.id === value));
    if (valueIsAvailable) return;
    if (value && !replaceUnavailableValue) return;
    onDefaultModel?.(defaultModel.id);
  }, [defaultModel, models, onDefaultModel, replaceUnavailableValue, value]);

  const options = useMemo(
    () =>
      models.map((model) => ({
        label: `${model.name} · ${model.provider}`,
        value: model.id,
      })),
    [models],
  );

  // 系统目录可能为空；自建模型的凭据失效也要给出本人可执行的恢复指引。
  const providerNeedsCustomCredential = Boolean(
    providerState?.enabled &&
      providerState.allowed &&
      models.length === 0 &&
      providerState.models.some((model) => {
        if (!model.enabled) return false;
        const credential = providerState.credentials.find((row) => row.id === model.credentialId);
        return !credential?.enabled || !credential.baseUrl;
      }),
  );

  return {
    models,
    options,
    loading: loading || providerLoading,
    error: error ?? providerError,
    defaultModel,
    hasModels: models.length > 0 && (!needsProviderState || Boolean(providerState)),
    providerPaused: Boolean(providerState?.enabled && !providerState.allowed),
    providerNeedsCustomCredential,
    providerNeedsCredential: Boolean(
      providerState?.enabled &&
      providerState.allowed &&
      models.length === 0 &&
      ((data ?? []).some((model) => model.blockedToolTypes?.includes(toolType)) ||
        providerNeedsCustomCredential),
    ),
  };
}
