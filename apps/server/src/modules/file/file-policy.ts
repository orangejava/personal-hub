import { FilePurpose } from '@prisma/client';

export interface FilePurposePolicy {
  mimeTypes: string[];
  maxBytes: number;
}

/** 代码天花板：配置覆盖不得超过这些上限。 */
export const FILE_POLICY_CEILING_BYTES: Record<FilePurpose, number> = {
  [FilePurpose.AVATAR]: 5 * 1024 * 1024,
  [FilePurpose.COVER]: 5 * 1024 * 1024,
  [FilePurpose.CONTENT_FILE]: 500 * 1024 * 1024,
  [FilePurpose.BOOKLET_SOURCE]: 50 * 1024 * 1024,
  [FilePurpose.TEMPORARY_IMPORT]: 50 * 1024 * 1024,
  [FilePurpose.AI_ASSET]: 50 * 1024 * 1024,
};

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * 一期默认矩阵。二期后台可覆盖 MIME/大小，但不能越过天花板和 denylist。
 */
export const FILE_POLICY_DEFAULTS: Record<FilePurpose, FilePurposePolicy> = {
  [FilePurpose.AVATAR]: { mimeTypes: [...IMAGE_MIMES], maxBytes: 5 * 1024 * 1024 },
  [FilePurpose.COVER]: { mimeTypes: [...IMAGE_MIMES], maxBytes: 5 * 1024 * 1024 },
  [FilePurpose.CONTENT_FILE]: {
    mimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxBytes: 500 * 1024 * 1024,
  },
  [FilePurpose.BOOKLET_SOURCE]: { mimeTypes: ['application/zip', 'application/x-zip-compressed'], maxBytes: 50 * 1024 * 1024 },
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
    maxBytes: Math.min(Math.max(1, requested), ceiling),
  };
}

export function isDeniedMime(mimeType: string): boolean {
  return MIME_DENYLIST.has(mimeType.toLowerCase());
}

export function shouldUseMultipart(size: number): boolean {
  return size > SINGLE_PUT_MAX_BYTES;
}

export { SINGLE_PUT_MAX_BYTES };
