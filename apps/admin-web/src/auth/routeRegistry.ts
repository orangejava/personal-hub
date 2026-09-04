import type { NestMenuNode } from '@personal-hub/api-client';
import type { MenuItem } from '@personal-hub/shared-types';

/**
 * 前端路由注册表：后端只存 routeKey，路径和图标由当前 React 应用解析。
 * 未登记的内部菜单不会渲染，避免后台配出失效路径。
 */
export interface RouteRegistryItem {
  path: string;
  /** locale id，对应 `menu.${name}` */
  name: string;
  icon?: string;
}

export const NEST_ROUTE_REGISTRY: Record<string, RouteRegistryItem> = {
  'public.home': { path: '/', name: 'public.home', icon: 'home' },
  'public.contents': { path: '/content', name: 'public.content', icon: 'read' },
  'public.ai': { path: '/ai', name: 'public.ai', icon: 'robot' },
  'public.projects': {
    path: '/projects',
    name: 'public.projects',
    icon: 'project',
  },
  'public.about': { path: '/about', name: 'public.about', icon: 'user' },
  'workspace.dashboard': {
    path: '/workspace/dashboard',
    name: 'workspace.dashboard',
    icon: 'dashboard',
  },
  'workspace.content.group': {
    path: '/workspace/content-center',
    name: 'workspace.content.group',
    icon: 'read',
  },
  'workspace.contents': {
    path: '/workspace/content',
    name: 'workspace.content.list',
    icon: 'fileText',
  },
  'workspace.content.new': {
    path: '/workspace/content/new',
    name: 'workspace.content.new',
    icon: 'edit',
  },
  'workspace.markdown.new': {
    path: '/workspace/markdown',
    name: 'workspace.markdown.new',
    icon: 'edit',
  },
  'workspace.richtext.new': {
    path: '/workspace/richtext',
    name: 'workspace.richtext.new',
    icon: 'edit',
  },
  'workspace.booklets': {
    path: '/workspace/booklets',
    name: 'workspace.booklets',
    icon: 'book',
  },
  'workspace.favorites': {
    path: '/workspace/favorites',
    name: 'workspace.favorites',
    icon: 'star',
  },
  'workspace.aiHistory': {
    path: '/workspace/ai/history',
    name: 'workspace.aiHistory',
    icon: 'robot',
  },
  'workspace.usage': {
    path: '/workspace/usage',
    name: 'workspace.usage',
    icon: 'pieChart',
  },
  'workspace.profile': {
    path: '/workspace/profile',
    name: 'workspace.profile',
    icon: 'setting',
  },
  'workspace.sessions': {
    path: '/workspace/sessions',
    name: 'workspace.sessions',
    icon: 'laptop',
  },
  'admin.dashboard': {
    path: '/admin/dashboard',
    name: 'admin.dashboard',
    icon: 'dashboard',
  },
  'admin.content.group': {
    path: '/admin/content',
    name: 'admin.content.group',
    icon: 'read',
  },
  'admin.content.list': {
    path: '/admin/content/list',
    name: 'admin.content.list',
    icon: 'fileText',
  },
  'admin.content.booklets': {
    path: '/admin/content/booklets',
    name: 'admin.content.booklets',
    icon: 'book',
  },
  'admin.content.categories': {
    path: '/admin/content/categories',
    name: 'admin.content.categories',
    icon: 'folder',
  },
  'admin.content.tags': {
    path: '/admin/content/tags',
    name: 'admin.content.tags',
    icon: 'tags',
  },
  'admin.files': {
    path: '/admin/files',
    name: 'admin.files',
    icon: 'cloudUpload',
  },
  'admin.homepage': {
    path: '/admin/homepage',
    name: 'admin.homepage',
    icon: 'home',
  },
  'admin.ai.group': {
    path: '/admin/ai',
    name: 'admin.ai.group',
    icon: 'robot',
  },
  'admin.ai.config': {
    path: '/admin/ai/config',
    name: 'admin.ai.config',
    icon: 'setting',
  },
  'admin.ai.stats': {
    path: '/admin/ai/stats',
    name: 'admin.ai.stats',
    icon: 'pieChart',
  },
  'admin.system.group': {
    path: '/admin/system-group',
    name: 'admin.system.group',
    icon: 'setting',
  },
  'admin.users': { path: '/admin/users', name: 'admin.users', icon: 'user' },
  'admin.roles': { path: '/admin/roles', name: 'admin.roles', icon: 'team' },
  'admin.menus': { path: '/admin/menus', name: 'admin.menus', icon: 'menu' },
  'admin.system.config': {
    path: '/admin/system',
    name: 'admin.system.config',
    icon: 'tool',
  },
  'admin.system.theme': {
    path: '/admin/system/theme',
    name: 'admin.system.theme',
    icon: 'bgColors',
  },
  'admin.logs': { path: '/admin/logs', name: 'admin.logs', icon: 'fileSearch' },
};

export type { NestMenuNode } from '@personal-hub/api-client';

/**
 * 管理端只渲染 ADMIN 作用域菜单，包一层 `/admin` 供布局截取子树。
 */
export function mapNestMenusToLayout(nodes: NestMenuNode[]): MenuItem[] {
  const adminItems = flattenMapped(
    nodes.filter((node) => node.scope === 'ADMIN'),
  );
  if (adminItems.length === 0) {
    return [];
  }
  return [
    {
      path: '/admin',
      name: '后台管理',
      icon: 'crown',
      children: adminItems,
    },
  ];
}

function flattenMapped(nodes: NestMenuNode[]): MenuItem[] {
  return nodes
    .map((node) => mapNode(node))
    .filter((item): item is MenuItem => item !== null);
}

function mapNode(node: NestMenuNode): MenuItem | null {
  const children = flattenMapped(node.children ?? []);
  if (node.type === 'DIRECTORY') {
    const registry = node.routeKey
      ? NEST_ROUTE_REGISTRY[node.routeKey]
      : undefined;
    if (children.length === 0) {
      return null;
    }
    return {
      path: registry?.path ?? `/${node.id}`,
      name: node.name,
      localeKey: node.localeKey ?? undefined,
      icon: node.icon ?? registry?.icon,
      children,
    };
  }

  if (node.type === 'EXTERNAL' && node.externalUrl) {
    return {
      path: node.externalUrl,
      name: node.name,
      localeKey: node.localeKey ?? undefined,
      children: children.length > 0 ? children : undefined,
    };
  }

  if (!node.routeKey) {
    return children.length > 0
      ? { path: `/${node.id}`, name: node.name, children }
      : null;
  }

  const registry = NEST_ROUTE_REGISTRY[node.routeKey];
  if (!registry) {
    return children.length > 0
      ? { path: `/${node.routeKey}`, name: node.name, children }
      : null;
  }

  return {
    path: registry.path,
    name: node.name,
    localeKey: node.localeKey ?? undefined,
    icon: node.icon ?? registry.icon,
    children: children.length > 0 ? children : undefined,
  };
}
