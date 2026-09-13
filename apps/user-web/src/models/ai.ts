import type {
  AiQuotaConsumeInput,
  AiMembershipData,
  AiNavigationItem,
  AiQuotaSummary,
  AiTool,
} from '@personal-hub/shared-types';
import { useCallback, useState } from 'react';
import {
  consumeAiQuota,
  fetchAiHome,
  fetchAiMembership,
  fetchAiNavigation,
} from '@/services/ai';

/**
 * 导航缓存在模块级，不跟某个 layout 实例走。
 * AI 页都是 layout:false，切页会重挂 AiLayout；如果缓存只放 hook ref，看起来就会反复打接口。
 * 后台改完导航，用户切回前台后再过 STALE 才会静默复验，不轮询。
 */
const NAVIGATION_STALE_MS = 2 * 60 * 1000;
const navigationCache: { data?: AiNavigationItem[]; fetchedAt: number } = {
  fetchedAt: 0,
};

interface AiRuntimeConfig {
  brandName: string;
  quota?: AiQuotaSummary;
  currentPlanName?: string;
  tools?: AiTool[];
}

/**
 * AI 工作台 model。
 *
 * 用于缓存 AI 品牌名、Token 余额、工具状态和当前会员套餐，避免这些横跨
 * AI Layout / 会员中心 / 后台配置的数据散落在各页面本地状态里。
 */
export default function AiModel() {
  const [runtimeConfig, setRuntimeConfig] = useState<AiRuntimeConfig>({
    brandName: 'Personal Hub AI',
  });
  const [membership, setMembership] = useState<AiMembershipData>();
  const [navigation, setNavigation] = useState<AiNavigationItem[] | undefined>(
    navigationCache.data,
  );
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
        currentPlanName: home.entitlement?.currentPlanName,
      });
      return home;
    } finally {
      setLoading(false);
    }
  }, [updateRuntimeConfig]);

  /** 拉取会员中心数据，并同步当前套餐与余额。 */
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
   * 读取 AI 侧栏导航。新鲜缓存直接复用；过期后才请求，避免对话页连打。
   */
  const loadNavigation = useCallback(async (force = false) => {
    const cached = navigationCache.data;
    const fresh =
      cached && Date.now() - navigationCache.fetchedAt < NAVIGATION_STALE_MS;
    if (!force && fresh) {
      setNavigation(cached);
      return cached;
    }
    const data = await fetchAiNavigation();
    navigationCache.data = data;
    navigationCache.fetchedAt = Date.now();
    setNavigation(data);
    return data;
  }, []);

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
    navigation,
    loading,
    setMembership,
    updateRuntimeConfig,
    loadHomeConfig,
    loadMembership,
    loadNavigation,
    consumeQuota,
  };
}
