import { request } from '@umijs/max';
import { newIdempotencyKey } from '@personal-hub/api-client';

const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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

function isGifFile(file: File): boolean {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name);
}

/**
 * 上传后台可引用的封面图。
 * GIF 只给站点配置的 Logo、图标和加载图。项目封面不传 allowGif。
 * COVER 的服务端上限是 5 MB，低于单次直传阈值；这里明确拒绝意外分片会话。
 */
export async function uploadCoverImage(
  file: File,
  options?: { allowGif?: boolean },
): Promise<UploadedImageFile> {
  const allowGif = options?.allowGif === true;
  const mimeType = isGifFile(file) ? 'image/gif' : file.type;
  if (isGifFile(file) && !allowGif) {
    throw new Error('仅支持 JPG、PNG、WebP 图片');
  }
  if (!COVER_MIME_TYPES.has(mimeType) || (mimeType === 'image/gif' && !allowGif)) {
    throw new Error(allowGif ? '仅支持 JPG、PNG、WebP、GIF 图片' : '仅支持 JPG、PNG、WebP 图片');
  }
  if (file.size > COVER_MAX_BYTES) {
    throw new Error('图片不能超过 5 MB');
  }

  const session = await request<AppUploadSession>('/api/v1/app/uploads', {
    method: 'POST',
    data: {
      purpose: 'COVER',
      originalName: file.name,
      mimeType,
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
    headers: { 'Content-Type': mimeType },
  });
  if (!put.ok) {
    throw new Error('图片上传到对象存储失败');
  }

  return request<UploadedImageFile>(`/api/v1/app/uploads/${session.uploadId}/complete`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

const LOADING_VIDEO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * 加载页视频复用已允许 mp4 的 AI_ASSET 上传，不新增文件用途。
 * 上限 10 MB，和该用途的默认策略一致。
 */
export async function uploadLoadingVideo(file: File): Promise<UploadedImageFile> {
  if (file.type !== 'video/mp4') {
    throw new Error('仅支持 MP4 视频');
  }
  if (file.size > LOADING_VIDEO_MAX_BYTES) {
    throw new Error('视频不能超过 10 MB');
  }

  const session = await request<AppUploadSession>('/api/v1/app/uploads', {
    method: 'POST',
    data: {
      purpose: 'AI_ASSET',
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
    },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
  if (session.mode !== 'SINGLE' || !session.uploadUrl) {
    throw new Error('视频上传会话异常，请重新选择文件');
  }

  const put = await fetch(session.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!put.ok) {
    throw new Error('视频上传到对象存储失败');
  }

  return request<UploadedImageFile>(`/api/v1/app/uploads/${session.uploadId}/complete`, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}
