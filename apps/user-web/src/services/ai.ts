import { request } from '@umijs/max';
import { getAccessToken } from '@personal-hub/api-client';
import type {
  AiAsset,
  AiAssetCreateInput,
  AiAssetFolder,
  AiAssetFolderNameInput,
  AiAssetFolderMutationInput,
  AiConversation,
  AiConversationCreateInput,
  AiConversationUpdateInput,
  AiCreationCenterData,
  AiGenerationTask,
  AiHomeData,
  AiMediaGenerateInput,
  AiMediaGenerateResult,
  AiMembershipData,
  AiMessage,
  AiMessageFeedbackInput,
  AiModel,
  AiNavigationItem,
  AiProfileSummary,
  AiPublishDraftItem,
  AiQuotaConsumeInput,
  AiQuotaSummary,
  AiTemplate,
  AiTextGenerateInput,
  AiTextGenerateResult,
  AiTool,
  AiTutorialItem,
} from '@personal-hub/shared-types';

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function isUuid(value?: string): boolean {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

export function isLoggedIn(): boolean {
  return Boolean(getAccessToken());
}

interface Page<T> {
  list: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

interface SsePayload {
  type: string;
  content?: string;
  assistantMessageId?: string;
  code?: string;
  usage?: { inputTokens?: number; outputTokens?: number; platformCost?: number };
}

/**
 * SSE 不走 Umi 解包：流式响应不是 `{ data }` 信封。
 */
export async function consumeAiSse(
  input: {
    url: string;
    body: unknown;
    signal?: AbortSignal;
  },
  onEvent: (payload: SsePayload) => void,
): Promise<void> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'Idempotency-Key': newIdempotencyKey(),
  };
  const token = getAccessToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(input.url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(input.body),
    signal: input.signal,
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('text/event-stream')) {
    const text = await response.text();
    let message = text || `请求失败 ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      message = parsed.error?.message ?? message;
    } catch {
      // 保持原文
    }
    throw new Error(message);
  }
  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'));
      if (!dataLine) {
        continue;
      }
      onEvent(JSON.parse(dataLine.slice(5).trim()) as SsePayload);
    }
  }
}

export async function fetchAiHome() {
  const path = isLoggedIn() ? '/api/v1/app/ai/home' : '/api/v1/public/ai/home';
  return request<AiHomeData>(path);
}

export async function fetchAiTools() {
  const home = await fetchAiHome();
  return home.tools as AiTool[];
}

export async function fetchAiModels() {
  const path = isLoggedIn() ? '/api/v1/app/ai/models' : '/api/v1/public/ai/models';
  return request<AiModel[]>(path);
}

const EMPTY_QUOTA: AiQuotaSummary = {
  remainingTokens: 0,
  usedTokens: 0,
  totalTokens: 0,
  lowBalanceThreshold: 0,
};

export async function fetchAiQuota() {
  if (!isLoggedIn()) {
    return EMPTY_QUOTA;
  }
  return request<AiQuotaSummary>('/api/v1/app/ai/entitlement');
}

/** 额度由服务端预占/结算，前端只刷新摘要。访客没有账本，禁止打需登录接口以免 401 跳登录。 */
export async function consumeAiQuota(_data: AiQuotaConsumeInput) {
  if (!isLoggedIn()) {
    return { quota: EMPTY_QUOTA, consumed: false, reason: undefined as string | undefined };
  }
  const quota = await fetchAiQuota();
  return { quota, consumed: true, reason: undefined as string | undefined };
}

export async function fetchAiMembership(): Promise<AiMembershipData> {
  if (!isLoggedIn()) {
    return {
      currentPlanId: 'guest',
      currentPlanName: '访客',
      quota: EMPTY_QUOTA,
      plans: [],
      inviteRecords: [],
      usageOverview: {
        balanceStatus: 'normal',
        balanceStatusText: '访客试用',
        trendDays: 30,
        trend: [],
        toolUsage: [],
        guestTrial: { dailyLimit: 20, used: 0, remaining: 20, exceeded: false },
      },
    };
  }
  return request<AiMembershipData>('/api/v1/app/ai/membership');
}

export async function fetchAiNavigation() {
  const path = isLoggedIn() ? '/api/v1/app/ai/navigation' : '/api/v1/public/ai/navigation';
  return request<AiNavigationItem[]>(path);
}

export async function fetchAiGenerationJobs(params?: {
  toolType?: 'image' | 'video' | 'text';
  page?: number;
  pageSize?: number;
}) {
  if (!isLoggedIn()) {
    return { list: [] as AiGenerationTask[], total: 0, page: 1, pageSize: params?.pageSize ?? 20 };
  }
  return request<{ list: AiGenerationTask[]; total: number; page: number; pageSize: number }>(
    '/api/v1/app/ai/generation-jobs',
    { params },
  );
}

export async function fetchAiProfileSummary() {
  return request<AiProfileSummary>('/api/v1/app/ai/profile-summary');
}

export async function fetchAiCreationCenter() {
  return request<AiCreationCenterData>('/api/v1/app/ai/creation-center');
}

export async function fetchAiTutorials() {
  const path = isLoggedIn() ? '/api/v1/app/ai/tutorials' : '/api/v1/public/ai/tutorials';
  return request<{ list: AiTutorialItem[] }>(path);
}

export async function fetchAiPublishDrafts() {
  return request<{ list: AiPublishDraftItem[]; total: number }>('/api/v1/app/ai/publish-drafts');
}

const ASSET_OBJECT_URL_LIMIT = 32;

type AssetObjectUrlEntry = {
  url: string;
  refs: number;
};

const objectUrlCache = new Map<string, AssetObjectUrlEntry>();

function evictUnusedAssetObjectUrls() {
  for (const [id, entry] of objectUrlCache) {
    if (objectUrlCache.size <= ASSET_OBJECT_URL_LIMIT) {
      return;
    }
    if (entry.refs > 0) {
      continue;
    }
    URL.revokeObjectURL(entry.url);
    objectUrlCache.delete(id);
  }
}

/**
 * 组件卸载时归还引用；无引用且超出上限时释放 blob。
 */
export function releaseAiAssetObjectUrl(assetId: string) {
  const entry = objectUrlCache.get(assetId);
  if (!entry) {
    return;
  }
  entry.refs = Math.max(0, entry.refs - 1);
  evictUnusedAssetObjectUrls();
}

/**
 * 媒体接口需要 Bearer，不能直接当 img src。
 * 用 blob URL 缓存，避免同一资产反复下载。
 */
export async function resolveAiAssetObjectUrl(asset: Pick<AiAsset, 'id' | 'fileUrl' | 'thumbnailUrl'>) {
  const cached = objectUrlCache.get(asset.id);
  if (cached) {
    cached.refs += 1;
    objectUrlCache.delete(asset.id);
    objectUrlCache.set(asset.id, cached);
    return cached.url;
  }
  const path = asset.fileUrl || asset.thumbnailUrl;
  if (path && /^https?:\/\//i.test(path) && !path.includes('/api/v1/app/ai/assets/')) {
    return path;
  }
  const token = getAccessToken();
  const url = path?.startsWith('/') ? path : `/api/v1/app/ai/assets/${asset.id}/content`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error('无法加载生成结果');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  objectUrlCache.set(asset.id, { url: objectUrl, refs: 1 });
  evictUnusedAssetObjectUrls();
  return objectUrl;
}

export async function fetchAiTemplates() {
  return request<AiTemplate[]>('/api/v1/app/ai/templates');
}

export async function generateAiText(
  data: AiTextGenerateInput,
  signal?: AbortSignal,
): Promise<AiTextGenerateResult> {
  let output = '';
  let tokens = 0;
  await consumeAiSse(
    {
      url: isLoggedIn() ? '/api/v1/app/ai/text-generations' : '/api/v1/public/ai/text-generations',
      body: {
        scenario: data.scenario,
        input: data.input,
        modelId: isUuid(data.modelId) ? data.modelId : undefined,
        tone: data.tone,
        length: data.length,
        targetLanguage: data.targetLanguage,
      },
      signal,
    },
    (event) => {
      if (event.type === 'DELTA' && event.content) {
        output += event.content;
      }
      if (event.type === 'DONE') {
        tokens = (event.usage?.inputTokens ?? 0) + (event.usage?.outputTokens ?? 0);
      }
      if (event.type === 'ERROR') {
        throw new Error(event.code ?? '生成失败');
      }
    },
  );
  return { output, estimatedTokens: tokens, task: {
    id: crypto.randomUUID(),
    toolType: 'text',
    title: data.scenario,
    prompt: data.input,
    modelId: data.modelId,
    status: 'done',
    assetIds: [],
    createdAt: new Date().toISOString(),
  } };
}

async function pollJob(kind: 'image' | 'video', jobId: string) {
  const path =
    kind === 'image'
      ? `/api/v1/app/ai/image-generations/${jobId}`
      : `/api/v1/app/ai/video-generations/${jobId}`;
  for (let i = 0; i < 40; i += 1) {
    const job = await request<AiGenerationTask>(path);
    if (job.status === 'done' || job.status === 'failed' || job.status === 'stopped') {
      return job;
    }
    await new Promise((resolve) => {
      window.setTimeout(resolve, 500);
    });
  }
  throw new Error('生成任务超时，请确认 worker 已启动');
}

async function createMediaJob(
  kind: 'image' | 'video',
  data: AiMediaGenerateInput,
): Promise<AiMediaGenerateResult> {
  const created = await request<AiGenerationTask>(
    kind === 'image' ? '/api/v1/app/ai/image-generations' : '/api/v1/app/ai/video-generations',
    {
      method: 'POST',
      data: {
        prompt: data.prompt,
        modelId: isUuid(data.modelId) ? data.modelId : undefined,
        count: data.params?.count,
        size: data.params?.size,
        style: data.params?.style,
        negativePrompt: data.params?.negativePrompt,
      },
      headers: { 'Idempotency-Key': newIdempotencyKey() },
    },
  );
  const job = await pollJob(kind, created.id);
  const assets = job.assets ?? [];
  return {
    task: {
      ...job,
      title: data.title || job.title,
      params: data.params,
      assetIds: assets.map((item) => item.id),
      assets,
    },
    assets,
  };
}

export async function cancelAiMediaJob(kind: 'image' | 'video', jobId: string) {
  return request<AiGenerationTask>(
    kind === 'image'
      ? `/api/v1/app/ai/image-generations/${jobId}/cancel`
      : `/api/v1/app/ai/video-generations/${jobId}/cancel`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
    },
  );
}

export async function generateAiImage(data: AiMediaGenerateInput) {
  return createMediaJob('image', data);
}

export async function generateAiVideo(data: AiMediaGenerateInput) {
  return createMediaJob('video', data);
}

export async function fetchAiSessions() {
  if (!isLoggedIn()) {
    return [];
  }
  const page = await request<Page<AiConversation>>('/api/v1/app/ai/sessions');
  return page.list;
}

export async function createAiSession(data: AiConversationCreateInput = {}) {
  return request<AiConversation>(
    isLoggedIn() ? '/api/v1/app/ai/sessions' : '/api/v1/public/ai/sessions',
    {
      method: 'POST',
      data: {
        title: data.title,
        modelId: isUuid(data.settings?.modelId)
          ? data.settings?.modelId
          : undefined,
        systemPrompt: data.settings?.systemPrompt,
      },
      headers: { 'Idempotency-Key': newIdempotencyKey() },
    },
  );
}

export async function updateAiSession(id: string, data: AiConversationUpdateInput) {
  return request<AiConversation>(`/api/v1/app/ai/sessions/${id}`, {
    method: 'PATCH',
    data: {
      title: data.title,
      modelId: isUuid(data.settings?.modelId) ? data.settings?.modelId : undefined,
      systemPrompt: data.settings?.systemPrompt,
    },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function deleteAiSession(id: string) {
  return request<{ id: string; deleted: boolean }>(`/api/v1/app/ai/sessions/${id}`, {
    method: 'DELETE',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function fetchAiMessages(sessionId: string) {
  if (!isLoggedIn()) {
    return [];
  }
  const page = await request<{ list: AiMessage[] }>(`/api/v1/app/ai/sessions/${sessionId}/messages`);
  return page.list;
}

export async function streamAiChat(input: {
  sessionId?: string;
  content: string;
  modelId?: string;
  contentId?: string;
  signal?: AbortSignal;
  onEvent: (payload: SsePayload) => void;
}) {
  if (isLoggedIn() && input.sessionId) {
    await consumeAiSse(
      {
        url: `/api/v1/app/ai/sessions/${input.sessionId}/messages`,
        body: {
          content: input.content,
          modelId: isUuid(input.modelId) ? input.modelId : undefined,
          contentId: input.contentId,
        },
        signal: input.signal,
      },
      input.onEvent,
    );
    return;
  }
  await consumeAiSse(
    {
      url: '/api/v1/public/ai/chat',
      body: { content: input.content, sessionId: input.sessionId },
      signal: input.signal,
    },
    input.onEvent,
  );
}

export async function stopAiMessage(messageId: string) {
  const path = isLoggedIn()
    ? `/api/v1/app/ai/messages/${messageId}/stop`
    : `/api/v1/public/ai/messages/${messageId}/stop`;
  return request(path, {
    method: 'POST',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function regenerateAiMessage(
  messageId: string,
  onEvent: (payload: SsePayload) => void,
  signal?: AbortSignal,
) {
  await consumeAiSse(
    {
      url: `/api/v1/app/ai/messages/${messageId}/regenerate`,
      body: {},
      signal,
    },
    onEvent,
  );
}

export async function updateAiMessageFeedback(
  messageId: string,
  data: AiMessageFeedbackInput,
) {
  return request<AiMessage>(`/api/v1/app/ai/messages/${messageId}/feedback`, {
    method: 'PATCH',
    data: { feedback: data.feedback === 'dislike' ? 'DISLIKE' : data.feedback === 'like' ? 'LIKE' : null },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function fetchAiAssets() {
  if (!isLoggedIn()) {
    return [];
  }
  const page = await request<Page<AiAsset>>('/api/v1/app/ai/assets');
  return page.list;
}

export async function createAiAsset(data: AiAssetCreateInput) {
  return request<AiAsset>('/api/v1/app/ai/assets', {
    method: 'POST',
    data: {
      title: data.title,
      type: (data.type ?? 'text').toUpperCase(),
      prompt: data.prompt,
      folderId: data.folderId,
    },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function fetchAiAssetFolders() {
  return request<AiAssetFolder[]>('/api/v1/app/ai/asset-folders');
}

export async function createAiAssetFolder(data: AiAssetFolderNameInput) {
  return request<AiAssetFolder>('/api/v1/app/ai/asset-folders', {
    method: 'POST',
    data,
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function renameAiAssetFolder(id: string, data: AiAssetFolderNameInput) {
  return request<AiAssetFolder>(`/api/v1/app/ai/asset-folders/${id}`, {
    method: 'PATCH',
    data,
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function deleteAiAssetFolder(id: string) {
  return request<{ folderId: string; deleted: boolean; reason?: 'notEmpty' | 'notFound' }>(
    `/api/v1/app/ai/asset-folders/${id}`,
    {
      method: 'DELETE',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
    },
  );
}

export async function trashAiAsset(id: string) {
  return request<AiAsset>(`/api/v1/app/ai/assets/${id}`, {
    method: 'PATCH',
    data: { status: 'TRASHED' },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function restoreAiAsset(id: string) {
  return request<AiAsset>(`/api/v1/app/ai/assets/${id}`, {
    method: 'PATCH',
    data: { status: 'SAVED' },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function deleteAiAsset(id: string) {
  return request<{ id: string; deleted: boolean }>(`/api/v1/app/ai/assets/${id}`, {
    method: 'DELETE',
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function moveAiAssetToFolder(id: string, data: AiAssetFolderMutationInput) {
  return request<AiAsset>(`/api/v1/app/ai/assets/${id}`, {
    method: 'PATCH',
    data: { folderId: data.folderId ?? null },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
}

export async function batchTrashAiAssets(ids: string[]) {
  await Promise.all(ids.map((id) => trashAiAsset(id)));
  return { changed: ids };
}

export async function batchMoveAiAssetsToFolder(ids: string[], data: AiAssetFolderMutationInput) {
  await Promise.all(ids.map((id) => moveAiAssetToFolder(id, data)));
  return { changed: ids };
}

export async function batchRestoreAiAssets(ids: string[]) {
  await Promise.all(ids.map((id) => restoreAiAsset(id)));
  return { changed: ids };
}

export async function batchDeleteAiAssets(ids: string[]) {
  await Promise.all(ids.map((id) => deleteAiAsset(id)));
  return { deleted: ids };
}
