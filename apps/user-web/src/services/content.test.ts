import { beforeEach, describe, expect, it, vi } from 'vitest';
import { history, request } from '@umijs/max';
import { message, notification } from 'antd';
import { errorConfig } from '@/requestErrorConfig';
import { saveReadingProgress } from './content';

vi.mock('@umijs/max', () => ({
  request: vi.fn(),
  history: { replace: vi.fn(), location: { pathname: '/content/one', search: '', hash: '' } },
}));
vi.mock('antd', () => ({
  message: { error: vi.fn() },
  notification: { error: vi.fn() },
}));

describe('阅读进度请求', () => {
  beforeEach(() => vi.clearAllMocks());

  it('使用可在页面卸载时继续发送的 fetch PUT，保持原有请求契约', async () => {
    vi.mocked(request).mockResolvedValue(undefined);

    await saveReadingProgress({
      contentId: '00000000-0000-4000-8000-000000000001',
      percent: 42,
      updatedAt: '2026-10-20T00:00:00.000Z',
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/app/reading-records/00000000-0000-4000-8000-000000000001',
      {
        method: 'PUT',
        adapter: 'fetch',
        fetchOptions: { keepalive: true },
        skipErrorHandler: true,
        data: { contentProgressPercent: 42, chapterId: null },
      },
    );
  });

  it('后台同步收到 401 时仍拒绝 Promise，但不触发全局跳转或提示', async () => {
    const unauthorized = Object.assign(new Error('Unauthorized'), {
      response: { status: 401 },
    });
    vi.mocked(request).mockRejectedValue(unauthorized);

    await expect(saveReadingProgress({
      contentId: '00000000-0000-4000-8000-000000000001',
      percent: 42,
      updatedAt: '2026-10-20T00:00:00.000Z',
    })).rejects.toBe(unauthorized);
    const options = (vi.mocked(request).mock.calls.at(-1) as unknown as [string, object])[1];
    const handleError = errorConfig.errorConfig?.errorHandler;
    expect(handleError).toBeDefined();
    expect(() => handleError?.(unauthorized, options)).toThrow(unauthorized);
    expect(history.replace).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(notification.error).not.toHaveBeenCalled();
  });
});
