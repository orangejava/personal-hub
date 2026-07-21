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
      const res = await fetchAiHome();
      const home = res.data;
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
      const res = await fetchAiMembership();
      const data = res.data;
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
   * 消耗 AI Token 并同步运行时余额。
   *
   * 阶段 5 仍是 mock 扣减，但入口集中在 model，页面无需关心真实接口后续怎么换。
   */
  const consumeQuota = useCallback(
    async (input: AiQuotaConsumeInput) => {
      const res = await consumeAiQuota(input);
      if (res.data?.quota) {
        updateRuntimeConfig({ quota: res.data.quota });
      }
      return res.data;
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
