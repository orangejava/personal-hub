/**
 * 后台 mock 数据：用户、角色、分类、标签、文件、审计日志
 */
import {
  UserRole,
  ContentStatus,
  type AdminAiConfigData,
  type AdminAiBrandingConfig,
  type AdminAiBrandingMutationInput,
  type AdminAiModelCreateInput,
  type AdminAiModelConfig,
  type AdminAiModelMutationInput,
  type AdminAiProviderConfig,
  type AdminAiProviderMutationInput,
  type AdminAiStatsData,
  type AdminAiToolConfig,
  type AdminAiToolMutationInput,
  type AdminDashboardStats,
  type AdminFileRecord,
  type AdminMenuConfig,
  type AdminRoleRecord,
  type AdminUserRecord,
  type AuditLogItem,
  type CategoryRecord,
  type CategoryMutationInput,
  type HomepageConfig,
  type PermissionCode,
  type TagRecord,
} from '@personal-hub/shared-types';
import { contents } from './contents';
import { adminMenu, publicMenu, workspaceMenu } from './menus';

const allPermissions: PermissionCode[] = [
  'content:read',
  'content:write',
  'content:publish',
  'content:delete',
  'booklet:read',
  'booklet:write',
  'workspace:access',
  'admin:access',
  'user:manage',
  'role:manage',
  'ai:use',
  'ai:manage',
  'system:config',
];

export const adminUsers: AdminUserRecord[] = [
  {
    id: 'u-admin',
    email: 'admin@example.com',
    nickname: '管理员',
    role: UserRole.Admin,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u-editor',
    email: 'editor@example.com',
    nickname: '编辑者',
    role: UserRole.Editor,
    status: 'active',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'u-member',
    email: 'member@example.com',
    nickname: '普通会员',
    role: UserRole.Member,
    status: 'active',
    createdAt: '2026-03-01T00:00:00Z',
  },
];

export const adminRoles: AdminRoleRecord[] = [
  {
    code: UserRole.Admin,
    name: '管理员',
    description: '全部权限',
    version: 1,
    permissions: [...allPermissions],
  },
  {
    code: UserRole.Editor,
    name: '编辑者',
    version: 1,
    permissions: [
      'content:read',
      'content:write',
      'content:publish',
      'booklet:read',
      'booklet:write',
      'workspace:access',
      'ai:use',
    ],
  },
  {
    code: UserRole.Member,
    name: '普通会员',
    version: 1,
    permissions: ['content:read', 'booklet:read', 'ai:use'],
  },
];

const categorySeed: CategoryRecord[] = [
  { id: 'cat-1', name: '前端', slug: 'frontend', sort: 1 },
  { id: 'cat-1-1', name: 'React', slug: 'react', sort: 1, parentId: 'cat-1' },
  { id: 'cat-1-2', name: '工程化', slug: 'frontend-engineering', sort: 2, parentId: 'cat-1' },
  { id: 'cat-2', name: '后端', slug: 'backend', sort: 2 },
  { id: 'cat-2-1', name: 'NestJS', slug: 'nestjs', sort: 1, parentId: 'cat-2' },
  { id: 'cat-3', name: '工程', slug: 'engineering', sort: 3 },
  { id: 'cat-4', name: 'AI', slug: 'ai', sort: 4, parentId: 'cat-3' },
];

export const categories: CategoryRecord[] = categorySeed.map((item) => ({ ...item }));

export const tags: TagRecord[] = [
  { id: 'tag-1', name: 'React', slug: 'react', usageCount: 12 },
  { id: 'tag-2', name: 'NestJS', slug: 'nestjs', usageCount: 8 },
  { id: 'tag-3', name: 'Umi', slug: 'umi', usageCount: 5 },
];

export let adminFiles: AdminFileRecord[] = [
  {
    id: 'file-pdf-1',
    name: '系统设计面试指南.pdf',
    mimeType: 'application/pdf',
    size: 1024000,
    url: '/samples/sample.pdf',
    createdAt: '2026-06-01T10:00:00Z',
    usage: 'preview',
    storage: 'local',
    referencedBy: ['c-pdf-01'],
  },
  {
    id: 'file-word-1',
    name: '产品需求文档模板.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 560000,
    url: '/samples/sample.docx',
    createdAt: '2026-06-02T10:00:00Z',
    usage: 'preview',
    storage: 'local',
    referencedBy: ['c-word-01'],
  },
  {
    id: 'file-img-1',
    name: '首页 Hero 封面.png',
    mimeType: 'image/png',
    size: 240000,
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=home-hero',
    createdAt: '2026-06-03T10:00:00Z',
    usage: 'cover',
    storage: 'local',
    referencedBy: [],
  },
  {
    id: 'file-img-2',
    name: 'React 文章封面.svg',
    mimeType: 'image/svg+xml',
    size: 96000,
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=ssr',
    createdAt: '2026-06-04T10:00:00Z',
    usage: 'cover',
    storage: 'local',
    referencedBy: ['c-md-01'],
  },
  {
    id: 'file-zip-1',
    name: '小册导入包.zip',
    mimeType: 'application/zip',
    size: 2048000,
    url: '/samples/booklet.zip',
    createdAt: '2026-06-05T10:00:00Z',
    usage: 'attachment',
    storage: 'local',
    referencedBy: [],
  },
  {
    id: 'file-ai-asset-1',
    name: 'AI 生成封面草稿.png',
    mimeType: 'image/png',
    size: 420000,
    url: 'https://api.dicebear.com/7.x/shapes/svg?seed=ai-cover',
    createdAt: '2026-06-06T10:00:00Z',
    usage: 'asset',
    storage: 'local',
    referencedBy: [],
  },
];

export const homepageConfig: HomepageConfig = {
  hero: {
    title: '把知识沉淀成可复用的资产',
    subtitle: '内容阅读、内容生产和 AI 工具，一站完成。',
    primaryText: '浏览内容',
    primaryLink: '/content',
    secondaryText: '进入工作区',
    secondaryLink: '/workspace',
  },
  modules: [
    { key: 'hero', title: 'Hero 区块', visible: true, sort: 1 },
    { key: 'featured', title: '精选内容', visible: true, sort: 2 },
    { key: 'aiTools', title: 'AI 工具推荐', visible: true, sort: 3 },
    { key: 'techStack', title: '技术栈展示', visible: true, sort: 4 },
  ],
  featuredContent: {
    contentIds: ['c-md-01', 'c-md-02', 'c-book-01', 'c-pdf-01', 'c-word-01', 'c-rt-01'],
  },
  aiTools: [
    { key: 'chat', title: 'AI 对话', description: '多轮对话与知识引用。', enabled: true },
    { key: 'text', title: '文本生成', description: '摘要、改写、翻译与扩写。', enabled: true },
    { key: 'image', title: '图片生成', description: '根据提示词生成图片草稿。', enabled: true },
    { key: 'video', title: '视频生成', description: '阶段 5 后续占位能力。', enabled: false },
  ],
  techStack: [
    { name: 'React', category: 'frontend' },
    { name: 'Umi Max', category: 'frontend' },
    { name: 'Ant Design', category: 'ui' },
    { name: 'Turborepo', category: 'engineering' },
    { name: 'TypeScript', category: 'language' },
    { name: 'NestJS', category: 'backend' },
    { name: 'PostgreSQL', category: 'database' },
    { name: 'Redis', category: 'cache' },
  ],
};

export const menuConfig: AdminMenuConfig = {
  public: publicMenu,
  workspace: workspaceMenu,
  admin: adminMenu,
  ai: [
    { path: '/ai', name: 'ai.home', icon: 'home' },
    {
      path: '/ai/create',
      name: 'ai.create.group',
      icon: 'edit',
      children: [
        { path: '/ai/chat', name: 'ai.chat', icon: 'robot' },
        { path: '/ai/text', name: 'ai.text', icon: 'fileText' },
        { path: '/ai/image', name: 'ai.image', icon: 'project' },
        { path: '/ai/video', name: 'ai.video', icon: 'project' },
        { path: '/ai/apps', name: 'ai.apps', icon: 'appstore' },
      ],
    },
    { path: '/ai/assets', name: 'ai.assets', icon: 'folder' },
    { path: '/ai/membership', name: 'ai.membership', icon: 'crown' },
  ],
};

export const adminAiConfigData: AdminAiConfigData = {
  branding: {
    brandName: 'Personal Hub AI',
    logoText: 'PH AI',
    updatedAt: '2026-07-05T10:00:00Z',
  },
  providers: [
    {
      code: 'aliyun_bailian',
      name: '阿里云百炼',
      baseUrl: 'https://dashscope.aliyuncs.com',
      apiKeyMasked: 'sk-***bailian',
      enabled: true,
      updatedAt: '2026-07-01T10:00:00Z',
    },
    {
      code: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com',
      apiKeyMasked: 'sk-***openai',
      enabled: true,
      updatedAt: '2026-07-02T10:00:00Z',
    },
    {
      code: 'anthropic',
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKeyMasked: 'sk-***claude',
      enabled: false,
      updatedAt: '2026-06-28T10:00:00Z',
    },
  ],
  models: [
    {
      id: 'model-qwen-turbo',
      modelId: 'qwen-turbo',
      displayName: 'Qwen Turbo',
      providerCode: 'aliyun_bailian',
      providerName: '阿里云百炼',
      toolTypes: ['chat', 'text'],
      visibleToUser: true,
      enabled: true,
      isDefault: true,
      contextTokens: 8192,
      inputPricePer1k: 0.0003,
      outputPricePer1k: 0.0006,
    },
    {
      id: 'model-qwen-plus',
      modelId: 'qwen-plus',
      displayName: 'Qwen Plus',
      providerCode: 'aliyun_bailian',
      providerName: '阿里云百炼',
      toolTypes: ['chat', 'text'],
      visibleToUser: true,
      enabled: true,
      isDefault: false,
      contextTokens: 32768,
      inputPricePer1k: 0.0008,
      outputPricePer1k: 0.002,
    },
    {
      id: 'model-gpt-4o-mini',
      modelId: 'gpt-4o-mini',
      displayName: 'GPT-4o mini',
      providerCode: 'openai',
      providerName: 'OpenAI',
      toolTypes: ['chat', 'text'],
      visibleToUser: true,
      enabled: true,
      isDefault: false,
      contextTokens: 128000,
      inputPricePer1k: 0.0011,
      outputPricePer1k: 0.0044,
    },
    {
      id: 'model-dall-e-3',
      modelId: 'dall-e-3',
      displayName: 'DALL·E 3',
      providerCode: 'openai',
      providerName: 'OpenAI',
      toolTypes: ['image'],
      visibleToUser: true,
      enabled: true,
      isDefault: true,
      contextTokens: 4000,
      inputPricePer1k: 0,
      outputPricePer1k: 0.28,
    },
    {
      id: 'model-video-mock',
      modelId: 'video-mock-v1',
      displayName: 'Video Mock v1',
      providerCode: 'aliyun_bailian',
      providerName: '阿里云百炼',
      toolTypes: ['video'],
      visibleToUser: true,
      enabled: true,
      isDefault: true,
      contextTokens: 4000,
      inputPricePer1k: 0,
      outputPricePer1k: 1.8,
    },
  ],
  tools: [
    {
      code: 'chat',
      name: 'AI 对话',
      status: 'enabled',
      defaultModelId: 'qwen-turbo',
      tokenCostLabel: '按输入/输出 Token 计费',
      guestTrialEnabled: true,
      sort: 10,
    },
    {
      code: 'text',
      name: '文本生成',
      status: 'enabled',
      defaultModelId: 'qwen-turbo',
      tokenCostLabel: '按输出 Token 计费',
      guestTrialEnabled: true,
      sort: 20,
    },
    {
      code: 'image',
      name: '图片生成',
      status: 'enabled',
      defaultModelId: 'dall-e-3',
      tokenCostLabel: '500 Token / 次',
      guestTrialEnabled: false,
      sort: 30,
    },
    {
      code: 'video',
      name: '视频生成',
      status: 'enabled',
      defaultModelId: 'video-mock-v1',
      tokenCostLabel: '1500 Token / 条',
      guestTrialEnabled: false,
      sort: 40,
    },
    {
      code: 'webui',
      name: 'WebUI',
      status: 'comingSoon',
      tokenCostLabel: '待接入',
      guestTrialEnabled: false,
      sort: 50,
    },
    {
      code: 'comfyui',
      name: 'ComfyUI',
      status: 'comingSoon',
      tokenCostLabel: '待接入',
      guestTrialEnabled: false,
      sort: 60,
    },
    {
      code: 'lora',
      name: 'LoRA 训练',
      status: 'comingSoon',
      tokenCostLabel: '待接入',
      guestTrialEnabled: false,
      sort: 70,
    },
    {
      code: 'apps',
      name: 'AI 应用',
      status: 'comingSoon',
      tokenCostLabel: '待接入',
      guestTrialEnabled: true,
      sort: 80,
    },
  ],
};

export const adminAiStatsData: AdminAiStatsData = {
  summary: {
    totalTokens: 1286400,
    totalCalls: 4268,
    estimatedCost: 386.72,
    activeUsers: 126,
  },
  trends: [
    { date: '07-01', tokens: 132000, calls: 402, estimatedCost: 39.2 },
    { date: '07-02', tokens: 168400, calls: 536, estimatedCost: 48.9 },
    { date: '07-03', tokens: 142800, calls: 468, estimatedCost: 42.4 },
    { date: '07-04', tokens: 196200, calls: 621, estimatedCost: 58.6 },
    { date: '07-05', tokens: 224000, calls: 718, estimatedCost: 66.8 },
    { date: '07-06', tokens: 256600, calls: 802, estimatedCost: 77.2 },
    { date: '07-07', tokens: 166400, calls: 721, estimatedCost: 53.62 },
  ],
  toolShares: [
    { toolType: 'chat', toolName: 'AI 对话', tokens: 672000, calls: 2480, ratio: 52.2 },
    { toolType: 'text', toolName: '文本生成', tokens: 348000, calls: 1120, ratio: 27.1 },
    { toolType: 'image', toolName: '图片生成', tokens: 220000, calls: 520, ratio: 17.1 },
    { toolType: 'video', toolName: '视频生成', tokens: 46400, calls: 148, ratio: 3.6 },
  ],
  userRanks: [
    { rank: 1, userId: 'u-editor', nickname: '编辑者', tokens: 182400, calls: 428 },
    { rank: 2, userId: 'u-member', nickname: '普通会员', tokens: 136800, calls: 336 },
    { rank: 3, userId: 'u-admin', nickname: '管理员', tokens: 98400, calls: 204 },
    { rank: 4, userId: 'u-mock-04', nickname: '内容运营', tokens: 86200, calls: 188 },
    { rank: 5, userId: 'u-mock-05', nickname: '设计协作', tokens: 72100, calls: 166 },
  ],
  modelDistributions: [
    {
      modelId: 'qwen-turbo',
      modelName: 'Qwen Turbo',
      providerName: '阿里云百炼',
      tokens: 642000,
      calls: 2380,
      estimatedCost: 52.4,
    },
    {
      modelId: 'qwen-plus',
      modelName: 'Qwen Plus',
      providerName: '阿里云百炼',
      tokens: 294000,
      calls: 760,
      estimatedCost: 81.6,
    },
    {
      modelId: 'gpt-4o-mini',
      modelName: 'GPT-4o mini',
      providerName: 'OpenAI',
      tokens: 130400,
      calls: 608,
      estimatedCost: 72.72,
    },
    {
      modelId: 'dall-e-3',
      modelName: 'DALL·E 3',
      providerName: 'OpenAI',
      tokens: 220000,
      calls: 520,
      estimatedCost: 180,
    },
  ],
};

export const auditLogs: AuditLogItem[] = [
  {
    id: 'log-1',
    action: 'login',
    resource: 'auth',
    operator: 'admin@example.com',
    createdAt: '2026-06-28T08:00:00Z',
    detail: 'mock 登录成功',
  },
];

/** 追加审计日志（内存态） */
export function appendAuditLog(
  item: Omit<AuditLogItem, 'id' | 'createdAt'> & { createdAt?: string },
): AuditLogItem {
  const row: AuditLogItem = {
    id: `log-${Date.now()}`,
    createdAt: item.createdAt ?? new Date().toISOString(),
    ...item,
  };
  auditLogs.unshift(row);
  return row;
}

function maskAiProviderApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}***`;
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-4)}`;
}

/** 更新 AI 品牌配置，阶段 5 用内存态模拟系统配置保存。 */
export function updateAdminAiBrandingConfig(
  input: AdminAiBrandingMutationInput,
): AdminAiBrandingConfig {
  if (typeof input.brandName === 'string') {
    const brandName = input.brandName.trim();
    if (brandName) {
      adminAiConfigData.branding.brandName = brandName;
    }
  }
  if (typeof input.logoText === 'string') {
    const logoText = input.logoText.trim();
    if (logoText) {
      adminAiConfigData.branding.logoText = logoText;
    }
  }
  adminAiConfigData.branding.updatedAt = new Date().toISOString();
  return adminAiConfigData.branding;
}

/** 更新后台 AI 厂商配置，阶段 5 用内存态模拟 Key 只写和基础信息保存。 */
export function updateAdminAiProviderConfig(
  code: string,
  input: AdminAiProviderMutationInput,
): AdminAiProviderConfig | undefined {
  const provider = adminAiConfigData.providers.find((item) => item.code === code);
  if (!provider) return undefined;

  if (typeof input.name === 'string') {
    const nextName = input.name.trim();
    if (nextName) {
      provider.name = nextName;
      for (const model of adminAiConfigData.models) {
        if (model.providerCode === provider.code) {
          model.providerName = nextName;
        }
      }
    }
  }
  if (typeof input.baseUrl === 'string') {
    provider.baseUrl = input.baseUrl.trim() || provider.baseUrl;
  }
  if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    provider.apiKeyMasked = maskAiProviderApiKey(input.apiKey);
  }
  if (typeof input.enabled === 'boolean') {
    provider.enabled = input.enabled;
  }
  provider.updatedAt = new Date().toISOString();
  return provider;
}

/** 更新后台 AI 工具启停状态，阶段 5 使用内存态模拟配置保存。 */
export function updateAdminAiToolStatus(
  code: string,
  status: AdminAiToolConfig['status'],
): AdminAiToolConfig | undefined {
  return updateAdminAiToolConfig(code, { status });
}

/** 更新后台 AI 工具配置，阶段 5 用内存态验证用户端工具入口联动。 */
export function updateAdminAiToolConfig(
  code: string,
  input: AdminAiToolMutationInput,
): AdminAiToolConfig | undefined {
  const tool = adminAiConfigData.tools.find((item) => item.code === code);
  if (!tool) return undefined;
  if (input.status) {
    tool.status = input.status;
  }
  if ('defaultModelId' in input) {
    tool.defaultModelId = input.defaultModelId?.trim() || undefined;
  }
  if (typeof input.tokenCostLabel === 'string') {
    tool.tokenCostLabel = input.tokenCostLabel.trim() || tool.tokenCostLabel;
  }
  if (typeof input.guestTrialEnabled === 'boolean') {
    tool.guestTrialEnabled = input.guestTrialEnabled;
  }
  if (typeof input.sort === 'number') {
    tool.sort = Math.max(1, Math.round(input.sort));
  }
  return tool;
}

/**
 * 移动后台 AI 工具排序。
 *
 * 阶段 5 用相邻交换模拟拖拽排序，避免在 mock 阶段引入复杂 DnD；
 * 用户端工具接口会按 `sort` 返回，从而验证后台配置能影响首页展示顺序。
 */
export function moveAdminAiToolSort(
  code: string,
  direction: 'up' | 'down',
): AdminAiToolConfig[] {
  const sortedTools = [...adminAiConfigData.tools].sort((a, b) => a.sort - b.sort);
  const currentIndex = sortedTools.findIndex((item) => item.code === code);
  if (currentIndex < 0) return sortedTools;

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= sortedTools.length) return sortedTools;

  const currentTool = sortedTools[currentIndex];
  const nextTool = sortedTools[nextIndex];
  const currentSort = currentTool.sort;
  currentTool.sort = nextTool.sort;
  nextTool.sort = currentSort;

  return [...adminAiConfigData.tools].sort((a, b) => a.sort - b.sort);
}

function normalizeAdminAiModelId(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function getFallbackDefaultModel(toolType: string): AdminAiModelConfig | undefined {
  return adminAiConfigData.models.find(
    (model) =>
      model.enabled &&
      model.visibleToUser &&
      model.toolTypes.includes(toolType as AdminAiModelConfig['toolTypes'][number]),
  );
}

function reconcileAdminAiModelDefaults(
  model: AdminAiModelConfig,
  isDefault: boolean,
) {
  model.isDefault = isDefault;
  if (!isDefault) return;
  for (const sibling of adminAiConfigData.models) {
    if (sibling.id === model.id) continue;
    if (sibling.toolTypes.some((toolType) => model.toolTypes.includes(toolType))) {
      sibling.isDefault = false;
    }
  }
}

/** 新增后台 AI 模型，阶段 5 使用内存态模拟模型接入。 */
export function createAdminAiModelConfig(
  input: AdminAiModelCreateInput,
): AdminAiModelConfig | undefined {
  const modelId = normalizeAdminAiModelId(input.modelId);
  if (!modelId || adminAiConfigData.models.some((item) => item.modelId === modelId)) {
    return undefined;
  }
  const provider = adminAiConfigData.providers.find(
    (item) => item.code === input.providerCode,
  );
  if (!provider || input.toolTypes.length === 0) return undefined;

  const model: AdminAiModelConfig = {
    id: `model-${modelId}`,
    modelId,
    displayName: input.displayName.trim() || modelId,
    providerCode: provider.code,
    providerName: provider.name,
    toolTypes: [...new Set(input.toolTypes)],
    visibleToUser: input.visibleToUser,
    enabled: input.enabled,
    isDefault: false,
    contextTokens: Math.max(1, Math.round(input.contextTokens)),
    inputPricePer1k: Math.max(0, input.inputPricePer1k),
    outputPricePer1k: Math.max(0, input.outputPricePer1k),
  };
  adminAiConfigData.models.push(model);
  reconcileAdminAiModelDefaults(model, input.isDefault);
  return model;
}

/**
 * 更新后台 AI 模型基础配置。
 *
 * 当模型被设为默认时，会取消同一工具类型下其他模型的默认标记，
 * 避免用户端按工具过滤时出现多个默认模型。
 */
export function updateAdminAiModelConfig(
  id: string,
  input: AdminAiModelMutationInput,
): AdminAiModelConfig | undefined {
  const model = adminAiConfigData.models.find((item) => item.id === id);
  if (!model) return undefined;

  if (typeof input.displayName === 'string') {
    model.displayName = input.displayName.trim() || model.displayName;
  }
  if (typeof input.visibleToUser === 'boolean') {
    model.visibleToUser = input.visibleToUser;
  }
  if (typeof input.enabled === 'boolean') {
    model.enabled = input.enabled;
  }
  if (typeof input.contextTokens === 'number') {
    model.contextTokens = Math.max(1, Math.round(input.contextTokens));
  }
  if (typeof input.inputPricePer1k === 'number') {
    model.inputPricePer1k = Math.max(0, input.inputPricePer1k);
  }
  if (typeof input.outputPricePer1k === 'number') {
    model.outputPricePer1k = Math.max(0, input.outputPricePer1k);
  }
  if (typeof input.isDefault === 'boolean') {
    reconcileAdminAiModelDefaults(model, input.isDefault);
  }

  return model;
}

/** 删除后台 AI 模型，并清理工具默认模型引用。 */
export function deleteAdminAiModelConfig(id: string): AdminAiModelConfig | undefined {
  const index = adminAiConfigData.models.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  const [deleted] = adminAiConfigData.models.splice(index, 1);

  for (const tool of adminAiConfigData.tools) {
    if (tool.defaultModelId !== deleted.modelId) continue;
    const fallback = getFallbackDefaultModel(tool.code);
    tool.defaultModelId = fallback?.modelId;
  }

  for (const toolType of deleted.toolTypes) {
    const hasDefault = adminAiConfigData.models.some(
      (model) => model.isDefault && model.toolTypes.includes(toolType),
    );
    if (hasDefault) continue;
    const fallback = getFallbackDefaultModel(toolType);
    if (fallback) {
      fallback.isDefault = true;
    }
  }

  return deleted;
}

/** 计算分类引用数量，避免分类删除后内容失去归属。 */
export function enrichCategories(): CategoryRecord[] {
  return categories
    .map((category) => ({
      ...category,
      contentCount: contents.filter((content) => content.categorySlug === category.slug).length,
      childCount: categories.filter((item) => item.parentId === category.id).length,
    }))
    .sort((a, b) => a.sort - b.sort);
}

/** 新增分类，父级存在性由 mock 层校验。 */
export function createCategory(input: CategoryMutationInput): CategoryRecord {
  const row: CategoryRecord = {
    id: `cat-${Date.now()}`,
    name: input.name,
    slug: input.slug,
    parentId: input.parentId,
    sort: input.sort ?? 0,
  };
  categories.push(row);
  return row;
}

/** 更新分类基础信息。 */
export function updateCategory(id: string, input: CategoryMutationInput): CategoryRecord | undefined {
  const row = categories.find((item) => item.id === id);
  if (!row) return undefined;
  Object.assign(row, {
    name: input.name,
    slug: input.slug,
    parentId: input.parentId,
    sort: input.sort ?? row.sort,
  });
  return row;
}

/** 更新内容状态，并写回共享内容列表。 */
export function updateContentStatus(id: string, status: ContentStatus) {
  const item = contents.find((content) => content.id === id);
  if (!item) return undefined;
  item.status = status;
  item.updatedAt = new Date().toISOString();
  if (status === ContentStatus.Published && !item.publishedAt) {
    item.publishedAt = item.updatedAt;
  }
  return item;
}

/** 删除内容时同步清理文件引用，避免后续文件误判仍被占用。 */
export function deleteContentById(id: string): boolean {
  const idx = contents.findIndex((content) => content.id === id);
  if (idx < 0) return false;
  contents.splice(idx, 1);
  for (const file of adminFiles) {
    file.referencedBy = file.referencedBy?.filter((contentId) => contentId !== id);
  }
  return true;
}

/** 删除文件：被内容引用的文件不允许删除。 */
export function deleteFileById(id: string): { ok: true } | { ok: false; message: string } {
  const file = adminFiles.find((item) => item.id === id);
  if (!file) return { ok: false, message: '文件不存在' };
  if (file.referencedBy?.length) {
    return { ok: false, message: `文件被 ${file.referencedBy.length} 个内容引用，不能删除` };
  }
  adminFiles = adminFiles.filter((item) => item.id !== id);
  return { ok: true };
}

export function getDashboardStats(): AdminDashboardStats {
  return {
    contentTotal: 128,
    userTotal: adminUsers.length,
    visitToday: 342,
    publishedThisWeek: 6,
  };
}
