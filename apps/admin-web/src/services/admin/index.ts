/**
 * 后台运营 service（阶段 4 mock 契约）
 */
import { request } from '@umijs/max';
import type {
  AdminAiConfigData,
  AdminAiBrandingConfig,
  AdminAiBrandingMutationInput,
  AdminAiModelCreateInput,
  AdminAiModelConfig,
  AdminAiModelMutationInput,
  AdminAiProviderConfig,
  AdminAiProviderMutationInput,
  AdminAiStatsData,
  AdminAiToolConfig,
  AdminAiToolMutationInput,
  AdminAiToolStatusMutationInput,
  AdminDashboardStats,
  AdminFileRecord,
  AdminFileQuery,
  AdminMenuConfig,
  AdminRoleRecord,
  AdminUserRecord,
  AuditLogItem,
  CategoryMutationInput,
  CategoryRecord,
  ContentItem,
  HomepageConfig,
  PaginationResult,
  SystemPublicConfig,
  TagRecord,
  ThemeConfig,
  UserRole,
} from '@personal-hub/shared-types';
import {
  mapPublicSiteConfig,
  readNestData,
  type NestEnvelope,
  type NestPublicSiteConfig,
} from '@personal-hub/api-client';
import { NEST_ROUTE_REGISTRY } from '@/auth/routeRegistry';

interface AdminConfigGroup {
  group: string;
  version: number;
  value: Record<string, unknown>;
}

interface AdminMenuNode {
  id: string;
  scope: 'PUBLIC' | 'WORKSPACE' | 'ADMIN' | 'AI';
  type: string;
  name: string;
  localeKey?: string | null;
  icon?: string | null;
  routeKey: string | null;
  externalUrl: string | null;
  permissionCodes: string[];
  children: AdminMenuNode[];
}

interface SiteHomepageValue {
  hero: {
    title: string;
    subtitle: string;
    primaryAction: { label: string; target: string };
    secondaryAction: { label: string; target: string };
  };
  modules: HomepageConfig['modules'];
  featuredContent: HomepageConfig['featuredContent'];
  aiTools: HomepageConfig['aiTools'];
  techStack: HomepageConfig['techStack'];
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

async function loadAdminConfigGroups(group?: string): Promise<AdminConfigGroup[]> {
  const url =
    group === undefined
      ? '/api/v1/admin/system-configs'
      : `/api/v1/admin/system-configs?group=${encodeURIComponent(group)}`;
  const res = await request<NestEnvelope<AdminConfigGroup[]> | AdminConfigGroup[]>(url, {
    skipErrorHandler: true,
  });
  return readNestData(res);
}

async function putAdminConfigGroup(group: string, version: number, value: unknown) {
  const res = await request<NestEnvelope<AdminConfigGroup> | AdminConfigGroup>(
    `/api/v1/admin/system-configs/${group}`,
    {
      method: 'PUT',
      data: { version, value },
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      skipErrorHandler: true,
    },
  );
  return readNestData(res);
}

function groupsToPublicConfig(groups: AdminConfigGroup[]): NestPublicSiteConfig {
  const pick = (name: string) => groups.find((item) => item.group === name)?.value ?? {};
  const general = pick('site.general') as unknown as NestPublicSiteConfig;
  const theme = pick('site.theme') as unknown as NestPublicSiteConfig['theme'];
  const homepage = pick('site.homepage') as unknown as NestPublicSiteConfig['homepage'];
  const navigation = pick('site.navigation') as unknown as NestPublicSiteConfig['navigation'];
  const branding = pick('ai.branding') as { aiEnabled?: boolean };
  return {
    siteName: String(general.siteName ?? 'Personal Hub'),
    siteDescription: general.siteDescription as string | undefined,
    theme,
    homepage,
    navigation,
    aiEnabled: branding.aiEnabled,
  };
}

function toHomepageConfig(value: SiteHomepageValue): HomepageConfig {
  return {
    hero: {
      title: value.hero.title,
      subtitle: value.hero.subtitle,
      primaryText: value.hero.primaryAction.label,
      primaryLink: value.hero.primaryAction.target,
      secondaryText: value.hero.secondaryAction.label,
      secondaryLink: value.hero.secondaryAction.target,
    },
    modules: value.modules,
    featuredContent: value.featuredContent,
    aiTools: value.aiTools,
    techStack: value.techStack,
  };
}

function fromHomepageConfig(
  current: SiteHomepageValue,
  next: HomepageConfig,
): SiteHomepageValue {
  return {
    ...current,
    hero: {
      title: next.hero.title,
      subtitle: next.hero.subtitle,
      primaryAction: { label: next.hero.primaryText, target: next.hero.primaryLink },
      secondaryAction: { label: next.hero.secondaryText, target: next.hero.secondaryLink },
    },
    modules: next.modules,
    featuredContent: next.featuredContent,
    aiTools: next.aiTools,
    techStack: next.techStack,
  };
}

function mapAdminMenuNode(node: AdminMenuNode): import('@personal-hub/shared-types').MenuItem {
  const registry = node.routeKey ? NEST_ROUTE_REGISTRY[node.routeKey] : undefined;
  return {
    id: node.id,
    path: registry?.path ?? node.externalUrl ?? `/${node.id}`,
    name: node.name,
    localeKey: node.localeKey ?? undefined,
    icon: node.icon ?? registry?.icon,
    permissions: node.permissionCodes as import('@personal-hub/shared-types').MenuItem['permissions'],
    children: node.children?.map(mapAdminMenuNode),
  };
}

function nestMenusToConfig(trees: AdminMenuNode[]): AdminMenuConfig {
  const config: AdminMenuConfig = { public: [], workspace: [], admin: [], ai: [] };
  for (const node of trees) {
    const key = node.scope.toLowerCase() as keyof AdminMenuConfig;
    config[key].push(mapAdminMenuNode(node));
  }
  return config;
}

export async function fetchAdminDashboardStats() {
  return request<AdminDashboardStats>('/api/admin/dashboard/stats');
}

export async function fetchAdminAiConfig() {
  return request<AdminAiConfigData>('/api/admin/ai/config');
}

export async function fetchAdminAiStats() {
  return request<AdminAiStatsData>('/api/admin/ai/stats');
}

/** 更新 AI 品牌配置，阶段 5 用于验证 AI Layout 品牌名可配置。 */
export async function updateAdminAiBrandingConfig(
  data: AdminAiBrandingMutationInput,
) {
  return request<AdminAiBrandingConfig>('/api/admin/ai/branding', {
    method: 'PUT',
    data,
  });
}

/** 更新 AI 厂商基础配置。API Key 只写，响应只返回脱敏值。 */
export async function updateAdminAiProviderConfig(
  code: AdminAiProviderConfig['code'],
  data: AdminAiProviderMutationInput,
) {
  return request<AdminAiProviderConfig>(
    `/api/admin/ai/providers/${code}`,
    {
      method: 'PUT',
      data,
    },
  );
}

/** 更新 AI 模型基础配置，阶段 5 用于验证用户端模型下拉联动。 */
export async function updateAdminAiModelConfig(
  id: string,
  data: AdminAiModelMutationInput,
) {
  return request<AdminAiModelConfig>(`/api/admin/ai/models/${id}`, {
    method: 'PUT',
    data,
  });
}

/** 新增 AI 模型配置，阶段 5 用于 mock 验证用户端模型列表派生。 */
export async function createAdminAiModelConfig(data: AdminAiModelCreateInput) {
  return request<AdminAiModelConfig>('/api/admin/ai/models', {
    method: 'POST',
    data,
  });
}

/** 删除 AI 模型配置，并由 mock 层清理工具默认模型引用。 */
export async function deleteAdminAiModelConfig(id: AdminAiModelConfig['id']) {
  return request<AdminAiModelConfig>(`/api/admin/ai/models/${id}`, {
    method: 'DELETE',
  });
}

/** 更新 AI 工具启停状态，阶段 5 先用于 mock 配置闭环。 */
export async function updateAdminAiToolStatus(
  code: AdminAiToolConfig['code'],
  data: AdminAiToolStatusMutationInput,
) {
  return request<AdminAiToolConfig>(
    `/api/admin/ai/tools/${code}/status`,
    {
      method: 'PUT',
      data,
    },
  );
}

/** 更新 AI 工具完整配置，阶段 5 用于验证首页和侧边栏工具信息联动。 */
export async function updateAdminAiToolConfig(
  code: AdminAiToolConfig['code'],
  data: AdminAiToolMutationInput,
) {
  return request<AdminAiToolConfig>(`/api/admin/ai/tools/${code}`, {
    method: 'PUT',
    data,
  });
}

/** 移动 AI 工具展示顺序，阶段 5 用于验证后台配置影响用户端首页排序。 */
export async function moveAdminAiToolSort(
  code: AdminAiToolConfig['code'],
  direction: 'up' | 'down',
) {
  return request<AdminAiToolConfig[]>(
    `/api/admin/ai/tools/${code}/move`,
    {
      method: 'POST',
      data: { direction },
    },
  );
}

export async function fetchAdminUsers(params: {
  current?: number;
  pageSize?: number;
  email?: string;
}) {
  return request<PaginationResult<AdminUserRecord>>('/api/admin/users', {
    params: { page: params.current, pageSize: params.pageSize, email: params.email },
  });
}

export async function updateAdminUserStatus(id: string, status: 'active' | 'disabled') {
  return request<AdminUserRecord>(`/api/admin/users/${id}/status`, {
    method: 'PUT',
    data: { status },
  });
}

export async function updateAdminUserRole(id: string, role: UserRole) {
  return request<AdminUserRecord>(`/api/admin/users/${id}/role`, {
    method: 'PUT',
    data: { role },
  });
}

export async function fetchAdminRoles() {
  return request<AdminRoleRecord[]>('/api/admin/roles');
}

export async function updateAdminRolePermissions(code: UserRole, permissions: string[]) {
  return request<AdminRoleRecord>(`/api/admin/roles/${code}/permissions`, {
    method: 'PUT',
    data: { permissions },
  });
}

export async function fetchAdminContents(params: {
  current?: number;
  pageSize?: number;
  title?: string;
  type?: string;
}) {
  return request<PaginationResult<ContentItem>>('/api/admin/contents', {
    params: {
      page: params.current,
      pageSize: params.pageSize,
      title: params.title,
      type: params.type,
    },
  });
}

export async function deleteAdminContent(id: string) {
  return request<null>(`/api/admin/contents/${id}`, { method: 'DELETE' });
}

export async function updateAdminContentStatus(id: string, status: string) {
  return request<ContentItem>(
    `/api/admin/contents/${id}/status`,
    { method: 'PUT', data: { status } },
  );
}

export async function fetchAdminCategories() {
  return request<CategoryRecord[]>('/api/admin/categories');
}

export async function createAdminCategory(data: CategoryMutationInput) {
  return request<CategoryRecord>('/api/admin/categories', {
    method: 'POST',
    data,
  });
}

export async function updateAdminCategory(id: string, data: CategoryMutationInput) {
  return request<CategoryRecord>(`/api/admin/categories/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function deleteAdminCategory(id: string) {
  return request<null>(`/api/admin/categories/${id}`, { method: 'DELETE' });
}

export async function fetchAdminTags() {
  return request<TagRecord[]>('/api/admin/tags');
}

export async function createAdminTag(data: { name: string; slug: string }) {
  return request<TagRecord>('/api/admin/tags', { method: 'POST', data });
}

export async function deleteAdminTag(id: string) {
  return request<null>(`/api/admin/tags/${id}`, { method: 'DELETE' });
}

export async function fetchAdminFiles(params?: AdminFileQuery) {
  return request<AdminFileRecord[]>('/api/admin/files', { params });
}

export async function deleteAdminFile(id: string) {
  return request<null>(`/api/admin/files/${id}`, { method: 'DELETE' });
}

export async function batchDeleteAdminFiles(ids: string[]) {
  return request<{ deleted: string[]; failed: { id: string; message: string }[] }>(
    '/api/admin/files/batch-delete',
    { method: 'POST', data: { ids } },
  );
}

export async function fetchAdminLogs(params: {
  current?: number;
  pageSize?: number;
  action?: string;
  resource?: string;
}) {
  return request<PaginationResult<AuditLogItem>>('/api/admin/logs', {
    params: {
      page: params.current,
      pageSize: params.pageSize,
      action: params.action,
      resource: params.resource,
    },
  });
}

export async function fetchAdminHomepageConfig() {
  const groups = await loadAdminConfigGroups('site.homepage');
  const row = groups[0];
  return toHomepageConfig(row.value as unknown as SiteHomepageValue);
}

export async function updateAdminHomepageConfig(data: HomepageConfig) {
  const groups = await loadAdminConfigGroups('site.homepage');
  const row = groups[0];
  const next = fromHomepageConfig(row.value as unknown as SiteHomepageValue, data);
  await putAdminConfigGroup('site.homepage', row.version, next);
  return data;
}

export async function fetchAdminMenuConfig() {
  const res = await request<NestEnvelope<AdminMenuNode[]> | AdminMenuNode[]>(
    '/api/v1/admin/menus',
    { skipErrorHandler: true },
  );
  return nestMenusToConfig(readNestData(res));
}

export async function updateAdminMenuItem(input: {
  id: string;
  name?: string;
  icon?: string;
  permissionCodes?: string[];
}) {
  await request(`/api/v1/admin/menus/${input.id}`, {
    method: 'PATCH',
    data: {
      name: input.name,
      icon: input.icon,
      permissionCodes: input.permissionCodes,
    },
    headers: { 'Idempotency-Key': newIdempotencyKey() },
    skipErrorHandler: true,
  });
}

export async function updateAdminMenuConfig(data: AdminMenuConfig) {
  return data;
}

export async function fetchAdminSystemConfig() {
  const groups = await loadAdminConfigGroups();
  return mapPublicSiteConfig(groupsToPublicConfig(groups));
}

export async function updateAdminSystemConfig(data: Partial<SystemPublicConfig>) {
  const groups = await loadAdminConfigGroups();
  const general = groups.find((item) => item.group === 'site.general');
  const homepage = groups.find((item) => item.group === 'site.homepage');
  if (general) {
    await putAdminConfigGroup('site.general', general.version, {
      ...general.value,
      siteName: data.siteName ?? general.value.siteName,
      siteDescription: data.siteDescription ?? general.value.siteDescription,
    });
  }
  if (homepage && (data.heroTitle !== undefined || data.heroSubtitle !== undefined)) {
    const current = homepage.value as unknown as SiteHomepageValue;
    await putAdminConfigGroup('site.homepage', homepage.version, {
      ...current,
      hero: {
        ...current.hero,
        title: data.heroTitle ?? current.hero.title,
        subtitle: data.heroSubtitle ?? current.hero.subtitle,
      },
    });
  }
  return fetchAdminSystemConfig();
}

export async function updateAdminSystemTheme(data: Partial<ThemeConfig>) {
  const groups = await loadAdminConfigGroups('site.theme');
  const row = groups[0];
  const mode = data.mode === 'auto' || data.mode === 'light' || data.mode === 'dark' ? data.mode : row.value.mode;
  await putAdminConfigGroup('site.theme', row.version, {
    ...row.value,
    colorPrimary: data.colorPrimary ?? row.value.colorPrimary,
    borderRadius: data.borderRadius ?? row.value.borderRadius,
    mode,
  });
  return data;
}
