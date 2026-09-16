/**
 * Mock 菜单配置：按角色生成可见菜单
 */
import { UserRole, type MenuItem } from '@personal-hub/shared-types';

/** 公开前台菜单（所有用户可见，含未登录）；name 为 locale id */
export const publicMenu: MenuItem[] = [
  { path: '/', name: 'public.home', icon: 'home' },
  { path: '/content', name: 'public.content', icon: 'read' },
  { path: '/ai', name: 'public.ai', icon: 'robot' },
  { path: '/projects', name: 'public.projects', icon: 'project' },
  { path: '/about', name: 'public.about', icon: 'user' },
];

/** 工作区菜单（需 workspace:access）；name 为 locale id */
export const workspaceMenu: MenuItem[] = [
  { path: '/workspace/dashboard', name: 'workspace.dashboard', icon: 'dashboard' },
  {
    path: '/workspace/content-center',
    name: 'workspace.content.group',
    icon: 'read',
    children: [
      { path: '/workspace/content', name: 'workspace.content.list', icon: 'fileText' },
      { path: '/workspace/content/new', name: 'workspace.content.new', icon: 'edit' },
      { path: '/workspace/markdown', name: 'workspace.markdown.new', icon: 'edit' },
      { path: '/workspace/richtext', name: 'workspace.richtext.new', icon: 'edit' },
      { path: '/workspace/booklets', name: 'workspace.booklets', icon: 'book' },
      { path: '/workspace/uploads', name: 'workspace.uploads', icon: 'cloudUpload' },
      { path: '/workspace/favorites', name: 'workspace.favorites', icon: 'star' },
    ],
  },
  { path: '/workspace/ai/history', name: 'workspace.aiHistory', icon: 'robot' },
  { path: '/workspace/usage', name: 'workspace.usage', icon: 'pieChart' },
  { path: '/workspace/profile', name: 'workspace.profile', icon: 'setting' },
];

/** 后台菜单（需 admin:access）；name 为 locale id */
export const adminMenu: MenuItem[] = [
  { path: '/admin/dashboard', name: 'admin.dashboard', icon: 'dashboard', permissions: ['admin:access'] },
  {
    path: '/admin/content',
    name: 'admin.content.group',
    icon: 'read',
    permissions: ['admin:access'],
    children: [
      { path: '/admin/content/list', name: 'admin.content.list', icon: 'fileText' },
      { path: '/admin/content/reviews', name: 'admin.content.reviews', icon: 'audit' },
      { path: '/admin/content/booklets', name: 'admin.content.booklets', icon: 'book' },
      { path: '/admin/content/categories', name: 'admin.content.categories', icon: 'folder' },
      { path: '/admin/content/tags', name: 'admin.content.tags', icon: 'tags' },
      { path: '/admin/files', name: 'admin.files', icon: 'cloudUpload' },
    ],
  },
  {
    path: '/admin/ai',
    name: 'admin.ai.group',
    icon: 'robot',
    permissions: ['ai:manage'],
    children: [
      { path: '/admin/ai/config', name: 'admin.ai.config', icon: 'setting' },
      { path: '/admin/ai/stats', name: 'admin.ai.stats', icon: 'pieChart' },
    ],
  },
  {
    path: '/admin/system-group',
    name: 'admin.system.group',
    icon: 'setting',
    permissions: ['admin:access'],
    children: [
      { path: '/admin/users', name: 'admin.users', icon: 'user' },
      { path: '/admin/roles', name: 'admin.roles', icon: 'team' },
      { path: '/admin/menus', name: 'admin.menus', icon: 'menu' },
      { path: '/admin/system', name: 'admin.system.config', icon: 'tool' },
      { path: '/admin/system/theme', name: 'admin.system.theme', icon: 'bgColors' },
      { path: '/admin/logs', name: 'admin.logs', icon: 'fileSearch' },
    ],
  },
];

/** 根据角色拼装完整菜单 */
export function buildMenu(role: UserRole | null): MenuItem[] {
  const menu: MenuItem[] = [...publicMenu];
  if (!role) return menu;
  if (role === UserRole.Editor || role === UserRole.Admin) {
    menu.push({ path: '/workspace', name: '工作区', icon: 'desktop', children: workspaceMenu });
  }
  if (role === UserRole.Admin) {
    menu.push({ path: '/admin', name: '后台管理', icon: 'crown', children: adminMenu });
  }
  return menu;
}
