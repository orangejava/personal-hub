import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@umijs/max';
import { getAccessToken } from '@personal-hub/api-client';
import { consumeAiSse, fetchAiMessages } from './ai';

vi.mock('@umijs/max', () => ({ request: vi.fn() }));
vi.mock('@personal-hub/api-client', () => ({
  getAccessToken: vi.fn(),
  newIdempotencyKey: () => 'request-key',
}));

function mockStream(text: string) {
  const reader = {
    read: vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(text) })
      .mockResolvedValue({ done: true }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: { getReader: () => reader },
      }),
  );
  return reader;
}

describe('AI 传输边界', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('EOF 没有终态时显式失败，保留已收到的增量并关闭 reader', async () => {
    const reader = mockStream('data: {"type":"DELTA","content":"部分回答"}\n\n');
    const onEvent = vi.fn();
    await expect(consumeAiSse({ url: '/chat', body: {} }, onEvent)).rejects.toThrow('连接已中断');
    expect(onEvent).toHaveBeenCalledWith({ type: 'DELTA', content: '部分回答' });
    expect(reader.cancel).toHaveBeenCalled();
    expect(reader.releaseLock).toHaveBeenCalled();
  });

  it('无末尾空行的停止终态可以正常完成', async () => {
    mockStream('data: {"type":"DONE","status":"stopped"}');
    const onEvent = vi.fn();
    await consumeAiSse({ url: '/chat', body: {} }, onEvent);
    expect(onEvent).toHaveBeenCalledWith({ type: 'DONE', status: 'stopped' });
  });

  it('历史超过一页时读取下一游标，不截断末尾消息', async () => {
    vi.mocked(getAccessToken).mockReturnValue('token');
    vi.mocked(request)
      .mockResolvedValueOnce({ list: [{ id: 'first' }], hasMore: true, nextCursor: 'first' })
      .mockResolvedValueOnce({ list: [{ id: 'last' }], hasMore: false, nextCursor: null });
    expect(await fetchAiMessages('session')).toEqual([{ id: 'first' }, { id: 'last' }]);
    expect(request).toHaveBeenLastCalledWith('/api/v1/app/ai/sessions/session/messages', {
      params: { cursor: 'first' },
    });
  });
});
