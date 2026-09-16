import type { MenuItem } from '@personal-hub/shared-types';

/** Nest 导航失败时的公开顶栏兜底；name 已是展示文案，与 PRD §4.3.1 一致。 */
export const publicMenu: MenuItem[] = [
  { path: '/', name: '首页', localeKey: 'public.home', icon: 'home' },
  { path: '/content', name: '内容中心', localeKey: 'public.content', icon: 'read' },
  { path: '/ai', name: 'AI 工具', localeKey: 'public.ai', icon: 'robot' },
  { path: '/projects', name: '项目', localeKey: 'public.projects', icon: 'project' },
  { path: '/about', name: '关于', localeKey: 'public.about', icon: 'user' },
];
