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
  ApiResponse,
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

export async function fetchAdminDashboardStats() {
  return request<ApiResponse<AdminDashboardStats>>('/api/admin/dashboard/stats');
}

export async function fetchAdminAiConfig() {
  return request<ApiResponse<AdminAiConfigData>>('/api/admin/ai/config');
}

export async function fetchAdminAiStats() {
  return request<ApiResponse<AdminAiStatsData>>('/api/admin/ai/stats');
}

/** 更新 AI 品牌配置，阶段 5 用于验证 AI Layout 品牌名可配置。 */
export async function updateAdminAiBrandingConfig(
  data: AdminAiBrandingMutationInput,
) {
  return request<ApiResponse<AdminAiBrandingConfig>>('/api/admin/ai/branding', {
    method: 'PUT',
    data,
  });
}

/** 更新 AI 厂商基础配置。API Key 只写，响应只返回脱敏值。 */
export async function updateAdminAiProviderConfig(
  code: AdminAiProviderConfig['code'],
  data: AdminAiProviderMutationInput,
) {
  return request<ApiResponse<AdminAiProviderConfig>>(
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
  return request<ApiResponse<AdminAiModelConfig>>(`/api/admin/ai/models/${id}`, {
    method: 'PUT',
    data,
  });
}

/** 新增 AI 模型配置，阶段 5 用于 mock 验证用户端模型列表派生。 */
export async function createAdminAiModelConfig(data: AdminAiModelCreateInput) {
  return request<ApiResponse<AdminAiModelConfig>>('/api/admin/ai/models', {
    method: 'POST',
    data,
  });
}

/** 删除 AI 模型配置，并由 mock 层清理工具默认模型引用。 */
export async function deleteAdminAiModelConfig(id: AdminAiModelConfig['id']) {
  return request<ApiResponse<AdminAiModelConfig>>(`/api/admin/ai/models/${id}`, {
    method: 'DELETE',
  });
}

/** 更新 AI 工具启停状态，阶段 5 先用于 mock 配置闭环。 */
export async function updateAdminAiToolStatus(
  code: AdminAiToolConfig['code'],
  data: AdminAiToolStatusMutationInput,
) {
  return request<ApiResponse<AdminAiToolConfig>>(
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
  return request<ApiResponse<AdminAiToolConfig>>(`/api/admin/ai/tools/${code}`, {
    method: 'PUT',
    data,
  });
}

/** 移动 AI 工具展示顺序，阶段 5 用于验证后台配置影响用户端首页排序。 */
export async function moveAdminAiToolSort(
  code: AdminAiToolConfig['code'],
  direction: 'up' | 'down',
) {
  return request<ApiResponse<AdminAiToolConfig[]>>(
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
  return request<ApiResponse<PaginationResult<AdminUserRecord>>>('/api/admin/users', {
    params: { page: params.current, pageSize: params.pageSize, email: params.email },
  });
}

export async function updateAdminUserStatus(id: string, status: 'active' | 'disabled') {
  return request<ApiResponse<AdminUserRecord>>(`/api/admin/users/${id}/status`, {
    method: 'PUT',
    data: { status },
  });
}

export async function updateAdminUserRole(id: string, role: UserRole) {
  return request<ApiResponse<AdminUserRecord>>(`/api/admin/users/${id}/role`, {
    method: 'PUT',
    data: { role },
  });
}

export async function fetchAdminRoles() {
  return request<ApiResponse<AdminRoleRecord[]>>('/api/admin/roles');
}

export async function updateAdminRolePermissions(code: UserRole, permissions: string[]) {
  return request<ApiResponse<AdminRoleRecord>>(`/api/admin/roles/${code}/permissions`, {
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
  return request<ApiResponse<PaginationResult<ContentItem>>>('/api/admin/contents', {
    params: {
      page: params.current,
      pageSize: params.pageSize,
      title: params.title,
      type: params.type,
    },
  });
}

export async function deleteAdminContent(id: string) {
  return request<ApiResponse<null>>(`/api/admin/contents/${id}`, { method: 'DELETE' });
}

export async function updateAdminContentStatus(id: string, status: string) {
  return request<ApiResponse<ContentItem>>(
    `/api/admin/contents/${id}/status`,
    { method: 'PUT', data: { status } },
  );
}

export async function fetchAdminCategories() {
  return request<ApiResponse<CategoryRecord[]>>('/api/admin/categories');
}

export async function createAdminCategory(data: CategoryMutationInput) {
  return request<ApiResponse<CategoryRecord>>('/api/admin/categories', {
    method: 'POST',
    data,
  });
}

export async function updateAdminCategory(id: string, data: CategoryMutationInput) {
  return request<ApiResponse<CategoryRecord>>(`/api/admin/categories/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function deleteAdminCategory(id: string) {
  return request<ApiResponse<null>>(`/api/admin/categories/${id}`, { method: 'DELETE' });
}

export async function fetchAdminTags() {
  return request<ApiResponse<TagRecord[]>>('/api/admin/tags');
}

export async function createAdminTag(data: { name: string; slug: string }) {
  return request<ApiResponse<TagRecord>>('/api/admin/tags', { method: 'POST', data });
}

export async function deleteAdminTag(id: string) {
  return request<ApiResponse<null>>(`/api/admin/tags/${id}`, { method: 'DELETE' });
}

export async function fetchAdminFiles(params?: AdminFileQuery) {
  return request<ApiResponse<AdminFileRecord[]>>('/api/admin/files', { params });
}

export async function deleteAdminFile(id: string) {
  return request<ApiResponse<null>>(`/api/admin/files/${id}`, { method: 'DELETE' });
}

export async function batchDeleteAdminFiles(ids: string[]) {
  return request<ApiResponse<{ deleted: string[]; failed: { id: string; message: string }[] }>>(
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
  return request<ApiResponse<PaginationResult<AuditLogItem>>>('/api/admin/logs', {
    params: {
      page: params.current,
      pageSize: params.pageSize,
      action: params.action,
      resource: params.resource,
    },
  });
}

export async function fetchAdminHomepageConfig() {
  return request<ApiResponse<HomepageConfig>>('/api/admin/homepage');
}

export async function updateAdminHomepageConfig(data: HomepageConfig) {
  return request<ApiResponse<HomepageConfig>>('/api/admin/homepage', {
    method: 'PUT',
    data,
  });
}

export async function fetchAdminMenuConfig() {
  return request<ApiResponse<AdminMenuConfig>>('/api/admin/menus');
}

export async function updateAdminMenuConfig(data: AdminMenuConfig) {
  return request<ApiResponse<AdminMenuConfig>>('/api/admin/menus', {
    method: 'PUT',
    data,
  });
}

export async function fetchAdminSystemConfig() {
  return request<ApiResponse<SystemPublicConfig>>('/api/admin/system/config');
}

export async function updateAdminSystemConfig(data: Partial<SystemPublicConfig>) {
  return request<ApiResponse<SystemPublicConfig>>('/api/admin/system/config', {
    method: 'PUT',
    data,
  });
}

export async function updateAdminSystemTheme(data: Partial<ThemeConfig>) {
  return request<ApiResponse<ThemeConfig>>('/api/admin/system/theme', {
    method: 'PUT',
    data,
  });
}
