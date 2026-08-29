import type {
  AiAsset,
  AiAssetCreateInput,
  AiAssetFolder,
  AiChatMessagesPersistInput,
  AiConversationCreateInput,
  AiConversationSettings,
  AiConversationUpdateInput,
  AiQuotaConsumeInput,
  AiConversation,
  AiGenerationTask,
  AiMediaGenerateInput,
  AiMediaGenerateResult,
  AiHomeData,
  AiInviteRecord,
  AiMembershipData,
  AiMembershipUsageOverview,
  AiMembershipPlan,
  AiMessage,
  AiMessageFeedbackInput,
  AiModel,
  AiQuotaSummary,
  AiTemplate,
  AiTextGenerateInput,
  AiTextGenerateResult,
  AiTool,
  AiUsageLogItem,
} from '@personal-hub/shared-types';
import { adminAiConfigData } from './admin-store';

export const aiBrandName = 'Personal Hub AI';

export const defaultAiChatSettings: Required<AiConversationSettings> = {
  modelId: 'qwen-turbo',
  systemPrompt:
    '你是 Personal Hub AI，回答时先理解用户目标，再给出结构清晰、可执行的建议。',
  contextLimit: 20,
  enableKnowledgeReference: true,
};

export const aiTools: AiTool[] = [
  {
    code: 'chat',
    name: 'AI 对话',
    description: '多轮对话、知识引用和 Markdown 回复。',
    group: 'create',
    path: '/ai/chat',
    status: 'enabled',
    icon: 'robot',
    modelTags: ['Qwen', 'GPT'],
  },
  {
    code: 'text',
    name: '文本生成',
    description: '写作、改写、摘要、翻译和自定义 Prompt。',
    group: 'create',
    path: '/ai/text',
    status: 'enabled',
    icon: 'fileText',
    modelTags: ['Qwen'],
  },
  {
    code: 'image',
    name: '图片生成',
    description: '对话式图片生成，支持再次编辑和重新生成。',
    group: 'create',
    path: '/ai/image',
    status: 'enabled',
    icon: 'picture',
    modelTags: ['Qwen-Image', 'DALL·E'],
    requiresLogin: true,
  },
  {
    code: 'video',
    name: '视频生成',
    description: '阶段 5 mock 创作流，先跑通交互。',
    group: 'create',
    path: '/ai/video',
    status: 'enabled',
    icon: 'video',
    modelTags: ['Seedance'],
    requiresLogin: true,
  },
  {
    code: 'webui',
    name: 'WebUI',
    description: '专业绘图工作台，后续接入。',
    group: 'create',
    path: '/ai/webui',
    status: 'comingSoon',
    icon: 'appstore',
  },
  {
    code: 'comfyui',
    name: 'ComfyUI',
    description: '节点式工作流，后续接入。',
    group: 'create',
    path: '/ai/comfyui',
    status: 'comingSoon',
    icon: 'deploymentUnit',
  },
  {
    code: 'lora',
    name: 'LoRA 训练',
    description: '个人风格模型训练，后续接入。',
    group: 'create',
    path: '/ai/lora',
    status: 'comingSoon',
    icon: 'experiment',
  },
  {
    code: 'apps',
    name: 'AI 应用',
    description: '沉淀常用工作流和模板应用。',
    group: 'create',
    path: '/ai/apps',
    status: 'enabled',
    icon: 'appstore',
  },
];

export const aiModels: AiModel[] = [
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    provider: '阿里云百炼',
    toolTypes: ['chat', 'text'],
    enabled: true,
    isDefault: true,
    description: '中文对话和轻量文本任务默认模型。',
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    provider: '阿里云百炼',
    toolTypes: ['chat', 'text'],
    enabled: true,
    description: '更适合长文本和复杂指令。',
  },
  {
    id: 'qwen-image',
    name: 'Qwen-Image',
    provider: '阿里云百炼',
    toolTypes: ['image'],
    enabled: true,
    isDefault: true,
    description: '图片生成 mock 默认模型。',
  },
  {
    id: 'seedance-lite',
    name: 'Seedance Lite',
    provider: '火山引擎',
    toolTypes: ['video'],
    enabled: true,
    isDefault: true,
    description: '视频生成 mock 默认模型。',
  },
  {
    id: 'disabled-demo-model',
    name: '禁用模型示例',
    provider: 'Mock Provider',
    toolTypes: ['chat', 'image'],
    enabled: false,
  },
];

export const aiQuota: AiQuotaSummary = {
  totalTokens: 10000,
  usedTokens: 2360,
  remainingTokens: 7640,
  lowBalanceThreshold: 1000,
};

const aiToolNameMap: Record<AiQuotaConsumeInput['toolType'], string> = {
  chat: 'AI 对话',
  text: '文本生成',
  image: '图片生成',
  video: '视频生成',
};

export const aiUsageLogs: AiUsageLogItem[] = [
  {
    id: 'usage-text-initial',
    toolType: 'text',
    toolName: '文本生成',
    tokens: 860,
    reason: '写作辅助 mock 生成',
    createdAt: '2026-07-05T10:20:00.000Z',
  },
  {
    id: 'usage-image-initial',
    toolType: 'image',
    toolName: '图片生成',
    tokens: 1000,
    reason: '图片生成 mock 任务',
    createdAt: '2026-07-05T11:00:00.000Z',
  },
  {
    id: 'usage-chat-initial',
    toolType: 'chat',
    toolName: 'AI 对话',
    tokens: 500,
    reason: '对话 mock 消耗',
    createdAt: '2026-07-05T11:40:00.000Z',
  },
];

export const aiMembershipPlans: AiMembershipPlan[] = [
  {
    id: 'free',
    name: '免费版',
    description: '适合体验 AI 对话、文本生成和少量图片 mock 任务。',
    monthlyTokens: 10000,
    priceLabel: 'Mock 免费',
    badge: '当前',
    benefits: ['每日基础对话试用', '基础文本生成', '生成资产本地 mock 保存'],
  },
  {
    id: 'basic',
    name: '基础会员',
    description: '适合稳定使用个人知识创作和图片生成。',
    monthlyTokens: 100000,
    priceLabel: 'Mock ¥29/月',
    highlighted: true,
    benefits: ['更高 Token 配额', '图片/视频生成队列优先级 mock', '资产项目文件夹'],
  },
  {
    id: 'pro',
    name: '专业会员',
    description: '适合高频内容生产、品牌素材和团队协作预留。',
    monthlyTokens: 1000000,
    priceLabel: 'Mock ¥99/月',
    benefits: ['专业模型优先体验', '更长上下文 mock', '后续 API 与批量任务预留'],
  },
];

export const aiInviteRecords: AiInviteRecord[] = [
  {
    id: 'invite-1',
    title: '邀请好友注册',
    status: 'pending',
    rewardTokens: 3000,
    createdAt: '2026-07-05T12:00:00.000Z',
  },
  {
    id: 'invite-2',
    title: '完成首次图片生成',
    status: 'claimed',
    rewardTokens: 1000,
    createdAt: '2026-07-04T12:00:00.000Z',
  },
];

const aiMembershipTrendSeed = [120, 80, 160, 240, 0, 300, 180, 90, 260, 420];

function getAiMembershipUsageOverview(): AiMembershipUsageOverview {
  const trendDays = 30;
  const today = new Date('2026-07-06T00:00:00.000Z');
  const trend = Array.from({ length: trendDays }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (trendDays - 1 - index));
    return {
      date: date.toISOString().slice(0, 10),
      tokens: aiMembershipTrendSeed[index % aiMembershipTrendSeed.length],
    };
  });
  const toolUsageMap = aiUsageLogs.reduce<
    Record<AiUsageLogItem['toolType'], { toolName: string; tokens: number; calls: number }>
  >((acc, item) => {
    const current = acc[item.toolType] ?? {
      toolName: item.toolName,
      tokens: 0,
      calls: 0,
    };
    current.tokens += item.tokens;
    current.calls += 1;
    acc[item.toolType] = current;
    return acc;
  }, {} as Record<AiUsageLogItem['toolType'], { toolName: string; tokens: number; calls: number }>);
  const balanceStatus =
    aiQuota.remainingTokens <= 0
      ? 'insufficient'
      : aiQuota.remainingTokens <= aiQuota.lowBalanceThreshold
        ? 'low'
        : 'normal';

  return {
    balanceStatus,
    balanceStatusText:
      balanceStatus === 'insufficient'
        ? '余额不足'
        : balanceStatus === 'low'
          ? '余额偏低'
          : '余额正常',
    trendDays,
    trend,
    toolUsage: (Object.entries(toolUsageMap) as [
      AiUsageLogItem['toolType'],
      { toolName: string; tokens: number; calls: number },
    ][]).map(([toolType, usage]) => ({
      toolType,
      toolName: usage.toolName,
      tokens: usage.tokens,
      calls: usage.calls,
    })),
    guestTrial: {
      dailyLimit: 3,
      used: 1,
      remaining: 2,
      exceeded: false,
    },
  };
}

export const aiTemplates: AiTemplate[] = [
  {
    id: 'tpl-cover-qwen',
    title: '知识文章封面',
    description: '为技术文章生成干净、可读的横版封面。',
    toolType: 'image',
    modelId: 'dall-e-3',
    coverUrl:
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    prompt: '为一篇关于 React 工程化的技术文章生成简洁封面，深色背景，蓝绿色科技感。',
    params: { size: '16:9', style: '科技感', count: 1 },
    tags: ['封面', '技术文章'],
    usageCount: 118,
  },
  {
    id: 'tpl-video-intro',
    title: '产品介绍短片',
    description: '生成适合首页使用的 6 秒产品概念视频。',
    toolType: 'video',
    modelId: 'video-mock-v1',
    coverUrl:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
    prompt: '一个个人知识中台的产品介绍短片，轻快镜头，现代桌面工作流。',
    params: { size: '16:9', durationSeconds: 6, style: '产品运镜', count: 1 },
    tags: ['视频', '产品介绍'],
    usageCount: 86,
  },
  {
    id: 'tpl-weekly-report',
    title: '周报提纲',
    description: '把零散工作记录整理成结构清晰的周报。',
    toolType: 'text',
    modelId: 'qwen-turbo',
    coverUrl:
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80',
    prompt: '请根据我的工作记录整理一份包含本周进展、问题风险、下周计划的周报。',
    textScenario: 'write',
    textTone: 'professional',
    textLength: 'medium',
    tags: ['写作', '周报'],
    usageCount: 246,
  },
];

export const aiConversations: AiConversation[] = [
  {
    id: 'sess-react-reading',
    title: '帮我总结 React 小册重点',
    modelId: 'qwen-turbo',
    systemPrompt: defaultAiChatSettings.systemPrompt,
    contextLimit: 20,
    enableKnowledgeReference: true,
    messageCount: 4,
    totalTokens: 1280,
    lastMessageAt: '2026-07-05T09:20:00.000Z',
  },
  {
    id: 'sess-cover-idea',
    title: '技术文章封面灵感',
    modelId: 'qwen-image',
    systemPrompt: '你是图片创意助手，优先给出清晰的视觉方向和可复用 Prompt。',
    contextLimit: 10,
    enableKnowledgeReference: false,
    messageCount: 2,
    totalTokens: 580,
    lastMessageAt: '2026-07-05T08:10:00.000Z',
  },
];

export const aiMessages: AiMessage[] = [
  {
    id: 'msg-1',
    sessionId: 'sess-react-reading',
    role: 'user',
    content: '帮我把这篇 React 小册整理成 5 个核心知识点。',
    status: 'done',
    createdAt: '2026-07-05T09:18:00.000Z',
    tokenCount: 120,
  },
  {
    id: 'msg-2',
    sessionId: 'sess-react-reading',
    role: 'assistant',
    content:
      '可以。建议从组件模型、状态流、路由边界、工程化约束和性能优化五个角度整理。',
    status: 'done',
    createdAt: '2026-07-05T09:18:12.000Z',
    tokenCount: 260,
  },
];

function createAiConversationId() {
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createAiMessageId(role: AiMessage['role']) {
  return `msg-${role}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeConversationTitle(title?: string) {
  const normalized = title?.trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, 40) : '新对话';
}

function guessConversationTitle(messages: AiMessage[], fallbackTitle?: string) {
  if (fallbackTitle?.trim()) return normalizeConversationTitle(fallbackTitle);
  const firstUserMessage = messages.find((message) => message.role === 'user');
  return normalizeConversationTitle(firstUserMessage?.content.slice(0, 20));
}

function countConversationTokens(messages: AiMessage[]) {
  return messages.reduce(
    (sum, message) =>
      sum + (message.tokenCount ?? Math.max(20, Math.ceil(message.content.length / 2))),
    0,
  );
}

function sortAiConversationsByLastMessage() {
  aiConversations.sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

function resolveAiConversationSettings(
  settings?: AiConversationSettings,
): Required<AiConversationSettings> {
  return {
    ...defaultAiChatSettings,
    ...settings,
    modelId: settings?.modelId ?? defaultAiChatSettings.modelId,
    systemPrompt:
      settings?.systemPrompt?.trim() || defaultAiChatSettings.systemPrompt,
    contextLimit:
      settings?.contextLimit && settings.contextLimit > 0
        ? settings.contextLimit
        : defaultAiChatSettings.contextLimit,
    enableKnowledgeReference:
      settings?.enableKnowledgeReference ?? defaultAiChatSettings.enableKnowledgeReference,
  };
}

function applyAiConversationSettings(
  conversation: AiConversation,
  settings?: AiConversationSettings,
) {
  const resolvedSettings = resolveAiConversationSettings({
    modelId: conversation.modelId,
    systemPrompt: conversation.systemPrompt,
    contextLimit: conversation.contextLimit,
    enableKnowledgeReference: conversation.enableKnowledgeReference,
    ...settings,
  });
  conversation.modelId = resolvedSettings.modelId;
  conversation.systemPrompt = resolvedSettings.systemPrompt;
  conversation.contextLimit = resolvedSettings.contextLimit;
  conversation.enableKnowledgeReference = resolvedSettings.enableKnowledgeReference;
}

/** 新建 AI Chat 会话，并写入统一 mock store，供 AI 工作台和工作区历史共用。 */
export function createAiConversation(input: AiConversationCreateInput = {}) {
  const now = new Date().toISOString();
  const settings = resolveAiConversationSettings(input.settings);
  const conversation: AiConversation = {
    id: createAiConversationId(),
    title: normalizeConversationTitle(input.title),
    modelId: settings.modelId,
    systemPrompt: settings.systemPrompt,
    contextLimit: settings.contextLimit,
    enableKnowledgeReference: settings.enableKnowledgeReference,
    messageCount: 0,
    totalTokens: 0,
    lastMessageAt: now,
  };
  aiConversations.unshift(conversation);
  return conversation;
}

/**
 * 保存一轮 Chat 消息。
 *
 * 前端 mock 流完成后一次性提交本轮 user/assistant 消息；store 根据完整消息重新派生
 * 会话标题、消息数和 Token 总量，避免多个页面各自维护统计口径。
 */
export function persistAiChatMessages(
  sessionId: string,
  input: AiChatMessagesPersistInput,
) {
  const existingConversation =
    aiConversations.find((conversation) => conversation.id === sessionId) ??
    createAiConversation({
      title: input.title,
      settings: input.settings,
    });
  const resolvedSessionId = existingConversation.id;
  if (input.replaceLastAssistant) {
    for (let index = aiMessages.length - 1; index >= 0; index -= 1) {
      const message = aiMessages[index];
      if (message.sessionId === resolvedSessionId && message.role === 'assistant') {
        aiMessages.splice(index, 1);
        break;
      }
    }
  }
  const savedMessages = input.messages.map<AiMessage>((message) => ({
    id: createAiMessageId(message.role),
    sessionId: resolvedSessionId,
    role: message.role,
    content: message.content,
    status: message.status,
    createdAt: message.createdAt,
    tokenCount: message.tokenCount,
    feedback: message.feedback,
    feedbackAt: message.feedbackAt,
  }));

  aiMessages.push(...savedMessages);
  const conversationMessages = aiMessages.filter(
    (message) => message.sessionId === resolvedSessionId,
  );
  const lastMessage = conversationMessages.at(-1);
  existingConversation.title = guessConversationTitle(
    conversationMessages,
    existingConversation.messageCount === 0 ? input.title : existingConversation.title,
  );
  applyAiConversationSettings(existingConversation, input.settings);
  existingConversation.messageCount = conversationMessages.length;
  existingConversation.totalTokens = countConversationTokens(conversationMessages);
  existingConversation.lastMessageAt = lastMessage?.createdAt ?? new Date().toISOString();
  sortAiConversationsByLastMessage();

  return {
    conversation: existingConversation,
    messages: aiMessages.filter((message) => message.sessionId === resolvedSessionId),
  };
}

/** 更新 AI Chat 会话元信息，当前主要服务重命名和模型选择 mock。 */
export function updateAiConversation(
  sessionId: string,
  input: AiConversationUpdateInput,
) {
  const conversation = aiConversations.find((item) => item.id === sessionId);
  if (!conversation) return undefined;
  if (input.title !== undefined) {
    conversation.title = normalizeConversationTitle(input.title);
  }
  applyAiConversationSettings(conversation, input.settings);
  conversation.lastMessageAt = new Date().toISOString();
  sortAiConversationsByLastMessage();
  return conversation;
}

/** 更新 AI 回复消息反馈；阶段 5 仅支持 assistant 消息的点踩和取消点踩。 */
export function updateAiMessageFeedback(
  messageId: string,
  input: AiMessageFeedbackInput,
) {
  const message = aiMessages.find((item) => item.id === messageId);
  if (!message || message.role !== 'assistant') return undefined;
  if (input.feedback) {
    message.feedback = input.feedback;
    message.feedbackAt = new Date().toISOString();
    return message;
  }
  delete message.feedback;
  delete message.feedbackAt;
  return message;
}

/** 删除 AI Chat 会话，同时清理消息，避免工作区历史删除后 AI 对话页仍残留消息。 */
export function deleteAiConversation(sessionId: string) {
  const conversationIndex = aiConversations.findIndex((item) => item.id === sessionId);
  if (conversationIndex < 0) return false;
  aiConversations.splice(conversationIndex, 1);
  for (let index = aiMessages.length - 1; index >= 0; index -= 1) {
    if (aiMessages[index].sessionId === sessionId) {
      aiMessages.splice(index, 1);
    }
  }
  return true;
}

export const aiAssets: AiAsset[] = [
  {
    id: 'asset-cover-1',
    title: 'React 工程化封面草稿',
    type: 'image',
    source: 'generated',
    status: 'saved',
    modelId: 'qwen-image',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=900&q=80',
    fileUrl:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=90',
    prompt: 'React 工程化文章封面，蓝绿色科技风，简洁排版。',
    createdAt: '2026-07-05T07:30:00.000Z',
    updatedAt: '2026-07-05T07:30:00.000Z',
    favorite: true,
    folderId: 'folder-react',
    folderName: 'React 内容计划',
    lastUsedAt: '2026-07-05T08:30:00.000Z',
  },
  {
    id: 'asset-video-1',
    title: '个人知识中台介绍短片',
    type: 'video',
    source: 'generated',
    status: 'draft',
    modelId: 'seedance-lite',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80',
    fileUrl: 'https://example.com/mock/personal-hub-intro.mp4',
    prompt: '个人知识中台产品介绍短片，现代工作台，温暖科技感。',
    createdAt: '2026-07-05T07:40:00.000Z',
    updatedAt: '2026-07-05T07:40:00.000Z',
    folderId: 'folder-brand',
    folderName: '品牌素材',
    lastUsedAt: '2026-07-05T08:20:00.000Z',
  },
  {
    id: 'asset-weekly-text-1',
    title: '周报提纲生成稿',
    type: 'text',
    source: 'generated',
    status: 'saved',
    modelId: 'qwen-turbo',
    prompt: '把本周工作记录整理成周报。',
    createdAt: '2026-07-04T10:20:00.000Z',
    updatedAt: '2026-07-04T10:25:00.000Z',
    favorite: true,
    folderId: 'folder-writing',
    folderName: '写作素材',
    lastUsedAt: '2026-07-05T08:00:00.000Z',
    shared: true,
  },
  {
    id: 'asset-reference-upload-1',
    title: '产品工作台参考图',
    type: 'attachment',
    source: 'uploaded',
    status: 'saved',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80',
    fileUrl:
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=90',
    prompt: '用于图片生成的工作台参考图。',
    createdAt: '2026-07-03T09:10:00.000Z',
    updatedAt: '2026-07-03T09:15:00.000Z',
    folderId: 'folder-brand',
    folderName: '品牌素材',
    lastUsedAt: '2026-07-04T13:20:00.000Z',
  },
  {
    id: 'asset-content-ref-1',
    title: 'React 小册引用摘要',
    type: 'conversation',
    source: 'content-reference',
    status: 'published',
    modelId: 'qwen-plus',
    prompt: '从 React 小册中提取可复用的上下文摘要。',
    createdAt: '2026-07-02T15:20:00.000Z',
    updatedAt: '2026-07-02T15:40:00.000Z',
    folderId: 'folder-react',
    folderName: 'React 内容计划',
    shared: true,
  },
  {
    id: 'asset-trash-demo',
    title: '废弃封面草稿',
    type: 'image',
    source: 'generated',
    status: 'trashed',
    modelId: 'qwen-image',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    prompt: '早期废弃的文章封面方向。',
    createdAt: '2026-07-01T11:00:00.000Z',
    updatedAt: '2026-07-05T11:00:00.000Z',
    folderId: 'folder-react',
    folderName: 'React 内容计划',
  },
];

export const aiAssetFolders: AiAssetFolder[] = [
  {
    id: 'folder-ai-generation',
    name: 'AI 生成结果',
    assetCount: 0,
    createdAt: '2026-07-05T07:20:00.000Z',
    updatedAt: '2026-07-05T07:40:00.000Z',
  },
  {
    id: 'folder-react',
    name: 'React 内容计划',
    assetCount: 0,
    createdAt: '2026-07-02T10:00:00.000Z',
    updatedAt: '2026-07-05T08:30:00.000Z',
  },
  {
    id: 'folder-brand',
    name: '品牌素材',
    assetCount: 0,
    createdAt: '2026-07-03T10:00:00.000Z',
    updatedAt: '2026-07-05T08:20:00.000Z',
  },
  {
    id: 'folder-writing',
    name: '写作素材',
    assetCount: 0,
    createdAt: '2026-07-04T10:00:00.000Z',
    updatedAt: '2026-07-05T08:00:00.000Z',
  },
  {
    id: 'folder-empty-inspiration',
    name: '灵感暂存',
    assetCount: 0,
    createdAt: '2026-07-05T10:00:00.000Z',
    updatedAt: '2026-07-05T10:00:00.000Z',
  },
];

export const aiRecentTasks: AiGenerationTask[] = [
  {
    id: 'task-image-cover',
    toolType: 'image',
    title: '知识文章封面',
    prompt: '为 React 工程化文章生成封面。',
    modelId: 'qwen-image',
    status: 'done',
    assetIds: ['asset-cover-1'],
    createdAt: '2026-07-05T07:30:00.000Z',
  },
  {
    id: 'task-video-intro',
    toolType: 'video',
    title: '产品介绍短片',
    prompt: '生成个人知识中台介绍短片。',
    modelId: 'seedance-lite',
    status: 'done',
    assetIds: ['asset-video-1'],
    createdAt: '2026-07-05T07:40:00.000Z',
  },
];

function getAiRecentActivityPath(task: AiGenerationTask) {
  if (task.assetIds.length > 0) return '/ai/assets';
  return `/ai/${task.toolType}`;
}

/** AI 首页最近创作从会话和生成任务派生，避免首页再各自拼接多个 mock 数据源。 */
function getAiRecentActivities() {
  const conversationActivities = aiConversations.map((conversation) => ({
    id: `conversation-${conversation.id}`,
    title: conversation.title,
    toolType: 'chat' as const,
    status: 'done' as const,
    modelId: conversation.modelId,
    path: `/ai/chat?sessionId=${encodeURIComponent(conversation.id)}`,
    description: `${conversation.messageCount} 条消息 · ${conversation.totalTokens.toLocaleString()} Token`,
    createdAt: conversation.lastMessageAt,
    tokenCount: conversation.totalTokens,
  }));
  const taskActivities = aiRecentTasks.map((task) => ({
    id: `task-${task.id}`,
    title: task.title,
    toolType: task.toolType,
    status: task.status,
    modelId: task.modelId,
    path: getAiRecentActivityPath(task),
    description: task.prompt,
    createdAt: task.createdAt,
  }));

  return [...conversationActivities, ...taskActivities]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);
}

function normalizeQuotaTokens(tokens: number) {
  return Math.max(0, Math.ceil(Number.isFinite(tokens) ? tokens : 0));
}

/** 扣减 AI Token 配额，并写入 mock 用量明细。余额不足时不扣减。 */
export function consumeAiQuota(input: AiQuotaConsumeInput) {
  const tokens = normalizeQuotaTokens(input.tokens);
  if (tokens <= 0) {
    return { quota: aiQuota, consumed: false, reason: 'invalidTokens' as const };
  }
  if (aiQuota.remainingTokens < tokens) {
    return { quota: aiQuota, consumed: false, reason: 'insufficient' as const };
  }

  aiQuota.usedTokens += tokens;
  aiQuota.remainingTokens = Math.max(0, aiQuota.totalTokens - aiQuota.usedTokens);
  aiUsageLogs.unshift({
    id: `usage-${input.toolType}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    toolType: input.toolType,
    toolName: aiToolNameMap[input.toolType],
    tokens,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  });
  return { quota: aiQuota, consumed: true as const };
}

/** 工作区我的用量从 AI 配额和明细派生，保证 AI 工作台余额与工作区一致。 */
export function getWorkspaceUsageFromAiQuota() {
  return {
    totalTokens: aiQuota.totalTokens,
    usedTokens: aiQuota.usedTokens,
    remainingTokens: aiQuota.remainingTokens,
    recent: aiUsageLogs.slice(0, 7).map((log) => ({
      date: log.createdAt.slice(0, 10),
      tokens: log.tokens,
      reason: `${log.toolName}：${log.reason}`,
    })),
  };
}

function createAiAssetId(type: AiAsset['type']) {
  return `asset-${type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createAiGenerationTaskId(toolType: AiGenerationTask['toolType']) {
  return `task-${toolType}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function pushAiRecentTask(task: AiGenerationTask) {
  aiRecentTasks.unshift(task);
  if (aiRecentTasks.length > 20) {
    aiRecentTasks.splice(20);
  }
}

/**
 * 保存 AI 生成结果到 mock 资产库。
 *
 * id、时间和默认归档信息由 mock store 统一补齐，保持页面层只关心业务内容；
 * 后续接真实后端时也应由服务端承担这些字段的可信写入。
 */
export function createAiAsset(input: AiAssetCreateInput): AiAsset {
  const now = new Date().toISOString();
  const resolvedFolder = resolveAiAssetFolder(
    input.folderId ?? 'folder-writing',
    input.folderName ?? '写作素材',
  );
  const asset: AiAsset = {
    id: createAiAssetId(input.type),
    title: input.title.trim() || '未命名 AI 资产',
    type: input.type,
    source: input.source ?? 'generated',
    status: input.status ?? 'saved',
    modelId: input.modelId,
    thumbnailUrl: input.thumbnailUrl,
    fileUrl: input.fileUrl,
    content: input.content,
    prompt: input.prompt,
    createdAt: now,
    updatedAt: now,
    folderId: resolvedFolder.folderId,
    folderName: resolvedFolder.folderName,
    lastUsedAt: now,
  };
  aiAssets.unshift(asset);
  return asset;
}

const aiTextScenarioLabels: Record<AiTextGenerateInput['scenario'], string> = {
  write: '写作辅助',
  rewrite: '改写润色',
  summary: '摘要提炼',
  expand: '扩写',
  translate: '翻译',
  custom: '自定义 Prompt',
};

function estimateAiTextTokens(input: AiTextGenerateInput) {
  const lengthRatio =
    input.length === 'short' ? 1.1 : input.length === 'long' ? 2.1 : 1.5;
  return Math.max(180, Math.ceil(input.input.trim().length * lengthRatio + 160));
}

function buildAiTextGenerateOutput(input: AiTextGenerateInput) {
  const label = aiTextScenarioLabels[input.scenario];
  const toneText =
    input.tone === 'professional'
      ? '专业'
      : input.tone === 'formal'
        ? '正式'
        : '轻松';
  const lengthText =
    input.length === 'short' ? '短' : input.length === 'long' ? '长' : '中';
  const normalizedInput = input.input.trim();

  return [
    `## ${label}结果`,
    '',
    `我会按“${toneText}”语气输出一版${lengthText}篇幅草稿，模型暂用 ${input.modelId}。`,
    '',
    '### 核心思路',
    '',
    `- 先保留原始输入的主题：${normalizedInput.slice(0, 42)}${normalizedInput.length > 42 ? '...' : ''}`,
    '- 再把内容整理成目标、结构、表达三个层次。',
    '- 最后给出可以继续编辑的版本，而不是一次性锁死结果。',
    '',
    '### 生成草稿',
    '',
    input.scenario === 'summary'
      ? '这段内容可以归纳为：目标明确、约束清晰、执行路径可拆解。后续建议补充关键证据、示例和风险说明。'
      : '基于当前输入，可以先写成一个清晰的开头：这个需求的重点不是堆功能，而是把用户输入、参数、生成结果和后续编辑动作串成一个稳定闭环。',
    '',
    input.scenario === 'translate'
      ? `目标语言：${input.targetLanguage || '英文'}。真实接入后这里会把语言参数提交给后端模型。`
      : '你可以继续要求我改成更短、更正式，或补充案例。',
  ].join('\n');
}

/** 文本生成 mock 接口契约，先返回完整 Markdown，页面仍可自行做流式展示。 */
export function generateAiText(input: AiTextGenerateInput): AiTextGenerateResult {
  const now = new Date().toISOString();
  const normalizedInput = input.input.trim();
  const scenarioLabel = aiTextScenarioLabels[input.scenario];
  const output = buildAiTextGenerateOutput({ ...input, input: normalizedInput });
  const estimatedTokens = estimateAiTextTokens({ ...input, input: normalizedInput });
  const task: AiGenerationTask = {
    id: createAiGenerationTaskId('text'),
    toolType: 'text',
    title: `${scenarioLabel}：${normalizedInput.slice(0, 18) || '未命名结果'}`,
    prompt: normalizedInput,
    modelId: input.modelId,
    status: 'done',
    assetIds: [],
    params: {},
    createdAt: now,
  };

  pushAiRecentTask(task);

  return { output, estimatedTokens, task };
}

const aiImageCovers = [
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
];

const aiVideoCovers = [
  'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
];

function createAiMediaTask(
  toolType: Extract<AiGenerationTask['toolType'], 'image' | 'video'>,
  input: AiMediaGenerateInput,
  assets: AiAsset[],
  status: AiGenerationTask['status'],
): AiGenerationTask {
  return {
    id: createAiGenerationTaskId(toolType),
    toolType,
    title: input.title.trim() || (toolType === 'image' ? '图片结果' : '视频结果'),
    prompt: input.prompt.trim(),
    modelId: input.modelId,
    status,
    assetIds: assets.map((asset) => asset.id),
    params: input.params ?? {},
    createdAt: new Date().toISOString(),
  };
}

/** 图片 / 视频生成 mock 接口契约，成功时统一写入资产库和最近任务。 */
export function generateAiMedia(
  toolType: Extract<AiGenerationTask['toolType'], 'image' | 'video'>,
  input: AiMediaGenerateInput,
): AiMediaGenerateResult {
  if (input.simulateFailure) {
    const failedTask = createAiMediaTask(toolType, input, [], 'failed');
    pushAiRecentTask(failedTask);
    return { task: failedTask, assets: [] };
  }

  const rawCount = input.params?.count ?? 1;
  const count =
    toolType === 'video' ? 1 : Math.min(Math.max(rawCount, 1), 4);
  const covers = toolType === 'image' ? aiImageCovers : aiVideoCovers;
  const titlePrefix = toolType === 'image' ? '图片结果' : '视频结果';
  const assets = Array.from({ length: count }, (_, index) => {
    const assetIndex = index + 1;
    const mediaUrl = covers[index % covers.length];
    return createAiAsset({
      title: `${input.title.trim() || titlePrefix} ${assetIndex}`,
      type: toolType,
      source: 'generated',
      status: 'saved',
      modelId: input.modelId,
      thumbnailUrl: mediaUrl,
      fileUrl:
        toolType === 'image'
          ? mediaUrl.replace('w=900', 'w=1600')
          : `https://example.com/mock/${toolType}-${Date.now()}-${assetIndex}.mp4`,
      prompt: input.prompt,
      folderId: 'folder-ai-generation',
      folderName: 'AI 生成结果',
    });
  });
  const task = createAiMediaTask(toolType, input, assets, 'done');
  pushAiRecentTask(task);

  return { task, assets };
}

export function moveAiAssetToTrash(id: string): AiAsset | undefined {
  const asset = aiAssets.find((item) => item.id === id);
  if (!asset) return undefined;
  asset.status = 'trashed';
  asset.updatedAt = new Date().toISOString();
  return asset;
}

export function restoreAiAsset(id: string): AiAsset | undefined {
  const asset = aiAssets.find((item) => item.id === id);
  if (!asset) return undefined;
  asset.status = 'saved';
  asset.updatedAt = new Date().toISOString();
  return asset;
}

export function deleteAiAssetPermanently(id: string): boolean {
  const index = aiAssets.findIndex((item) => item.id === id);
  if (index < 0) return false;
  aiAssets.splice(index, 1);
  return true;
}

function countAiAssetFolderAssets(folderId: string) {
  return aiAssets.filter(
    (asset) => asset.status !== 'trashed' && asset.folderId === folderId,
  ).length;
}

/** 获取 AI 资产项目文件夹列表，assetCount 每次由当前资产内存态派生。 */
export function getAiAssetFolders(): AiAssetFolder[] {
  return aiAssetFolders.map((folder) => ({
    ...folder,
    assetCount: countAiAssetFolderAssets(folder.id),
  }));
}

function resolveAiAssetFolder(folderId?: string, folderName?: string) {
  if (!folderId) {
    return { folderId: undefined, folderName: undefined };
  }

  const existingFolder = aiAssetFolders.find((folder) => folder.id === folderId);

  return {
    folderId,
    folderName: folderName || existingFolder?.name || folderId,
  };
}

/** 移动 AI 资产到项目文件夹；folderId 为空时表示取消归档。 */
export function moveAiAssetToFolder(
  id: string,
  folderId?: string,
  folderName?: string,
): AiAsset | undefined {
  const asset = aiAssets.find((item) => item.id === id);
  if (!asset) return undefined;
  const resolvedFolder = resolveAiAssetFolder(folderId, folderName);
  asset.folderId = resolvedFolder.folderId;
  asset.folderName = resolvedFolder.folderName;
  asset.updatedAt = new Date().toISOString();
  return asset;
}

export function batchMoveAiAssetsToTrash(ids: string[]): string[] {
  const changed: string[] = [];
  for (const id of ids) {
    const asset = moveAiAssetToTrash(id);
    if (asset) changed.push(id);
  }
  return changed;
}

export function batchRestoreAiAssets(ids: string[]): string[] {
  const changed: string[] = [];
  for (const id of ids) {
    const asset = restoreAiAsset(id);
    if (asset) changed.push(id);
  }
  return changed;
}

export function batchMoveAiAssetsToFolder(
  ids: string[],
  folderId?: string,
  folderName?: string,
): string[] {
  const changed: string[] = [];
  for (const id of ids) {
    const asset = moveAiAssetToFolder(id, folderId, folderName);
    if (asset) changed.push(id);
  }
  return changed;
}

export function batchDeleteAiAssetsPermanently(ids: string[]): string[] {
  const deleted: string[] = [];
  for (const id of ids) {
    if (deleteAiAssetPermanently(id)) deleted.push(id);
  }
  return deleted;
}

function normalizeAiAssetFolderName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

/** 新建 AI 资产项目文件夹。阶段 5 使用内存态 mock，允许先创建空文件夹。 */
export function createAiAssetFolder(name: string): AiAssetFolder {
  const normalizedName = normalizeAiAssetFolderName(name);
  const now = new Date().toISOString();
  const folder: AiAssetFolder = {
    id: `folder-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: normalizedName,
    assetCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  aiAssetFolders.unshift(folder);
  return folder;
}

/** 重命名 AI 资产项目文件夹，并同步更新已归档资产上的展示名。 */
export function renameAiAssetFolder(
  folderId: string,
  name: string,
): AiAssetFolder | undefined {
  const folder = aiAssetFolders.find((item) => item.id === folderId);
  if (!folder) return undefined;
  const normalizedName = normalizeAiAssetFolderName(name);
  folder.name = normalizedName;
  folder.updatedAt = new Date().toISOString();
  for (const asset of aiAssets) {
    if (asset.folderId === folderId) {
      asset.folderName = normalizedName;
      asset.updatedAt = folder.updatedAt;
    }
  }
  return { ...folder, assetCount: countAiAssetFolderAssets(folder.id) };
}

/** 删除空项目文件夹；非空文件夹返回失败原因，由页面提示用户先移动资产。 */
export function deleteEmptyAiAssetFolder(folderId: string) {
  const folderIndex = aiAssetFolders.findIndex((folder) => folder.id === folderId);
  if (folderIndex < 0) return { folderId, deleted: false, reason: 'notFound' as const };
  const assetCount = countAiAssetFolderAssets(folderId);
  if (assetCount > 0) {
    return { folderId, deleted: false, reason: 'notEmpty' as const };
  }
  aiAssetFolders.splice(folderIndex, 1);
  return { folderId, deleted: true };
}

export function getAiHomeData(): AiHomeData {
  return {
    brandName: adminAiConfigData.branding.brandName || aiBrandName,
    tools: aiTools,
    models: aiModels.filter((model) => model.enabled),
    quota: aiQuota,
    templates: aiTemplates,
    recentTasks: aiRecentTasks,
    recentActivities: getAiRecentActivities(),
  };
}

export function getAiMembershipData(): AiMembershipData {
  return {
    currentPlanId: 'free',
    currentPlanName: '免费版',
    quota: aiQuota,
    plans: aiMembershipPlans,
    inviteRecords: aiInviteRecords,
    usageOverview: getAiMembershipUsageOverview(),
  };
}
