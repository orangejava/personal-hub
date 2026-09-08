import { request } from '@umijs/max';
import type {
  AppFileListItem,
  BookletImportJobItem,
  PaginationResult,
  UploadTaskListResult,
} from '@personal-hub/shared-types';
import { nestError } from '@/services/auth';

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export interface AppUploadSession {
  uploadId: string;
  fileId: string;
  mode: 'SINGLE' | 'MULTIPART';
  objectKey: string;
  uploadUrl: string | null;
  multipartUploadId: string | null;
  parts: Array<{ partNumber: number; url: string }> | null;
  partSize: number | null;
  expiresAt: string;
}

export interface AppFileAsset {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  purpose: string;
  status: string;
}

export interface BookletImportJob {
  id: string;
  status: string;
  progress: number;
  contentId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sourceFileId: string;
}

function guessMime(file: File, purpose: string): string {
  if (file.type) {
    return file.type;
  }
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (name.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (name.endsWith('.zip')) {
    return 'application/zip';
  }
  if (name.endsWith('.png')) {
    return 'image/png';
  }
  if (name.endsWith('.webp')) {
    return 'image/webp';
  }
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (purpose === 'TEMPORARY_IMPORT') {
    return 'application/zip';
  }
  return 'application/octet-stream';
}

type StoredUploadAttempt = {
  createKey: string;
  completeKey: string;
  session?: AppUploadSession;
};

const inflightUploads = new Map<string, Promise<AppFileAsset>>();

function fileAttemptKey(file: File, purpose: string): string {
  return `${purpose}:${file.name}:${file.size}:${file.lastModified}`;
}

function readStoredAttempt(key: string): StoredUploadAttempt | null {
  try {
    const raw = sessionStorage.getItem(`ph-upload:${key}`);
    return raw ? (JSON.parse(raw) as StoredUploadAttempt) : null;
  } catch {
    return null;
  }
}

function writeStoredAttempt(key: string, value: StoredUploadAttempt) {
  sessionStorage.setItem(`ph-upload:${key}`, JSON.stringify(value));
}

function clearStoredAttempt(key: string) {
  sessionStorage.removeItem(`ph-upload:${key}`);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * 同键处理中时短重试，等首请求心跳回放；最后一次才走全局 toast。
 */
async function requestIdempotent<T>(
  url: string,
  options: {
    method?: string;
    data?: unknown;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const retries = 4;
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await request<T>(url, {
        method: options.method,
        data: options.data,
        headers: options.headers,
        skipErrorHandler: attempt < retries - 1,
      });
    } catch (error) {
      lastError = error;
      if (
        nestError(error).code !== 'IDEMPOTENCY_REQUEST_IN_PROGRESS' ||
        attempt === retries - 1
      ) {
        throw error;
      }
      await delay(400 * (attempt + 1));
    }
  }
  throw lastError;
}

async function putSignedPart(url: string, body: Blob): Promise<string> {
  const response = await fetch(url, { method: 'PUT', body });
  if (!response.ok) {
    throw new Error('对象存储分片上传失败');
  }
  const etag = response.headers.get('etag');
  if (!etag) {
    throw new Error('对象存储未返回分片 ETag');
  }
  return etag;
}

/**
 * 限制并发分片数，避免大文件上传时一次占满浏览器连接和内存。
 */
async function uploadMultipartFile(
  file: File,
  session: AppUploadSession,
): Promise<Array<{ partNumber: number; etag: string }>> {
  if (!session.parts?.length || !session.partSize) {
    throw new Error('上传会话缺少分片计划');
  }
  const completed: Array<{ partNumber: number; etag: string }> = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < session.parts!.length) {
      const part = session.parts![nextIndex++];
      const start = (part.partNumber - 1) * session.partSize!;
      const etag = await putSignedPart(part.url, file.slice(start, start + session.partSize!));
      completed.push({ partNumber: part.partNumber, etag });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, session.parts.length) }, worker));
  return completed.sort((left, right) => left.partNumber - right.partNumber);
}

async function putObjectWithRetry(file: File, session: AppUploadSession, mimeType: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (session.mode === 'MULTIPART') {
        return await uploadMultipartFile(file, session);
      }
      if (!session.uploadUrl) {
        throw new Error('上传会话缺少直传地址');
      }
      const put = await fetch(session.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': mimeType },
      });
      if (!put.ok) {
        throw new Error('对象存储上传失败');
      }
      return undefined;
    } catch (error) {
      lastError = error;
      if (attempt === 2) {
        throw error;
      }
      await delay(400 * (attempt + 1));
    }
  }
  throw lastError;
}

async function uploadAppFileOnce(
  file: File,
  purpose: string,
  attemptKey: string,
): Promise<AppFileAsset> {
  const mimeType = guessMime(file, purpose);
  const stored = readStoredAttempt(attemptKey);
  const createKey = stored?.createKey ?? newIdempotencyKey();
  const completeKey = stored?.completeKey ?? newIdempotencyKey();
  let session = stored?.session;
  writeStoredAttempt(attemptKey, { createKey, completeKey, session });

  if (!session) {
    session = await requestIdempotent<AppUploadSession>('/api/v1/app/uploads', {
      method: 'POST',
      data: {
        purpose,
        originalName: file.name,
        mimeType,
        size: file.size,
      },
      headers: { 'Idempotency-Key': createKey },
    });
    writeStoredAttempt(attemptKey, { createKey, completeKey, session });
  }

  const parts = await putObjectWithRetry(file, session, mimeType);
  const ready = await requestIdempotent<AppFileAsset>(
    `/api/v1/app/uploads/${session.uploadId}/complete`,
    {
      method: 'POST',
      data: parts ? { parts } : undefined,
      headers: { 'Idempotency-Key': completeKey },
    },
  );
  clearStoredAttempt(attemptKey);
  return ready;
}

/**
 * 浏览器直传：同一文件未完成时复用会话和幂等键，避免连点/刷新再开一份。
 */
export async function uploadAppFile(file: File, purpose: string): Promise<AppFileAsset> {
  const attemptKey = fileAttemptKey(file, purpose);
  const inflight = inflightUploads.get(attemptKey);
  if (inflight) {
    return inflight;
  }
  const run = uploadAppFileOnce(file, purpose, attemptKey).finally(() => {
    inflightUploads.delete(attemptKey);
  });
  inflightUploads.set(attemptKey, run);
  return run;
}

export async function createBookletImport(sourceFileId: string) {
  return request<BookletImportJob>('/api/v1/app/booklet-imports', {
    method: 'POST',
    data: { sourceFileId },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function fetchBookletImport(jobId: string) {
  return request<BookletImportJob>(`/api/v1/app/booklet-imports/${jobId}`);
}

export async function fetchMyBookletImports(params: { page?: number; pageSize?: number }) {
  return request<PaginationResult<BookletImportJobItem>>('/api/v1/app/booklet-imports', {
    params,
  });
}

export async function fetchMyUploadFiles(params: {
  page?: number;
  pageSize?: number;
  mimeKind?: 'pdf' | 'word' | 'zip';
}) {
  return request<PaginationResult<AppFileListItem>>('/api/v1/app/files', {
    params,
  });
}

/** 工作区上传任务页专用：不接受 mimeKind；taskKind 由服务端过滤。 */
export async function fetchMyUploadTasks(params: {
  page?: number;
  pageSize?: number;
  taskKind?: 'booklet' | 'pdf' | 'word' | 'zip';
}) {
  return request<UploadTaskListResult>('/api/v1/app/upload-tasks', { params });
}

export async function hideBookletImport(jobId: string) {
  return request(`/api/v1/app/booklet-imports/${jobId}`, {
    method: 'DELETE',
  });
}

export async function hideUploadFile(fileId: string) {
  return request(`/api/v1/app/files/${fileId}`, {
    method: 'DELETE',
  });
}

export async function retryBookletImport(jobId: string) {
  return request<BookletImportJob>(`/api/v1/app/booklet-imports/${jobId}/retry`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function waitForBookletImport(jobId: string): Promise<BookletImportJob> {
  for (let index = 0; index < 60; index += 1) {
    const job = await fetchBookletImport(jobId);
    if (job.status === 'SUCCEEDED' || job.status === 'PARTIAL_SUCCESS') {
      return job;
    }
    if (job.status === 'FAILED') {
      throw new Error(job.errorMessage || '小册导入失败');
    }
    await new Promise((resolve) => {
      window.setTimeout(resolve, 1000);
    });
  }
  throw new Error('导入仍在排队，请到「上传任务」查看进度，并确认已启动 pnpm dev:worker');
}
