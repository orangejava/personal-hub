import type { MenuItem } from '@personal-hub/shared-types';

/** 公开前台固定导航：未登录也必须可见；name 为 locale id（公开区暂不启用多语言） */
export const publicMenu: MenuItem[] = [
  { path: '/', name: 'public.home', icon: 'home' },
  { path: '/content', name: 'public.content', icon: 'read' },
  { path: '/ai', name: 'public.ai', icon: 'robot' },
  { path: '/projects', name: 'public.projects', icon: 'project' },
  { path: '/about', name: 'public.about', icon: 'user' },
];
