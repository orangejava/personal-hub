import type {
  AiQuotaConsumeInput,
  AiMembershipData,
  AiQuotaSummary,
  AiTool,
} from '@personal-hub/shared-types';
import { useCallback, useState } from 'react';
import { consumeAiQuota, fetchAiHome, fetchAiMembership } from '@/services/ai';

interface AiRuntimeConfig {
  brandName: string;
  quota?: AiQuotaSummary;
  currentPlanName?: string;
  tools?: AiTool[];
}

/**
 * AI 工作台 model。
 *
 * 用于缓存阶段 5 的 AI 品牌名、Token 余额、工具状态和当前会员套餐，避免这些横跨
 * AI Layout / 会员中心 / 后续后台配置的数据散落在各页面本地状态里。
 */
export default function AiModel() {
  const [runtimeConfig, setRuntimeConfig] = useState<AiRuntimeConfig>({
    brandName: 'Personal Hub AI',
  });
  const [membership, setMembership] = useState<AiMembershipData>();
  const [loading, setLoading] = useState(false);

  const updateRuntimeConfig = useCallback((patch: Partial<AiRuntimeConfig>) => {
    setRuntimeConfig((current) => ({ ...current, ...patch }));
  }, []);

  /** 拉取 AI 首页配置，主要用于同步品牌名和 Token 余额。 */
  const loadHomeConfig = useCallback(async () => {
    setLoading(true);
    try {
      const home = await fetchAiHome();
      updateRuntimeConfig({
        brandName: home.brandName,
        quota: home.quota,
        tools: home.tools,
      });
      return home;
    } finally {
      setLoading(false);
    }
  }, [updateRuntimeConfig]);

  /** 拉取会员中心 mock 数据，并同步当前套餐与余额。 */
  const loadMembership = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAiMembership();
      setMembership(data);
      updateRuntimeConfig({
        quota: data.quota,
        currentPlanName: data.currentPlanName,
      });
      return data;
    } finally {
      setLoading(false);
    }
  }, [updateRuntimeConfig]);

  /**
   * 刷新 AI Token 摘要到运行时。
   *
   * 真正扣减在 Nest 预占/结算；这里只同步首页余额展示。
   */
  const consumeQuota = useCallback(
    async (input: AiQuotaConsumeInput) => {
      const res = await consumeAiQuota(input);
      if (res.quota) {
        updateRuntimeConfig({ quota: res.quota });
      }
      return res;
    },
    [updateRuntimeConfig],
  );

  return {
    runtimeConfig,
    membership,
    loading,
    setMembership,
    updateRuntimeConfig,
    loadHomeConfig,
    loadMembership,
    consumeQuota,
  };
}
