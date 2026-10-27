import { FilePurpose } from '@prisma/client';

export interface FilePurposePolicy {
  mimeTypes: string[];
  maxBytes: number;
}

/** COS 每片最大 5 GB，最多 10,000 片；这里只定义存储协议的技术边界。 */
export const COS_MAX_PART_BYTES = 5_000_000_000;
export const COS_MAX_MULTIPART_PARTS = 10_000;
const COS_MEBIBYTE = 1024 * 1024;
// 分片计划按 MiB 向上取整，因此可用单片上限必须先向下对齐，才能保证每片都不超 COS 的 5 GB。
const COS_MAX_ALIGNED_PART_BYTES = Math.floor(COS_MAX_PART_BYTES / COS_MEBIBYTE) * COS_MEBIBYTE;
export const MAX_COS_OBJECT_BYTES = COS_MAX_ALIGNED_PART_BYTES * COS_MAX_MULTIPART_PARTS;

/** 头像、封面、普通内容和 AI 资产仍有代码上限；小册 ZIP 使用后台策略值。 */
export const FILE_POLICY_CEILING_BYTES: Partial<Record<FilePurpose, number>> = {
  [FilePurpose.AVATAR]: 5 * 1024 * 1024,
  [FilePurpose.COVER]: 5 * 1024 * 1024,
  [FilePurpose.CONTENT_FILE]: 500 * 1024 * 1024,
  [FilePurpose.AI_ASSET]: 50 * 1024 * 1024,
};

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** 默认策略。小册 ZIP 的 50 MiB 可由系统管理员调整。 */
export const FILE_POLICY_DEFAULTS: Record<FilePurpose, FilePurposePolicy> = {
  [FilePurpose.AVATAR]: { mimeTypes: [...IMAGE_MIMES], maxBytes: 5 * 1024 * 1024 },
  [FilePurpose.COVER]: { mimeTypes: [...IMAGE_MIMES, 'image/gif'], maxBytes: 5 * 1024 * 1024 },
  [FilePurpose.CONTENT_FILE]: {
    mimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxBytes: 500 * 1024 * 1024,
  },
  [FilePurpose.BOOKLET_SOURCE]: {
    mimeTypes: ['application/zip', 'application/x-zip-compressed'],
    maxBytes: 50 * 1024 * 1024,
  },
  [FilePurpose.TEMPORARY_IMPORT]: {
    mimeTypes: ['application/zip', 'application/x-zip-compressed'],
    maxBytes: 50 * 1024 * 1024,
  },
  [FilePurpose.AI_ASSET]: {
    mimeTypes: [...IMAGE_MIMES, 'video/mp4'],
    maxBytes: 10 * 1024 * 1024,
  },
};

const MIME_DENYLIST = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/javascript',
  'text/html',
  'text/javascript',
  'image/svg+xml',
  'application/xhtml+xml',
]);

const SINGLE_PUT_MAX_BYTES = 20 * 1024 * 1024;

/**
 * 合并代码默认与可选配置覆盖，再套 denylist 与天花板。
 *
 * @param purpose 上传通道
 * @param overlay `file.policies` 里该 purpose 的片段；缺省用代码默认
 */
export function resolveFilePolicy(
  purpose: FilePurpose,
  overlay?: Partial<FilePurposePolicy>,
): FilePurposePolicy {
  const defaults = FILE_POLICY_DEFAULTS[purpose];
  const mimeTypes = (overlay?.mimeTypes ?? defaults.mimeTypes)
    .map((item) => item.toLowerCase())
    .filter((item) => item.length > 0 && !MIME_DENYLIST.has(item));
  const unique = [...new Set(mimeTypes)];
  const ceiling = FILE_POLICY_CEILING_BYTES[purpose];
  const requested = overlay?.maxBytes ?? defaults.maxBytes;
  return {
    mimeTypes: unique.length > 0 ? unique : defaults.mimeTypes,
    maxBytes: ceiling === undefined ? requested : Math.min(Math.max(0, requested), ceiling),
  };
}

export function isDeniedMime(mimeType: string): boolean {
  return MIME_DENYLIST.has(mimeType.toLowerCase());
}

export function shouldUseMultipart(size: number): boolean {
  return size > SINGLE_PUT_MAX_BYTES;
}

/**
 * 为大文件计算可被 COS 接受的分片计划。
 * @param size 文件字节数
 * @returns 每片大小与分片数；超过 COS 对象能力时抛错
 */
export function multipartPlan(size: number): { partSize: number; partCount: number } {
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_COS_OBJECT_BYTES) {
    throw new Error('文件大小超出对象存储支持范围');
  }
  const minPartSize = 8 * 1024 * 1024;
  const required = Math.ceil(size / COS_MAX_MULTIPART_PARTS);
  const partSize = Math.ceil(Math.max(minPartSize, required) / COS_MEBIBYTE) * COS_MEBIBYTE;
  const partCount = Math.ceil(size / partSize);
  if (partSize > COS_MAX_PART_BYTES || partCount > COS_MAX_MULTIPART_PARTS) {
    throw new Error('文件大小超出对象存储支持范围');
  }
  return { partSize, partCount };
}

export { SINGLE_PUT_MAX_BYTES };
