import type { AiAsset, AiMediaGenerateInput } from '@personal-hub/shared-types';

export function isAiUuid(value?: string) {
  return Boolean(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  );
}

/** 兼容解包后的任务对象，以及仍带着 data 信封的 202 响应。 */
export function readCreatedJobId(created: unknown): string | undefined {
  if (!created || typeof created !== 'object') return undefined;
  const record = created as { id?: unknown; data?: { id?: unknown } };
  if (typeof record.id === 'string' && record.id) return record.id;
  if (typeof record.data?.id === 'string' && record.data.id) return record.data.id;
  return undefined;
}

export function resolveAiAssetDownloadName(asset: Pick<AiAsset, 'title' | 'type'>) {
  const ext = asset.type === 'video' ? 'mp4' : 'png';
  return asset.title ? `${asset.title}.${ext}` : `download.${ext}`;
}

/**
 * 只组装 Nest 白名单字段。
 * 全局 forbidNonWhitelisted，多传 title / params 会直接 400。
 */
export function buildMediaJobBody(
  kind: 'image' | 'video',
  data: AiMediaGenerateInput,
) {
  const count = Number(data.params?.count);
  const duration = Number(data.params?.durationSeconds);
  const body: {
    prompt: string;
    modelId?: string;
    count?: number;
    size?: string;
    style?: string;
    quality?: string;
    resolution?: string;
    negativePrompt?: string;
    durationSeconds?: number;
  } = {
    prompt: typeof data.prompt === 'string' ? data.prompt : '',
  };
  if (isAiUuid(data.modelId)) {
    body.modelId = data.modelId;
  }
  if (data.params?.size) {
    body.size = data.params.size;
  }
  if (data.params?.style) {
    body.style = data.params.style;
  }
  if (kind === 'video') {
    if (Number.isInteger(duration) && duration >= 1 && duration <= 30) {
      body.durationSeconds = duration;
    }
    return body;
  }
  if (Number.isInteger(count) && count >= 1 && count <= 4) {
    body.count = count;
  }
  if (data.params?.quality) {
    body.quality = data.params.quality;
  }
  if (data.params?.resolution) {
    body.resolution = data.params.resolution;
  }
  if (data.params?.negativePrompt) {
    body.negativePrompt = data.params.negativePrompt;
  }
  return body;
}
