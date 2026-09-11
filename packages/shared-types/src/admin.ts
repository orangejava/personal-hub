/**
 * 后台运营相关类型（阶段 4 mock / 后续 NestJS 对齐）
 */
import type { MenuItem } from './permission';
import type { AiToolStatus, AiToolType } from './ai';
import type { UserRole } from './user';

/** 后台用户列表项 */
export interface AdminUserRecord {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  status: 'active' | 'disabled';
  createdAt: string;
}

/** 后台权限目录项，与 Nest `PERMISSION_CATALOG` 对齐。 */
export interface AdminPermissionItem {
  code: string;
  group: string;
  label: string;
  description: string;
}

/** 后台角色。code 是 Nest `RoleCode`，permissions 是目录里的权限码。 */
export interface AdminRoleRecord {
  code: string;
  name: string;
  description?: string;
  isProtected?: boolean;
  /** 角色权限的乐观锁版本；保存时必须回传读取到的值。 */
  version: number;
  permissions: string[];
}

/** 操作审计日志 */
export interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  operator: string;
  createdAt: string;
  detail?: string;
}

/** 内容分类（树形） */
export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  sort: number;
  /** 关联内容数量，用于删除前校验和后台运营判断。 */
  contentCount?: number;
  /** 子分类数量，用于删除前校验。 */
  childCount?: number;
}

/** 内容标签 */
export interface TagRecord {
  id: string;
  name: string;
  slug: string;
  usageCount: number;
}

/** 后台文件记录 */
export interface AdminFileRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
  /** 文件用途：封面、正文附件、文档预览或 AI 资产等。 */
  usage?: 'cover' | 'attachment' | 'preview' | 'asset';
  /** Nest `FilePurpose` 枚举；后台列表优先展示这个，而不是旧 mock 的 usage。 */
  purpose?: string;
  /** 存储位置，后续接 MinIO 时用于迁移。 */
  storage?: 'local' | 'minio';
  /** 引用该文件的内容 ID，用于删除前阻止误删。 */
  referencedBy?: string[];
}

/** 运营概览统计 */
export interface AdminDashboardStats {
  contentTotal: number;
  userTotal: number;
  visitToday: number;
  publishedThisWeek: number;
}

/** 首页配置模块通用状态 */
export interface HomepageModuleConfig {
  key: string;
  title: string;
  visible: boolean;
  sort: number;
}

/** 首页 Hero 配置 */
export interface HomepageHeroConfig {
  title: string;
  subtitle: string;
  primaryText: string;
  primaryLink: string;
  secondaryText: string;
  secondaryLink: string;
}

/** 首页精选内容配置 */
export interface HomepageFeaturedContentConfig {
  contentIds: string[];
}

/** 首页 AI 工具推荐配置 */
export interface HomepageAiToolConfig {
  key: string;
  title: string;
  description: string;
  enabled: boolean;
}

/** 首页技术栈配置 */
export interface HomepageTechStackConfig {
  name: string;
  icon?: string;
  category: string;
}

/** 后台首页配置的完整 mock 契约 */
export interface HomepageConfig {
  hero: HomepageHeroConfig;
  modules: HomepageModuleConfig[];
  featuredContent: HomepageFeaturedContentConfig;
  aiTools: HomepageAiToolConfig[];
  techStack: HomepageTechStackConfig[];
}

/** 菜单配置分组，后台可视化编辑时按区域保存。 */
export interface AdminMenuConfig {
  public: MenuItem[];
  workspace: MenuItem[];
  admin: MenuItem[];
  /** 阶段 5 AI 工作台侧边栏预留，本阶段只作为配置占位。 */
  ai: MenuItem[];
}

/** 分类编辑入参 */
export interface CategoryMutationInput {
  name: string;
  slug: string;
  parentId?: string;
  sort?: number;
}

/** 文件列表筛选参数 */
export interface AdminFileQuery {
  mimeGroup?: 'image' | 'pdf' | 'word' | 'other';
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminFilePage {
  list: AdminFileRecord[];
  total: number;
  page: number;
  pageSize: number;
}

/** 后台 AI 厂商配置。API Key 只返回脱敏值，明文只允许后端保存。 */
export interface AdminAiProviderConfig {
  id: string;
  code: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  enabled: boolean;
  updatedAt: string;
}

/** 后台 AI 厂商配置更新输入。API Key 为只写字段，接口只回传脱敏值。 */
export interface AdminAiProviderMutationInput {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  enabled?: boolean;
}

/** 后台 AI 模型配置，控制用户端可见模型、默认模型和计费参数。 */
export interface AdminAiModelConfig {
  id: string;
  modelId: string;
  displayName: string;
  providerCode: string;
  providerName: string;
  toolTypes: AiToolType[];
  visibleToUser: boolean;
  enabled: boolean;
  isDefault: boolean;
  contextTokens: number;
  inputPricePer1k: number;
  outputPricePer1k: number;
}

/** 后台 AI 模型新增输入，阶段 5 用于 mock 新模型接入。 */
export interface AdminAiModelCreateInput {
  modelId: string;
  displayName: string;
  providerCode: string;
  toolTypes: AiToolType[];
  visibleToUser: boolean;
  enabled: boolean;
  isDefault: boolean;
  contextTokens: number;
  inputPricePer1k: number;
  outputPricePer1k: number;
}

/** 后台 AI 模型配置更新输入。 */
export interface AdminAiModelMutationInput {
  displayName?: string;
  visibleToUser?: boolean;
  enabled?: boolean;
  isDefault?: boolean;
  contextTokens?: number;
  inputPricePer1k?: number;
  outputPricePer1k?: number;
}

/** 后台 AI 工具配置，阶段 5 先用于 mock 启停和默认模型展示。 */
export interface AdminAiToolConfig {
  id: string;
  code: AiToolType;
  name: string;
  status: AiToolStatus;
  defaultModelId?: string;
  tokenCostLabel: string;
  guestTrialEnabled: boolean;
  /** 后台配置的展示顺序，数值越小越靠前。 */
  sort: number;
}

/** 后台 AI 工具状态更新输入，阶段 5 只开放启停状态 mock 保存。 */
export interface AdminAiToolStatusMutationInput {
  status: AiToolStatus;
}

/** 后台 AI 工具配置更新输入。 */
export interface AdminAiToolMutationInput {
  status?: AiToolStatus;
  defaultModelId?: string;
  tokenCostLabel?: string;
  guestTrialEnabled?: boolean;
  sort?: number;
}

/** 后台 AI 品牌配置，阶段 5 用于驱动 AI Layout 和首页品牌展示。 */
export interface AdminAiBrandingConfig {
  brandName: string;
  logoText: string;
  updatedAt: string;
}

/** 后台 AI 品牌配置更新输入。 */
export interface AdminAiBrandingMutationInput {
  brandName?: string;
  logoText?: string;
}

/** 后台 AI 配置页聚合数据。 */
export interface AdminAiConfigData {
  branding: AdminAiBrandingConfig;
  providers: AdminAiProviderConfig[];
  models: AdminAiModelConfig[];
  tools: AdminAiToolConfig[];
}

/** 后台 AI 统计汇总。 */
export interface AdminAiStatsSummary {
  totalTokens: number;
  totalCalls: number;
  estimatedCost: number;
  activeUsers: number;
}

/** AI 近 N 天消耗趋势点。 */
export interface AdminAiUsageTrendPoint {
  date: string;
  tokens: number;
  calls: number;
  estimatedCost: number;
}

/** AI 工具消耗占比。 */
export interface AdminAiToolUsageShare {
  toolType: AiToolType;
  toolName: string;
  tokens: number;
  calls: number;
  ratio: number;
}

/** AI 用户消耗排行。 */
export interface AdminAiUserUsageRank {
  rank: number;
  userId: string;
  nickname: string;
  tokens: number;
  calls: number;
}

/** AI 模型消耗分布。 */
export interface AdminAiModelUsageDistribution {
  modelId: string;
  modelName: string;
  providerName: string;
  tokens: number;
  calls: number;
  estimatedCost: number;
}

/** 后台 AI 统计页聚合数据。 */
export interface AdminAiStatsData {
  summary: AdminAiStatsSummary;
  trends: AdminAiUsageTrendPoint[];
  toolShares: AdminAiToolUsageShare[];
  userRanks: AdminAiUserUsageRank[];
  modelDistributions: AdminAiModelUsageDistribution[];
}
