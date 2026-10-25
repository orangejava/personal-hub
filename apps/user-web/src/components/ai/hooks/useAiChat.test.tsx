import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiMessage } from '@personal-hub/shared-types';
import { streamAiChat, stopAiMessage, regenerateAiMessage, type SsePayload } from '@/services/ai';
import { useAiChatSessions } from './useAiChatSessions';
import { useAiChat } from './useAiChat';

vi.mock('@/services/ai', () => ({
  streamAiChat: vi.fn(),
  regenerateAiMessage: vi.fn(),
  stopAiMessage: vi.fn(),
  createAiSession: vi.fn(),
  deleteAiSession: vi.fn(),
  updateAiSession: vi.fn(),
}));

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const USER_MESSAGE_ID = '00000000-0000-4000-8000-000000000002';
const ASSISTANT_MESSAGE_ID = '00000000-0000-4000-8000-000000000003';

describe('useAiChat', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(stopAiMessage).mockResolvedValue({} as never);
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

  it('父页面尚未更新会话 ID 时，首次发送立即显示临时消息', async () => {
    vi.mocked(streamAiChat).mockImplementation(() => new Promise<void>(() => undefined));
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId?: string }) =>
        useAiChat({
          initialMessages: [],
          sessionId,
          ensureSession: async () => SESSION_ID,
        }),
      { initialProps: { sessionId: undefined as string | undefined } },
    );

    await act(async () => {
      expect(await result.current.sendMessage('第一次提问')).toBe(true);
    });
    expect(result.current.messages).toEqual([
      expect.objectContaining({ sessionId: SESSION_ID, role: 'user', content: '第一次提问' }),
      expect.objectContaining({ sessionId: SESSION_ID, role: 'assistant', status: 'generating' }),
    ]);

    rerender({ sessionId: SESSION_ID });
    expect(result.current.messages[0]).toMatchObject({ content: '第一次提问' });
  });

  it('切换到另一条已有会话时旧流继续写入原会话', async () => {
    let requestAborted = false;
    let emit!: (event: { type: 'DELTA' | 'DONE'; content?: string }) => void;
    const onMessagesChange = vi.fn();
    vi.mocked(streamAiChat).mockImplementation(
      ({ signal, onEvent }) =>
        new Promise<void>((resolve) => {
          emit = (event) => {
            onEvent(event);
            if (event.type === 'DONE') resolve();
          };
          signal?.addEventListener('abort', () => {
            requestAborted = true;
            resolve();
          });
        }),
    );

    const { result, rerender } = renderHook(
      ({ sessionId }) => useAiChat({ initialMessages: [], sessionId, onMessagesChange }),
      { initialProps: { sessionId: SESSION_ID } },
    );
    await act(async () => {
      void result.current.sendMessage('尚未完成的提问');
      await Promise.resolve();
    });

    rerender({ sessionId: '00000000-0000-4000-8000-000000000004' });

    expect(requestAborted).toBe(false);
    expect(result.current.messages).toEqual([]);
    expect(result.current.isCreatingSession).toBe(false);
    expect(result.current.isGenerating).toBe(false);
    await act(async () => {
      emit({ type: 'DELTA', content: '原会话回复' });
      emit({ type: 'DONE' });
    });
    rerender({ sessionId: SESSION_ID });
    await waitFor(() => expect(result.current.messages.at(-1)?.content).toBe('原会话回复'));
    expect(requestAborted).toBe(false);
  });

  it('最多允许三条会话同时生成，完成后释放名额', async () => {
    const pending = new Map<string, (event: { type: 'DONE' }) => void>();
    vi.mocked(streamAiChat).mockImplementation(
      ({ sessionId, onEvent }) =>
        new Promise<void>((resolve) => {
          if (sessionId) {
            pending.set(sessionId, (event) => {
              onEvent(event);
              resolve();
            });
          }
        }),
    );
    const ids = [
      SESSION_ID,
      '00000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000006',
    ];
    const { result, rerender } = renderHook(
      ({ sessionId }) => useAiChat({ initialMessages: [], sessionId }),
      { initialProps: { sessionId: ids[0] } },
    );
    for (const id of ids.slice(0, 3)) {
      rerender({ sessionId: id });
      await act(async () => expect(await result.current.sendMessage(id)).toBe(true));
    }
    rerender({ sessionId: ids[3] });
    await act(async () => {
      await expect(result.current.sendMessage('第四条')).rejects.toThrow('最多同时生成 3 条对话');
    });
    expect(streamAiChat).toHaveBeenCalledTimes(3);

    const firstFinish = pending.get(ids[0]);
    expect(firstFinish).toBeDefined();
    await act(async () => firstFinish?.({ type: 'DONE' }));
    await waitFor(() => expect(result.current.isSessionGenerating(ids[0])).toBe(false));
    await act(async () => expect(await result.current.sendMessage('第四条')).toBe(true));
    expect(streamAiChat).toHaveBeenCalledTimes(4);
  });

  it('STARTED 前停止会在取得 ID 后请求服务端，终态前不释放名额且不影响后台会话', async () => {
    const emitters = new Map<string, (event: SsePayload) => void>();
    vi.mocked(streamAiChat).mockImplementation(
      ({ sessionId, onEvent }) =>
        new Promise<void>(() => {
          if (sessionId) emitters.set(sessionId, onEvent);
        }),
    );
    const { result, rerender } = renderHook(
      ({ sessionId }) => useAiChat({ initialMessages: [], sessionId }),
      { initialProps: { sessionId: SESSION_ID } },
    );
    await act(async () => {
      await result.current.sendMessage('A');
    });
    rerender({ sessionId: 'second' });
    await act(async () => {
      await result.current.sendMessage('B');
    });
    act(() => result.current.stopGenerating());
    expect(stopAiMessage).not.toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(true);
    act(() =>
      emitters.get('second')?.({ type: 'STARTED', assistantMessageId: ASSISTANT_MESSAGE_ID }),
    );
    expect(stopAiMessage).toHaveBeenCalledWith(ASSISTANT_MESSAGE_ID);
    act(() => emitters.get('second')?.({ type: 'DONE', status: 'stopped' }));
    expect(result.current.messages.at(-1)?.status).toBe('stopped');
    expect(result.current.isSessionGenerating(SESSION_ID)).toBe(true);
    expect(result.current.isGenerating).toBe(false);
  });

  it('首次建会话失败会反馈错误且允许重试，不会发起流请求', async () => {
    const ensureSession = vi
      .fn()
      .mockRejectedValueOnce(new Error('会话创建失败'))
      .mockResolvedValue(SESSION_ID);
    vi.mocked(streamAiChat).mockResolvedValue();
    const { result } = renderHook(() => useAiChat({ initialMessages: [], ensureSession }));

    await act(async () => {
      await expect(result.current.sendMessage('手机提问')).rejects.toThrow('会话创建失败');
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.isGenerating).toBe(false);
    expect(streamAiChat).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.sendMessage('手机提问')).toBe(true);
    });
    expect(ensureSession).toHaveBeenCalledTimes(2);
    expect(streamAiChat).toHaveBeenCalledTimes(1);
  });

  it('建会话期间切换视图，创建完成后仍将发送绑定原会话', async () => {
    let resolveSession!: (id: string) => void;
    const onMessagesChange = vi.fn();
    const ensureSession = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveSession = resolve;
        }),
    );
    vi.mocked(streamAiChat).mockResolvedValue();
    const { result, rerender } = renderHook(
      ({ sessionId }) =>
        useAiChat({ initialMessages: [], sessionId, ensureSession, onMessagesChange }),
      { initialProps: { sessionId: 'pending-session' } },
    );
    let sending!: Promise<boolean>;
    await act(async () => {
      sending = result.current.sendMessage('原会话的问题');
    });
    rerender({ sessionId: '00000000-0000-4000-8000-000000000004' });
    await act(async () => {
      resolveSession(SESSION_ID);
      expect(await sending).toBe(true);
    });
    expect(streamAiChat).toHaveBeenCalledWith(expect.objectContaining({ sessionId: SESSION_ID }));
    expect(onMessagesChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ content: '原会话的问题', sessionId: SESSION_ID }),
      ]),
      SESSION_ID,
    );
    expect(result.current.messages).toEqual([]);
  });

  it('等待建会话时重复发送只创建一条会话', async () => {
    let resolveSession!: (id: string) => void;
    const ensureSession = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveSession = resolve;
        }),
    );
    vi.mocked(streamAiChat).mockResolvedValue();
    const { result } = renderHook(() => useAiChat({ initialMessages: [], ensureSession }));

    await act(async () => {
      const first = result.current.sendMessage('第一次提问');
      expect(await result.current.sendMessage('重复提问')).toBe(false);
      resolveSession(SESSION_ID);
      expect(await first).toBe(true);
    });
    expect(ensureSession).toHaveBeenCalledTimes(1);
    expect(streamAiChat).toHaveBeenCalledTimes(1);
  });
  it('发送被拒后历史同步和切换仍保留问题与错误，过期快照不能覆盖新消息', async () => {
    const history = [
      {
        id: 'old',
        sessionId: SESSION_ID,
        role: 'assistant',
        content: '旧回答',
        status: 'done',
        createdAt: '2026-10-16T00:00:00Z',
      },
    ] as AiMessage[];
    const initialSessions = [{ id: SESSION_ID }, { id: 'other' }] as never;
    vi.mocked(streamAiChat).mockRejectedValue(new Error('并发已达上限'));
    const { result } = renderHook(() => {
      const sessions = useAiChatSessions({ initialSessions, initialMessages: history });
      const chat = useAiChat({
        initialMessages: sessions.currentMessages,
        sessionId: sessions.currentSessionId,
        onMessagesChange: (messages, id) => sessions.updateMessagesForSession(id, messages),
      });
      return { ...chat, select: sessions.setActiveSessionId };
    });
    const staleRevision = result.current.getSessionRevision(SESSION_ID);
    await act(async () => {
      await result.current.sendMessage('不能丢的问题');
    });
    act(() => result.current.applyHistory(SESSION_ID, history, staleRevision));
    act(() =>
      result.current.applyHistory(
        SESSION_ID,
        history,
        result.current.getSessionRevision(SESSION_ID),
      ),
    );
    act(() => result.current.select('other'));
    act(() => result.current.select(SESSION_ID));
    expect(result.current.messages.map((m) => m.content)).toEqual([
      '旧回答',
      '不能丢的问题',
      '并发已达上限',
    ]);
    expect(result.current.isGenerating).toBe(false);
  });

  it('旧 generating 快照不会覆盖停止终态，服务端只有内容变化也能同步', () => {
    const stopped = {
      id: ASSISTANT_MESSAGE_ID,
      sessionId: SESSION_ID,
      role: 'assistant',
      content: '部分回答',
      status: 'stopped',
      createdAt: '2026-10-16T00:00:00Z',
    } as AiMessage;
    const { result, rerender } = renderHook(
      ({ initialMessages }) => useAiChat({ initialMessages, sessionId: SESSION_ID }),
      { initialProps: { initialMessages: [stopped] } },
    );
    act(() =>
      result.current.applyHistory(
        SESSION_ID,
        [{ ...stopped, status: 'generating', content: '' }],
        0,
      ),
    );
    expect(result.current.messages[0]).toEqual(stopped);
    rerender({ initialMessages: [{ ...stopped, content: '服务端最终内容' }] });
    expect(result.current.messages[0].content).toBe('服务端最终内容');
  });

  it('建会话期间离开页面，异步返回后不启动后台流', async () => {
    let resolve!: (id: string) => void;
    const ensureSession = () =>
      new Promise<string>((done) => {
        resolve = done;
      });
    const { result, unmount } = renderHook(() => useAiChat({ initialMessages: [], ensureSession }));
    let sending!: Promise<boolean>;
    act(() => {
      sending = result.current.sendMessage('离页问题');
    });
    unmount();
    resolve(SESSION_ID);
    expect(await sending).toBe(false);
    expect(streamAiChat).not.toHaveBeenCalled();
  });

  it('重新生成在 STARTED 前失败仍保留原回答且释放名额', async () => {
    const original = {
      id: ASSISTANT_MESSAGE_ID,
      sessionId: SESSION_ID,
      role: 'assistant',
      content: '不能丢的原回答',
      status: 'done',
      createdAt: '2026-10-16T00:00:00Z',
    } as AiMessage;
    vi.mocked(regenerateAiMessage).mockRejectedValue(new Error('额度不足'));
    const { result } = renderHook(() =>
      useAiChat({ initialMessages: [original], sessionId: SESSION_ID }),
    );
    await act(async () => {
      result.current.regenerate(original.id);
    });
    expect(result.current.messages[0].content).toBe(original.content);
    expect(result.current.isGenerating).toBe(false);
  });
});
