import type { AiConversation } from '@personal-hub/shared-types';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createAiSession, deleteAiSession } from '@/services/ai';
import { useAiChatSessions } from './useAiChatSessions';

vi.mock('@/services/ai', () => ({
  createAiSession: vi.fn(),
  deleteAiSession: vi.fn(),
  updateAiSession: vi.fn(),
}));

describe('useAiChatSessions', () => {
  it('异步创建完成后不覆盖用户随后选择的会话', async () => {
    const firstId = '00000000-0000-4000-8000-000000000001';
    const secondId = '00000000-0000-4000-8000-000000000002';
    const createdId = '00000000-0000-4000-8000-000000000003';
    let resolveCreate!: (session: AiConversation) => void;
    vi.mocked(createAiSession).mockImplementation(
      () =>
        new Promise<AiConversation>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const sessions = [{ id: firstId }, { id: secondId }] as AiConversation[];
    const { result } = renderHook(() =>
      useAiChatSessions({
        initialSessions: sessions,
        initialMessages: [],
      }),
    );

    let creating!: Promise<string>;
    await act(async () => {
      creating = result.current.createNewSession();
    });
    act(() => result.current.setActiveSessionId(secondId));
    await act(async () => {
      resolveCreate({ id: createdId } as AiConversation);
      expect(await creating).toBe(createdId);
    });

    expect(result.current.currentSessionId).toBe(secondId);
    expect(result.current.sessions.some((session) => session.id === createdId)).toBe(true);
  });

  it('首屏旧列表迟到时保留本页新建的会话', async () => {
    const createdId = '00000000-0000-4000-8000-000000000003';
    vi.mocked(createAiSession).mockResolvedValue({ id: createdId } as AiConversation);
    const { result, rerender } = renderHook(
      ({ initialSessions }) => useAiChatSessions({ initialSessions, initialMessages: [] }),
      { initialProps: { initialSessions: [] as AiConversation[] } },
    );
    await act(async () => {
      await result.current.createNewSession();
    });
    rerender({
      initialSessions: [{ id: '00000000-0000-4000-8000-000000000001' }] as AiConversation[],
    });

    expect(result.current.currentSessionId).toBe(createdId);
    expect(result.current.sessions.map((session) => session.id)).toContain(createdId);
  });

  it('路由指定会话的列表迟到时不覆盖用户手动切换', () => {
    const requestedId = '00000000-0000-4000-8000-000000000001';
    const selectedId = '00000000-0000-4000-8000-000000000002';
    const { result, rerender } = renderHook(
      ({ initialSessions }) =>
        useAiChatSessions({
          initialSessions,
          initialMessages: [],
          initialSessionId: requestedId,
        }),
      { initialProps: { initialSessions: [] as AiConversation[] } },
    );
    act(() => result.current.setActiveSessionId(selectedId));
    rerender({ initialSessions: [{ id: requestedId }, { id: selectedId }] as AiConversation[] });

    expect(result.current.currentSessionId).toBe(selectedId);
  });
  it('删除失败保留会话和消息，成功后迟到列表不能复活会话', async () => {
    const initialSessions = [{ id: 'first' }, { id: 'second' }] as AiConversation[];
    vi.mocked(deleteAiSession)
      .mockRejectedValueOnce(new Error('生成中'))
      .mockResolvedValueOnce({ id: 'first', deleted: true });
    const { result, rerender } = renderHook(
      ({ sessions }) => useAiChatSessions({ initialSessions: sessions, initialMessages: [] }),
      { initialProps: { sessions: initialSessions } },
    );
    await act(async () => {
      await expect(result.current.deleteSession('first')).rejects.toThrow('生成中');
    });
    expect(result.current.currentSessionId).toBe('first');
    expect(result.current.sessions).toHaveLength(2);
    await act(async () => {
      await result.current.deleteSession('first');
    });
    rerender({ sessions: [...initialSessions] });
    expect(result.current.sessions.map((s) => s.id)).toEqual(['second']);
  });

  it('手动选择之后仍响应真正的 URL 会话变更', () => {
    const initialSessions = [
      { id: 'first' },
      { id: 'second' },
      { id: 'third' },
    ] as AiConversation[];
    const { result, rerender } = renderHook(
      ({ id }) => useAiChatSessions({ initialSessions, initialMessages: [], initialSessionId: id }),
      { initialProps: { id: 'first' } },
    );
    act(() => result.current.setActiveSessionId('second'));
    rerender({ id: 'third' });
    expect(result.current.currentSessionId).toBe('third');
  });
});
