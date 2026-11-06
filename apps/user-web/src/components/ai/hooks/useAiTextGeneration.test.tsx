import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAiText } from '@/services/ai';
import { useAiTextGeneration } from './useAiTextGeneration';

vi.mock('@/services/ai', () => ({
  generateAiText: vi.fn(),
  stopAiMessage: vi.fn(),
}));

describe('文本重新生成', () => {
  beforeEach(() => vi.resetAllMocks());

  it('复用上次输入，但请求当前选择的模型并按上次输入估算额度', async () => {
    vi.mocked(generateAiText).mockResolvedValue({ output: '结果' } as never);
    const { result } = renderHook(() => useAiTextGeneration());
    act(() => result.current.updateDraft({ input: '原始问题'.repeat(30), modelId: 'paid', length: 'long' }));
    act(() => result.current.generate());
    await waitFor(() => expect(result.current.hasOutput).toBe(true));
    act(() => result.current.updateDraft({ input: '修改后的输入', modelId: 'free', length: 'short' }));
    expect(result.current.regenerateTokenEstimate).toBeGreaterThan(result.current.tokenEstimate);
    act(() => result.current.regenerate());
    await waitFor(() => expect(vi.mocked(generateAiText)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(generateAiText).mock.calls[1][0]).toMatchObject({
      input: '原始问题'.repeat(30), modelId: 'free', length: 'long',
    });
  });
});
