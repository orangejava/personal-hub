import { renderHook } from '@testing-library/react';
import type { AiModel, AiUserProviderState } from '@personal-hub/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRequest } from '@/hooks/useRequest';
import { fetchAiModels, fetchAiUserProviders } from '@/services/ai';
import { useAiAvailableModels } from './useAiAvailableModels';

vi.mock('@/hooks/useRequest', () => ({ useRequest: vi.fn() }));
vi.mock('@/services/ai', () => ({
  fetchAiModels: vi.fn(), fetchAiUserProviders: vi.fn(), isLoggedIn: () => true,
}));

function setResponses(models: AiModel[], providerState: AiUserProviderState) {
  vi.mocked(useRequest).mockImplementation((service) =>
    ({ data: service === fetchAiModels ? models : providerState, loading: false }) as never,
  );
}

const providerState: AiUserProviderState = {
  allowed: true, enabled: true, userCanPickModel: true, userKeyConsumesQuota: false,
  preferredUserModelId: null, credentials: [], models: [],
};

describe('自备模型可用状态', () => {
  beforeEach(() => vi.resetAllMocks());

  it('管理员暂停自备时阻止 Chat，个人关闭后恢复系统模型', () => {
    const systemModel: AiModel = {
      id: 'system', name: 'System', provider: 'Provider', enabled: true,
      toolTypes: ['chat'], blockedToolTypes: ['chat'], requiresPlatformQuota: true,
    };
    setResponses([systemModel], { ...providerState, allowed: false });
    const { result, rerender } = renderHook(() => useAiAvailableModels({ toolType: 'chat' }));
    expect(result.current.providerPaused).toBe(true);
    expect(result.current.hasModels).toBe(false);
    expect(result.current.options).toEqual([]);

    setResponses([{ ...systemModel, blockedToolTypes: undefined }], {
      ...providerState, allowed: false, enabled: false,
    });
    rerender();
    expect(result.current.providerPaused).toBe(false);
    expect(result.current.hasModels).toBe(true);
    expect(result.current.defaultModel?.id).toBe('system');
  });

  it('没有系统目录时仍识别已停用的自建模型凭据', () => {
    setResponses([], {
      ...providerState,
      credentials: [{ id: 'credential', providerId: null, code: 'mine', label: 'Mine',
        baseUrl: 'https://example.com/v1', enabled: false, hasKey: true, userModels: [] }],
      models: [{ id: 'old-model', credentialId: 'credential', modelKey: 'mine',
        displayName: 'Mine', enabled: true }],
    });
    const { result } = renderHook(() => useAiAvailableModels({ toolType: 'chat', value: 'old-model' }));
    expect(result.current.hasModels).toBe(false);
    expect(result.current.providerNeedsCredential).toBe(true);
    expect(result.current.providerNeedsCustomCredential).toBe(true);
  });

  it('系统模型缺 Key 时仍使用系统凭据提示', () => {
    setResponses([{
      id: 'system', name: 'System', provider: 'Provider', enabled: true,
      toolTypes: ['chat'], blockedToolTypes: ['chat'],
    }], providerState);
    const { result } = renderHook(() => useAiAvailableModels({ toolType: 'chat' }));
    expect(result.current.providerNeedsCredential).toBe(true);
    expect(result.current.providerNeedsCustomCredential).toBe(false);
  });

  it('原厂商被删除且模型保留时仍指出自建配置问题', () => {
    setResponses([], {
      ...providerState,
      models: [{ id: 'old-model', credentialId: null, modelKey: 'mine',
        displayName: 'Mine', enabled: true }],
    });
    const { result } = renderHook(() => useAiAvailableModels({ toolType: 'chat', value: 'old-model' }));
    expect(result.current.providerNeedsCredential).toBe(true);
    expect(result.current.providerNeedsCustomCredential).toBe(true);
  });

  it('没有任何用户模型或系统模型时不误报缺凭据', () => {
    setResponses([], providerState);
    const { result } = renderHook(() => useAiAvailableModels({ toolType: 'chat' }));
    expect(result.current.providerNeedsCredential).toBe(false);
  });
});
