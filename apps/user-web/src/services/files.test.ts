import { request } from '@umijs/max';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadAppFile, type AppUploadSession } from './files';

vi.mock('@umijs/max', () => ({ request: vi.fn() }));
vi.mock('@/services/auth', () => ({
  nestError: (error: { response?: { data?: { error?: { code?: string } } } }) =>
    error.response?.data?.error ?? {},
}));

const requestMock = vi.mocked(request);

function uploadSession(uploadId: string): AppUploadSession {
  return {
    uploadId,
    fileId: `file-${uploadId}`,
    mode: 'SINGLE',
    objectKey: `object-${uploadId}`,
    uploadUrl: `https://example.test/${uploadId}`,
    multipartUploadId: null,
    partSize: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

function uploadError(code: string) {
  return { response: { data: { error: { code } } } };
}

describe('uploadAppFile 会话恢复', () => {
  beforeEach(() => {
    sessionStorage.clear();
    requestMock.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('缓存会话过期后改用新幂等键创建会话并完成上传', async () => {
    const file = new File(['pdf'], 'renew.pdf', {
      type: 'application/pdf',
      lastModified: 123,
    });
    const attemptKey = `ph-upload:CONTENT_FILE:${file.name}:${file.size}:${file.lastModified}`;
    sessionStorage.setItem(
      attemptKey,
      JSON.stringify({
        createKey: 'stale-create-key',
        completeKey: 'stale-complete-key',
        session: uploadSession('old-upload'),
      }),
    );
    requestMock.mockImplementation(async (url) => {
      if (url === '/api/v1/app/uploads/old-upload/renew') throw uploadError('UPLOAD_EXPIRED');
      if (url === '/api/v1/app/uploads') return uploadSession('new-upload');
      if (url === '/api/v1/app/uploads/new-upload/renew') return uploadSession('new-upload');
      if (url === '/api/v1/app/uploads/new-upload/complete') return { id: 'ready-file' };
      throw new Error(`意外请求：${url}`);
    });

    await expect(uploadAppFile(file, 'CONTENT_FILE')).resolves.toMatchObject({ id: 'ready-file' });
    const createCall = requestMock.mock.calls.find(([url]) => url === '/api/v1/app/uploads');
    const createOptions = (
      createCall as unknown as [string, { headers?: Record<string, string> }] | undefined
    )?.[1];
    expect(createOptions?.headers?.['Idempotency-Key']).not.toBe('stale-create-key');
    expect(sessionStorage.getItem(attemptKey)).toBeNull();
  });

  it('普通网络失败保留原会话，供用户重试', async () => {
    const file = new File(['pdf'], 'retry.pdf', {
      type: 'application/pdf',
      lastModified: 456,
    });
    requestMock.mockImplementation(async (url) => {
      if (url === '/api/v1/app/uploads') return uploadSession('retry-upload');
      if (url === '/api/v1/app/uploads/retry-upload/renew') return uploadSession('retry-upload');
      throw new Error(`意外请求：${url}`);
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('网络中断')));

    await expect(uploadAppFile(file, 'CONTENT_FILE')).rejects.toThrow('网络中断');
    expect(sessionStorage.length).toBe(1);
  });

  it('续签发现会话已完成时取回完成结果，不重复创建文件', async () => {
    const file = new File(['pdf'], 'completed.pdf', {
      type: 'application/pdf',
      lastModified: 789,
    });
    const attemptKey = `ph-upload:CONTENT_FILE:${file.name}:${file.size}:${file.lastModified}`;
    sessionStorage.setItem(
      attemptKey,
      JSON.stringify({
        createKey: 'completed-create-key',
        completeKey: 'completed-complete-key',
        session: uploadSession('completed-upload'),
      }),
    );
    requestMock.mockImplementation(async (url) => {
      if (url === '/api/v1/app/uploads/completed-upload/renew') {
        throw uploadError('FILE_NOT_FOUND');
      }
      if (url === '/api/v1/app/uploads/completed-upload/complete') {
        return { id: 'completed-file' };
      }
      throw new Error(`意外请求：${url}`);
    });

    await expect(uploadAppFile(file, 'CONTENT_FILE')).resolves.toMatchObject({
      id: 'completed-file',
    });
    expect(requestMock.mock.calls.some(([url]) => url === '/api/v1/app/uploads')).toBe(false);
    expect(sessionStorage.getItem(attemptKey)).toBeNull();
  });

  it('分片完成响应丢失后用原请求体和幂等键取回结果', async () => {
    const file = new File(['abc'], 'completed.zip', {
      type: 'application/zip',
      lastModified: 790,
    });
    const session: AppUploadSession = {
      ...uploadSession('multipart-upload'),
      mode: 'MULTIPART',
      uploadUrl: null,
      multipartUploadId: 'storage-upload',
      partSize: 1,
    };
    let completedOnServer = false;
    requestMock.mockImplementation(async (url) => {
      if (url === '/api/v1/app/uploads') return session;
      if (url === '/api/v1/app/uploads/multipart-upload/renew') {
        if (completedOnServer) throw uploadError('FILE_NOT_FOUND');
        return session;
      }
      if (url === '/api/v1/app/uploads/multipart-upload/parts?startPart=1&count=3') {
        return [1, 2, 3].map((partNumber) => ({
          partNumber,
          url: `https://example.test/part-${partNumber}`,
        }));
      }
      if (url === '/api/v1/app/uploads/multipart-upload/complete') {
        if (!completedOnServer) {
          completedOnServer = true;
          throw new Error('完成响应在网络中丢失');
        }
        return { id: 'completed-multipart-file' };
      }
      throw new Error(`意外请求：${url}`);
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, headers: { get: () => '"part-etag"' } }),
    );

    await expect(uploadAppFile(file, 'TEMPORARY_IMPORT')).rejects.toThrow('完成响应在网络中丢失');
    await expect(uploadAppFile(file, 'TEMPORARY_IMPORT')).resolves.toMatchObject({
      id: 'completed-multipart-file',
    });
    const completeCalls = (
      requestMock.mock.calls as unknown as Array<
        [string, { data?: unknown; headers?: Record<string, string> }]
      >
    ).filter(([url]) => url === '/api/v1/app/uploads/multipart-upload/complete');
    expect(completeCalls).toHaveLength(2);
    expect(completeCalls[0]?.[1].data).toEqual({
      parts: [1, 2, 3].map((partNumber) => ({ partNumber, etag: '"part-etag"' })),
    });
    expect(completeCalls[1]?.[1]).toMatchObject({
      data: completeCalls[0]?.[1]?.data,
      headers: completeCalls[0]?.[1]?.headers,
    });
    expect(sessionStorage.length).toBe(0);
  });
});
