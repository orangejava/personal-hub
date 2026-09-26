import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { streamAiChat } from '@/services/ai';
import { useAiChat } from './useAiChat';

vi.mock('@/services/ai', () => ({
  streamAiChat: vi.fn(),
  regenerateAiMessage: vi.fn(),
  stopAiMessage: vi.fn(),
}));

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const USER_MESSAGE_ID = '00000000-0000-4000-8000-000000000002';
const ASSISTANT_MESSAGE_ID = '00000000-0000-4000-8000-000000000003';

describe('useAiChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('首次创建会话绑定真实 ID 时不会取消刚启动的消息流', async () => {
    let requestAborted = false;
    vi.mocked(streamAiChat).mockImplementation(async ({ signal, onEvent }) => {
      signal?.addEventListener('abort', () => {
        requestAborted = true;
      });
      await Promise.resolve();
      onEvent({
        type: 'STARTED',
        sessionId: SESSION_ID,
        userMessageId: USER_MESSAGE_ID,
        assistantMessageId: ASSISTANT_MESSAGE_ID,
      });
      onEvent({ type: 'DELTA', content: '正常回复' });
      onEvent({ type: 'DONE', usage: { inputTokens: 2, outputTokens: 3 } });
    });

    const { result } = renderHook(() => {
      const [sessionId, setSessionId] = useState<string>();
      return useAiChat({
        initialMessages: [],
        sessionId,
        ensureSession: async () => {
          setSessionId(SESSION_ID);
          return SESSION_ID;
        },
      });
    });

    await act(async () => {
      await result.current.sendMessage('第一次提问');
    });

    await waitFor(() => {
      expect(result.current.messages.at(-1)?.content).toBe('正常回复');
      expect(result.current.isGenerating).toBe(false);
    });
    expect(requestAborted).toBe(false);
    expect(streamAiChat).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID, content: '第一次提问' }),
    );
  });

  it('切换到另一条已有会话时仍会取消旧消息流', async () => {
    let requestAborted = false;
    vi.mocked(streamAiChat).mockImplementation(
      ({ signal }) =>
        new Promise<void>((resolve) => {
          signal?.addEventListener('abort', () => {
            requestAborted = true;
            resolve();
          });
        }),
    );

    const { result, rerender } = renderHook(
      ({ sessionId }) => useAiChat({ initialMessages: [], sessionId }),
      { initialProps: { sessionId: SESSION_ID } },
    );
    await act(async () => {
      void result.current.sendMessage('尚未完成的提问');
      await Promise.resolve();
    });

    rerender({ sessionId: '00000000-0000-4000-8000-000000000004' });

    expect(requestAborted).toBe(true);
    expect(result.current.messages).toEqual([]);
    expect(result.current.isGenerating).toBe(false);
  });
});
