import { request } from '@umijs/max';
import { newIdempotencyKey } from '@personal-hub/api-client';

const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface AppUploadSession {
  uploadId: string;
  fileId: string;
  mode: 'SINGLE' | 'MULTIPART';
  uploadUrl: string | null;
}

export interface UploadedImageFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  purpose: string;
  status: string;
}

/**
 * 上传后台可引用的封面图。
 *
 * COVER 的服务端上限是 5 MB，低于单次直传阈值；这里明确拒绝意外分片会话，
 * 避免管理端出现未实现的半套分片上传。
 */
export async function uploadCoverImage(file: File): Promise<UploadedImageFile> {
  if (!COVER_MIME_TYPES.has(file.type)) {
    throw new Error('仅支持 JPG、PNG、WebP 图片');
  }
  if (file.size > COVER_MAX_BYTES) {
    throw new Error('图片不能超过 5 MB');
  }

  const session = await request<AppUploadSession>('/api/v1/app/uploads', {
    method: 'POST',
    data: {
      purpose: 'COVER',
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
    },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
  if (session.mode !== 'SINGLE' || !session.uploadUrl) {
    throw new Error('图片上传会话异常，请重新选择图片');
  }

  const put = await fetch(session.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!put.ok) {
    throw new Error('图片上传到对象存储失败');
  }

  return request<UploadedImageFile>(`/api/v1/app/uploads/${session.uploadId}/complete`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}
