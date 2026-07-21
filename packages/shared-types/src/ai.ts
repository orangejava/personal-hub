/**
 * AI 平台共享类型。
 *
 * 阶段 5 先服务 React-first mock，实现时刻意保持字段接近后续 NestJS API，
 * 这样后续接真实后端时页面层不需要大面积改结构。
 */

export type AiToolType =
  | 'chat'
  | 'text'
  | 'image'
  | 'video'
  | 'webui'
  | 'comfyui'
  | 'lora'
  | 'apps';

export type AiToolStatus = 'enabled' | 'disabled' | 'comingSoon';

export type AiAssetType = 'image' | 'video' | 'text' | 'conversation' | 'attachment';

export type AiAssetSource = 'generated' | 'uploaded' | 'content-reference';

export type AiAssetStatus =
  | 'draft'
  | 'saved'
  | 'published'
  | 'failed'
  | 'trashed';

export type AiGenerationStatus = 'idle' | 'generating' | 'done' | 'failed' | 'stopped';

export interface AiTool {
  code: AiToolType;
  name: string;
  description: string;
  group: 'home' | 'create' | 'assets' | 'profile' | 'commerce' | 'help' | 'open';
  path: string;
  status: AiToolStatus;
  icon: string;
  modelTags?: string[];
  requiresLogin?: boolean;
  defaultModelId?: string;
  tokenCostLabel?: string;
  guestTrialEnabled?: boolean;
}

export interface AiModel {
  id: string;
  name: string;
  provider: string;
  toolTypes: AiToolType[];
  enabled: boolean;
  isDefault?: boolean;
  description?: string;
}

export interface AiQuotaSummary {
  totalTokens: number;
  usedTokens: number;
  remainingTokens: number;
  lowBalanceThreshold: number;
}

export interface AiUsageLogItem {
  id: string;
  toolType: Extract<AiToolType, 'chat' | 'text' | 'image' | 'video'>;
  toolName: string;
  tokens: number;
  reason: string;
  createdAt: string;
}

export interface AiQuotaConsumeInput {
  tokens: number;
  toolType: Extract<AiToolType, 'chat' | 'text' | 'image' | 'video'>;
  reason: string;
}

export interface AiMembershipPlan {
  id: string;
  name: string;
  description: string;
  monthlyTokens: number;
  priceLabel: string;
  badge?: string;
  highlighted?: boolean;
  benefits: string[];
}

export interface AiInviteRecord {
  id: string;
  title: string;
  status: 'pending' | 'claimed';
  rewardTokens: number;
  createdAt: string;
}

export interface AiMembershipUsageTrendItem {
  date: string;
  tokens: number;
}

export interface AiMembershipToolUsageItem {
  toolType: Extract<AiToolType, 'chat' | 'text' | 'image' | 'video'>;
  toolName: string;
  tokens: number;
  calls: number;
}

export interface AiMembershipUsageOverview {
  balanceStatus: 'normal' | 'low' | 'insufficient';
  balanceStatusText: string;
  trendDays: number;
  trend: AiMembershipUsageTrendItem[];
  toolUsage: AiMembershipToolUsageItem[];
  guestTrial: {
    dailyLimit: number;
    used: number;
    remaining: number;
    exceeded: boolean;
  };
}

export interface AiTemplate {
  id: string;
  title: string;
  description: string;
  toolType: Extract<AiToolType, 'chat' | 'text' | 'image' | 'video'>;
  modelId: string;
  coverUrl: string;
  prompt: string;
  /**
   * 模板预填参数。
   *
   * 图片/视频模板可直接落到生成参数；文本模板则通过下方 text* 字段映射到
   * 文本生成草稿，避免页面层把标题、标签等展示字段误当成生成配置。
   */
  params?: AiGenerationParams;
  textScenario?: 'write' | 'rewrite' | 'summary' | 'expand' | 'translate' | 'custom';
  textTone?: 'professional' | 'formal' | 'casual';
  textLength?: 'short' | 'medium' | 'long';
  targetLanguage?: string;
  tags: string[];
  usageCount: number;
}

export interface AiConversation {
  id: string;
  title: string;
  modelId: string;
  systemPrompt?: string;
  contextLimit?: number;
  enableKnowledgeReference?: boolean;
  messageCount: number;
  totalTokens: number;
  lastMessageAt: string;
}

/** AI Chat 会话级设置，后续可直接映射到真实会话表或会话配置表。 */
export interface AiConversationSettings {
  modelId?: string;
  systemPrompt?: string;
  contextLimit?: number;
  enableKnowledgeReference?: boolean;
}

export interface AiMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: AiGenerationStatus;
  createdAt: string;
  tokenCount?: number;
  feedback?: 'dislike';
  feedbackAt?: string;
  parts?: AiMessagePart[];
}

export type AiMessagePartType =
  | 'reasoning'
  | 'thought_chain'
  | 'content'
  | 'source'
  | 'done';

export interface AiMessagePart {
  id: string;
  type: AiMessagePartType;
  content: string;
  title?: string;
  status?: 'pending' | 'processing' | 'success' | 'error';
  sourceUrl?: string;
}

/** 更新 AI 回复消息反馈。feedback 为空表示取消反馈。 */
export interface AiMessageFeedbackInput {
  feedback?: 'dislike';
}

/** 新建 AI 对话会话输入。 */
export interface AiConversationCreateInput {
  title?: string;
  settings?: AiConversationSettings;
}

/** 重命名或更新 AI 对话会话输入。 */
export interface AiConversationUpdateInput {
  title?: string;
  settings?: AiConversationSettings;
}

/**
 * Chat 消息保存输入。
 *
 * 阶段 5 的 mock 流式输出仍在前端完成，但只在自然完成后一次性保存 user/assistant
 * 消息，避免停止生成、半截输出或失败重试被误记为正式历史。
 */
export interface AiChatMessagesPersistInput {
  messages: Pick<
    AiMessage,
    | 'role'
    | 'content'
    | 'status'
    | 'createdAt'
    | 'tokenCount'
    | 'feedback'
    | 'feedbackAt'
    | 'parts'
  >[];
  settings?: AiConversationSettings;
  title?: string;
  replaceLastAssistant?: boolean;
}

export interface AiAsset {
  id: string;
  title: string;
  type: AiAssetType;
  source: AiAssetSource;
  status: AiAssetStatus;
  modelId?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  content?: string;
  prompt?: string;
  createdAt: string;
  updatedAt: string;
  favorite?: boolean;
  folderId?: string;
  folderName?: string;
  lastUsedAt?: string;
  shared?: boolean;
}

export interface AiAssetFolder {
  id: string;
  name: string;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiGenerationParams {
  size?: '1:1' | '16:9' | '9:16';
  count?: 1 | 2 | 4;
  durationSeconds?: number;
  style?: string;
  quality?: string;
  resolution?: string;
  seed?: number;
  attachments?: string[];
}

export interface AiGenerationTask {
  id: string;
  toolType: Extract<AiToolType, 'image' | 'video' | 'text'>;
  title: string;
  prompt: string;
  modelId: string;
  status: AiGenerationStatus;
  assetIds: string[];
  params?: AiGenerationParams;
  createdAt: string;
}

export type AiTextScenario =
  | 'write'
  | 'rewrite'
  | 'summary'
  | 'expand'
  | 'translate'
  | 'custom';

export interface AiTextGenerateInput {
  scenario: AiTextScenario;
  input: string;
  modelId: string;
  tone: 'professional' | 'formal' | 'casual' | string;
  length: 'short' | 'medium' | 'long';
  targetLanguage?: string;
}

export interface AiTextGenerateResult {
  output: string;
  estimatedTokens: number;
  task: AiGenerationTask;
}

export interface AiMediaGenerateInput {
  title: string;
  prompt: string;
  modelId: string;
  params?: AiGenerationParams;
  simulateFailure?: boolean;
}

export interface AiMediaGenerateResult {
  task: AiGenerationTask;
  assets: AiAsset[];
}

/** AI 首页最近创作聚合项，统一承载最近会话和生成任务入口。 */
export interface AiRecentActivity {
  id: string;
  title: string;
  toolType: Extract<AiToolType, 'chat' | 'text' | 'image' | 'video'>;
  status: AiGenerationStatus;
  modelId: string;
  path: string;
  description?: string;
  createdAt: string;
  tokenCount?: number;
}

/** AI 资产移动到项目文件夹的输入。folderId 为空表示取消归档。 */
export interface AiAssetFolderMutationInput {
  folderId?: string;
  folderName?: string;
}

/**
 * 新建 AI 资产输入。
 *
 * 阶段 5 主要用于把 mock 生成结果保存到资产库；真实后端接入后仍由服务端
 * 负责生成 id、状态、归档时间和权限字段，前端只提交业务内容。
 */
export interface AiAssetCreateInput {
  title: string;
  type: AiAssetType;
  source?: AiAssetSource;
  status?: AiAssetStatus;
  modelId?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  content?: string;
  prompt?: string;
  folderId?: string;
  folderName?: string;
}

/** AI 资产项目文件夹创建 / 重命名输入。 */
export interface AiAssetFolderNameInput {
  name: string;
}

export interface AiHomeData {
  brandName: string;
  tools: AiTool[];
  models: AiModel[];
  quota: AiQuotaSummary;
  templates: AiTemplate[];
  recentTasks: AiGenerationTask[];
  recentActivities: AiRecentActivity[];
}

export interface AiMembershipData {
  currentPlanId: string;
  currentPlanName: string;
  quota: AiQuotaSummary;
  plans: AiMembershipPlan[];
  inviteRecords: AiInviteRecord[];
  usageOverview: AiMembershipUsageOverview;
}
