/**
 * 后台运营 mock 接口（阶段 4）
 */
import type { Request, Response } from 'express';
import { ContentStatus, UserRole } from '@personal-hub/shared-types';
import { contents } from './data/contents';
import {
  adminFiles,
  adminAiConfigData,
  adminAiStatsData,
  adminRoles,
  adminUsers,
  appendAuditLog,
  auditLogs,
  categories,
  createAdminAiModelConfig,
  createCategory,
  deleteAdminAiModelConfig,
  deleteContentById,
  deleteFileById,
  enrichCategories,
  getDashboardStats,
  homepageConfig,
  menuConfig,
  moveAdminAiToolSort,
  tags,
  updateAdminAiBrandingConfig,
  updateCategory,
  updateAdminAiProviderConfig,
  updateAdminAiModelConfig,
  updateAdminAiToolConfig,
  updateAdminAiToolStatus,
  updateContentStatus,
} from './data/admin-store';
import { systemConfig } from './data/system-config';
import { ok, fail, parsePagination } from './utils';

function filterList<T>(list: T[], keyword?: string, pick?: (item: T) => string) {
  if (!keyword?.trim()) return list;
  const k = keyword.toLowerCase();
  return list.filter((item) => pick!(item).toLowerCase().includes(k));
}

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? '');
}

export default {
  'GET /api/admin/dashboard/stats': (_req: Request, res: Response) => {
    ok(res, getDashboardStats());
  },

  'GET /api/admin/ai/config': (_req: Request, res: Response) => {
    ok(res, adminAiConfigData);
  },

  'PUT /api/admin/ai/branding': (req: Request, res: Response) => {
    const branding = updateAdminAiBrandingConfig(req.body || {});
    appendAuditLog({
      action: 'update_ai_branding_config',
      resource: 'ai-branding',
      operator: 'admin@example.com',
      detail: `${branding.brandName} 品牌配置已更新`,
    });
    ok(res, branding);
  },

  'PUT /api/admin/ai/providers/:code': (req: Request, res: Response) => {
    const code = routeParam(req.params.code);
    const provider = updateAdminAiProviderConfig(code, req.body || {});
    if (!provider) {
      fail(res, 404, 'AI 厂商不存在');
      return;
    }
    appendAuditLog({
      action: 'update_ai_provider_config',
      resource: `ai-provider:${provider.code}`,
      operator: 'admin@example.com',
      detail: `${provider.name} 配置已更新`,
    });
    ok(res, provider);
  },

  'PUT /api/admin/ai/tools/:code/status': (req: Request, res: Response) => {
    const code = routeParam(req.params.code);
    const { status } = req.body || {};
    if (!['enabled', 'disabled', 'comingSoon'].includes(status)) {
      fail(res, 400, '非法工具状态');
      return;
    }
    const tool = updateAdminAiToolStatus(code, status);
    if (!tool) {
      fail(res, 404, 'AI 工具不存在');
      return;
    }
    appendAuditLog({
      action: 'update_ai_tool_status',
      resource: `ai-tool:${tool.code}`,
      operator: 'admin@example.com',
      detail: `${tool.name} → ${status}`,
    });
    ok(res, tool);
  },

  'PUT /api/admin/ai/tools/:code': (req: Request, res: Response) => {
    const code = routeParam(req.params.code);
    const { status } = req.body || {};
    if (status && !['enabled', 'disabled', 'comingSoon'].includes(status)) {
      fail(res, 400, '非法工具状态');
      return;
    }
    const tool = updateAdminAiToolConfig(code, req.body || {});
    if (!tool) {
      fail(res, 404, 'AI 工具不存在');
      return;
    }
    appendAuditLog({
      action: 'update_ai_tool_config',
      resource: `ai-tool:${tool.code}`,
      operator: 'admin@example.com',
      detail: `${tool.name} 配置已更新`,
    });
    ok(res, tool);
  },

  'POST /api/admin/ai/tools/:code/move': (req: Request, res: Response) => {
    const code = routeParam(req.params.code);
    const { direction } = req.body || {};
    if (direction !== 'up' && direction !== 'down') {
      fail(res, 400, '非法排序方向');
      return;
    }
    const tools = moveAdminAiToolSort(code, direction);
    appendAuditLog({
      action: 'move_ai_tool_sort',
      resource: `ai-tool:${code}`,
      operator: 'admin@example.com',
      detail: `AI 工具排序 ${direction}`,
    });
    ok(res, tools);
  },

  'POST /api/admin/ai/models': (req: Request, res: Response) => {
    const model = createAdminAiModelConfig(req.body || {});
    if (!model) {
      fail(res, 400, 'AI 模型参数非法或模型 ID 已存在');
      return;
    }
    appendAuditLog({
      action: 'create_ai_model_config',
      resource: `ai-model:${model.modelId}`,
      operator: 'admin@example.com',
      detail: `${model.displayName} 已新增`,
    });
    ok(res, model);
  },

  'PUT /api/admin/ai/models/:id': (req: Request, res: Response) => {
    const id = routeParam(req.params.id);
    const model = updateAdminAiModelConfig(id, req.body || {});
    if (!model) {
      fail(res, 404, 'AI 模型不存在');
      return;
    }
    appendAuditLog({
      action: 'update_ai_model_config',
      resource: `ai-model:${model.modelId}`,
      operator: 'admin@example.com',
      detail: `${model.displayName} 配置已更新`,
    });
    ok(res, model);
  },

  'DELETE /api/admin/ai/models/:id': (req: Request, res: Response) => {
    const id = routeParam(req.params.id);
    const model = deleteAdminAiModelConfig(id);
    if (!model) {
      fail(res, 404, 'AI 模型不存在');
      return;
    }
    appendAuditLog({
      action: 'delete_ai_model_config',
      resource: `ai-model:${model.modelId}`,
      operator: 'admin@example.com',
      detail: `${model.displayName} 已删除`,
    });
    ok(res, model);
  },

  'GET /api/admin/ai/stats': (_req: Request, res: Response) => {
    ok(res, adminAiStatsData);
  },

  'GET /api/admin/users': (req: Request, res: Response) => {
    const { page, pageSize } = parsePagination(req);
    const email = req.query.email as string | undefined;
    const list = filterList(adminUsers, email, (u) => u.email);
    const start = (page - 1) * pageSize;
    ok(res, { list: list.slice(start, start + pageSize), total: list.length, page, pageSize });
  },

  'PUT /api/admin/users/:id/status': (req: Request, res: Response) => {
    const user = adminUsers.find((u) => u.id === req.params.id);
    if (!user) {
      fail(res, 404, '用户不存在');
      return;
    }
    const { status } = req.body || {};
    if (status !== 'active' && status !== 'disabled') {
      fail(res, 400, '非法状态');
      return;
    }
    user.status = status;
    appendAuditLog({
      action: 'update_status',
      resource: `user:${user.id}`,
      operator: 'admin@example.com',
      detail: `状态 → ${status}`,
    });
    ok(res, user);
  },

  'PUT /api/admin/users/:id/role': (req: Request, res: Response) => {
    const user = adminUsers.find((u) => u.id === req.params.id);
    if (!user) {
      fail(res, 404, '用户不存在');
      return;
    }
    const { role } = req.body || {};
    if (!Object.values(UserRole).includes(role)) {
      fail(res, 400, '非法角色');
      return;
    }
    user.role = role;
    appendAuditLog({
      action: 'assign_role',
      resource: `user:${user.id}`,
      operator: 'admin@example.com',
      detail: `角色 → ${role}`,
    });
    ok(res, user);
  },

  'GET /api/admin/roles': (_req: Request, res: Response) => {
    ok(res, adminRoles);
  },

  'PUT /api/admin/roles/:code/permissions': (req: Request, res: Response) => {
    const role = adminRoles.find((r) => r.code === req.params.code);
    if (!role) {
      fail(res, 404, '角色不存在');
      return;
    }
    const { permissions } = req.body || {};
    if (!Array.isArray(permissions)) {
      fail(res, 400, 'permissions 必须为数组');
      return;
    }
    role.permissions = permissions;
    appendAuditLog({
      action: 'update_permissions',
      resource: `role:${role.code}`,
      operator: 'admin@example.com',
    });
    ok(res, role);
  },

  'GET /api/admin/contents': (req: Request, res: Response) => {
    const { page, pageSize } = parsePagination(req);
    const title = req.query.title as string | undefined;
    const type = req.query.type as string | undefined;
    let list = [...contents];
    if (title) list = list.filter((c) => c.title.includes(title));
    if (type) list = list.filter((c) => c.type === type);
    const start = (page - 1) * pageSize;
    ok(res, { list: list.slice(start, start + pageSize), total: list.length, page, pageSize });
  },

  'DELETE /api/admin/contents/:id': (req: Request, res: Response) => {
    const id = routeParam(req.params.id);
    const deleted = deleteContentById(id);
    if (!deleted) {
      fail(res, 404, '内容不存在');
      return;
    }
    appendAuditLog({
      action: 'delete',
      resource: `content:${id}`,
      operator: 'admin@example.com',
    });
    ok(res, null);
  },

  'PUT /api/admin/contents/:id/status': (req: Request, res: Response) => {
    const { status } = req.body || {};
    const id = routeParam(req.params.id);
    if (!Object.values(ContentStatus).includes(status)) {
      fail(res, 400, '非法状态');
      return;
    }
    const item = updateContentStatus(id, status);
    if (!item) {
      fail(res, 404, '内容不存在');
      return;
    }
    appendAuditLog({
      action: 'update_status',
      resource: `content:${id}`,
      operator: 'admin@example.com',
      detail: status,
    });
    ok(res, item);
  },

  'GET /api/admin/categories': (_req: Request, res: Response) => {
    ok(res, enrichCategories());
  },

  'POST /api/admin/categories': (req: Request, res: Response) => {
    const { name, slug, parentId, sort = 0 } = req.body || {};
    if (!name || !slug) {
      fail(res, 400, 'name/slug 必填');
      return;
    }
    if (parentId && !categories.some((item) => item.id === parentId)) {
      fail(res, 400, '父级分类不存在');
      return;
    }
    if (categories.some((item) => item.slug === slug)) {
      fail(res, 400, 'slug 已存在');
      return;
    }
    const row = createCategory({ name, slug, parentId, sort });
    appendAuditLog({ action: 'create', resource: `category:${row.id}`, operator: 'admin@example.com' });
    ok(res, row);
  },

  'PUT /api/admin/categories/:id': (req: Request, res: Response) => {
    const { name, slug, parentId, sort = 0 } = req.body || {};
    if (!name || !slug) {
      fail(res, 400, 'name/slug 必填');
      return;
    }
    const id = routeParam(req.params.id);
    if (parentId === id) {
      fail(res, 400, '不能把自己设为父级');
      return;
    }
    if (parentId && !categories.some((item) => item.id === parentId)) {
      fail(res, 400, '父级分类不存在');
      return;
    }
    if (categories.some((item) => item.id !== id && item.slug === slug)) {
      fail(res, 400, 'slug 已存在');
      return;
    }
    const row = updateCategory(id, { name, slug, parentId, sort });
    if (!row) {
      fail(res, 404, '分类不存在');
      return;
    }
    appendAuditLog({ action: 'update', resource: `category:${row.id}`, operator: 'admin@example.com' });
    ok(res, row);
  },

  'DELETE /api/admin/categories/:id': (req: Request, res: Response) => {
    const id = routeParam(req.params.id);
    const idx = categories.findIndex((c) => c.id === id);
    if (idx < 0) {
      fail(res, 404, '分类不存在');
      return;
    }
    const row = enrichCategories().find((item) => item.id === id);
    if (row?.childCount) {
      fail(res, 400, '存在子分类，不能删除');
      return;
    }
    if (row?.contentCount) {
      fail(res, 400, '存在关联内容，不能删除');
      return;
    }
    categories.splice(idx, 1);
    appendAuditLog({ action: 'delete', resource: `category:${id}`, operator: 'admin@example.com' });
    ok(res, null);
  },

  'GET /api/admin/tags': (_req: Request, res: Response) => {
    ok(res, tags);
  },

  'POST /api/admin/tags': (req: Request, res: Response) => {
    const { name, slug } = req.body || {};
    if (!name || !slug) {
      fail(res, 400, 'name/slug 必填');
      return;
    }
    const row = { id: `tag-${Date.now()}`, name, slug, usageCount: 0 };
    tags.push(row);
    appendAuditLog({ action: 'create', resource: `tag:${row.id}`, operator: 'admin@example.com' });
    ok(res, row);
  },

  'DELETE /api/admin/tags/:id': (req: Request, res: Response) => {
    const idx = tags.findIndex((t) => t.id === req.params.id);
    if (idx >= 0) tags.splice(idx, 1);
    appendAuditLog({ action: 'delete', resource: `tag:${req.params.id}`, operator: 'admin@example.com' });
    ok(res, null);
  },

  'GET /api/admin/files': (req: Request, res: Response) => {
    const keyword = (req.query.keyword as string | undefined)?.trim().toLowerCase();
    const mimeGroup = req.query.mimeGroup as string | undefined;
    let list = [...adminFiles];
    if (keyword) {
      list = list.filter((file) => file.name.toLowerCase().includes(keyword));
    }
    if (mimeGroup) {
      list = list.filter((file) => {
        if (mimeGroup === 'image') return file.mimeType.startsWith('image/');
        if (mimeGroup === 'pdf') return file.mimeType === 'application/pdf';
        if (mimeGroup === 'word') return file.mimeType.includes('wordprocessingml');
        if (mimeGroup === 'other') {
          return !file.mimeType.startsWith('image/') && file.mimeType !== 'application/pdf' && !file.mimeType.includes('wordprocessingml');
        }
        return true;
      });
    }
    ok(res, list);
  },

  'DELETE /api/admin/files/:id': (req: Request, res: Response) => {
    const id = routeParam(req.params.id);
    const result = deleteFileById(id);
    if (!result.ok) {
      fail(res, result.message === '文件不存在' ? 404 : 400, result.message);
      return;
    }
    appendAuditLog({ action: 'delete', resource: `file:${id}`, operator: 'admin@example.com' });
    ok(res, null);
  },

  'POST /api/admin/files/batch-delete': (req: Request, res: Response) => {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      fail(res, 400, 'ids 必须为非空数组');
      return;
    }
    const failed: { id: string; message: string }[] = [];
    const deleted: string[] = [];
    for (const id of ids) {
      const result = deleteFileById(id);
      if (result.ok) deleted.push(id);
      else failed.push({ id, message: result.message });
    }
    if (deleted.length) {
      appendAuditLog({
        action: 'batch_delete',
        resource: 'file',
        operator: 'admin@example.com',
        detail: `删除 ${deleted.length} 个文件`,
      });
    }
    ok(res, { deleted, failed });
  },

  'GET /api/admin/logs': (req: Request, res: Response) => {
    const { page, pageSize } = parsePagination(req);
    const action = req.query.action as string | undefined;
    const resource = req.query.resource as string | undefined;
    let list = [...auditLogs];
    if (action) list = list.filter((l) => l.action === action);
    if (resource) list = list.filter((l) => l.resource.includes(resource));
    const start = (page - 1) * pageSize;
    ok(res, { list: list.slice(start, start + pageSize), total: list.length, page, pageSize });
  },

  'GET /api/admin/homepage': (_req: Request, res: Response) => {
    ok(res, homepageConfig);
  },

  'PUT /api/admin/homepage': (req: Request, res: Response) => {
    Object.assign(homepageConfig, req.body || {});
    appendAuditLog({
      action: 'update',
      resource: 'homepage:config',
      operator: 'admin@example.com',
      detail: '保存首页配置',
    });
    ok(res, homepageConfig);
  },

  'GET /api/admin/menus': (_req: Request, res: Response) => {
    ok(res, menuConfig);
  },

  'PUT /api/admin/menus': (req: Request, res: Response) => {
    Object.assign(menuConfig, req.body || {});
    appendAuditLog({
      action: 'update',
      resource: 'menu:config',
      operator: 'admin@example.com',
      detail: '保存菜单配置',
    });
    ok(res, menuConfig);
  },

  'GET /api/admin/system/config': (_req: Request, res: Response) => {
    ok(res, systemConfig);
  },

  'PUT /api/admin/system/config': (req: Request, res: Response) => {
    Object.assign(systemConfig, req.body || {});
    appendAuditLog({ action: 'update', resource: 'system:config', operator: 'admin@example.com' });
    ok(res, systemConfig);
  },

  'PUT /api/admin/system/theme': (req: Request, res: Response) => {
    Object.assign(systemConfig.theme, req.body || {});
    appendAuditLog({ action: 'update', resource: 'system:theme', operator: 'admin@example.com' });
    ok(res, systemConfig.theme);
  },
};
