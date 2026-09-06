/**
 * 前端受控 routeKey 清单。由两端 routeRegistry 并集固化，Nest 不扫描前端仓库。
 * 后台新增内部菜单只能选这里的 key，否则公开/工作区会丢菜单。
 */
export interface MenuRouteOption {
  routeKey: string;
  localeKey: string;
  icon: string;
  scopes: Array<'PUBLIC' | 'WORKSPACE' | 'ADMIN' | 'AI'>;
}

export const MENU_ROUTE_OPTIONS: readonly MenuRouteOption[] = [
  { routeKey: 'public.home', localeKey: 'public.home', icon: 'home', scopes: ['PUBLIC'] },
  { routeKey: 'public.contents', localeKey: 'public.content', icon: 'read', scopes: ['PUBLIC'] },
  { routeKey: 'public.ai', localeKey: 'public.ai', icon: 'robot', scopes: ['PUBLIC'] },
  {
    routeKey: 'public.projects',
    localeKey: 'public.projects',
    icon: 'project',
    scopes: ['PUBLIC'],
  },
  { routeKey: 'public.about', localeKey: 'public.about', icon: 'user', scopes: ['PUBLIC'] },
  {
    routeKey: 'workspace.dashboard',
    localeKey: 'workspace.dashboard',
    icon: 'dashboard',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.content.group',
    localeKey: 'workspace.content.group',
    icon: 'read',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.contents',
    localeKey: 'workspace.content.list',
    icon: 'fileText',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.content.new',
    localeKey: 'workspace.content.new',
    icon: 'edit',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.markdown.new',
    localeKey: 'workspace.markdown.new',
    icon: 'edit',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.richtext.new',
    localeKey: 'workspace.richtext.new',
    icon: 'edit',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.booklets',
    localeKey: 'workspace.booklets',
    icon: 'book',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.favorites',
    localeKey: 'workspace.favorites',
    icon: 'star',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.aiHistory',
    localeKey: 'workspace.aiHistory',
    icon: 'robot',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.usage',
    localeKey: 'workspace.usage',
    icon: 'pieChart',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.profile',
    localeKey: 'workspace.profile',
    icon: 'setting',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'workspace.sessions',
    localeKey: 'workspace.sessions',
    icon: 'laptop',
    scopes: ['WORKSPACE'],
  },
  {
    routeKey: 'admin.dashboard',
    localeKey: 'admin.dashboard',
    icon: 'dashboard',
    scopes: ['ADMIN'],
  },
  {
    routeKey: 'admin.content.group',
    localeKey: 'admin.content.group',
    icon: 'read',
    scopes: ['ADMIN'],
  },
  {
    routeKey: 'admin.content.list',
    localeKey: 'admin.content.list',
    icon: 'fileText',
    scopes: ['ADMIN'],
  },
  {
    routeKey: 'admin.content.booklets',
    localeKey: 'admin.content.booklets',
    icon: 'book',
    scopes: ['ADMIN'],
  },
  {
    routeKey: 'admin.content.categories',
    localeKey: 'admin.content.categories',
    icon: 'folder',
    scopes: ['ADMIN'],
  },
  {
    routeKey: 'admin.content.tags',
    localeKey: 'admin.content.tags',
    icon: 'tags',
    scopes: ['ADMIN'],
  },
  {
    routeKey: 'admin.files',
    localeKey: 'admin.files',
    icon: 'cloudUpload',
    scopes: ['ADMIN'],
  },
  {
    routeKey: 'admin.homepage',
    localeKey: 'admin.homepage',
    icon: 'home',
    scopes: ['ADMIN'],
  },
  { routeKey: 'admin.ai.group', localeKey: 'admin.ai.group', icon: 'robot', scopes: ['ADMIN'] },
  {
    routeKey: 'admin.ai.config',
    localeKey: 'admin.ai.config',
    icon: 'setting',
    scopes: ['ADMIN'],
  },
  {
    routeKey: 'admin.ai.stats',
    localeKey: 'admin.ai.stats',
    icon: 'pieChart',
    scopes: ['ADMIN'],
  },
  {
    routeKey: 'admin.system.group',
    localeKey: 'admin.system.group',
    icon: 'setting',
    scopes: ['ADMIN'],
  },
  { routeKey: 'admin.users', localeKey: 'admin.users', icon: 'user', scopes: ['ADMIN'] },
  { routeKey: 'admin.roles', localeKey: 'admin.roles', icon: 'team', scopes: ['ADMIN'] },
  { routeKey: 'admin.menus', localeKey: 'admin.menus', icon: 'menu', scopes: ['ADMIN'] },
  {
    routeKey: 'admin.system.config',
    localeKey: 'admin.system.config',
    icon: 'tool',
    scopes: ['ADMIN'],
  },
  {
    routeKey: 'admin.system.theme',
    localeKey: 'admin.system.theme',
    icon: 'bgColors',
    scopes: ['ADMIN'],
  },
  { routeKey: 'admin.logs', localeKey: 'admin.logs', icon: 'fileSearch', scopes: ['ADMIN'] },
];

export const MENU_ROUTE_KEY_SET = new Set(MENU_ROUTE_OPTIONS.map((item) => item.routeKey));

export const MENU_ROUTE_META = Object.fromEntries(
  MENU_ROUTE_OPTIONS.map((item) => [item.routeKey, item]),
);

/** 禁用或删除后会锁死后台恢复入口的系统菜单。 */
export const CORE_RECOVERY_ROUTE_KEYS = new Set([
  'admin.menus',
  'admin.roles',
  'admin.system.config',
  'admin.system.group',
]);
