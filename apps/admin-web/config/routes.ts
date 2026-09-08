/**
 * personal-hub 管理端路由。路径保持 `/admin/*`，与 Nest routeKey 和权限菜单一致。
 */
export default [
  {
    path: '/',
    redirect: '/admin/dashboard',
  },
  {
    path: '/admin',
    access: 'canAdmin',
    routes: [
      { path: '/admin', redirect: '/admin/dashboard' },
      { path: '/admin/home', redirect: '/admin/dashboard' },
      { path: '/admin/dashboard', name: '运营概览', component: './admin/Dashboard' },
      { path: '/admin/content/list', name: '文档列表', component: './admin/ContentList' },
      { path: '/admin/content/booklets', name: '小册管理', component: './admin/Booklets' },
      { path: '/admin/content/categories', name: '分类管理', component: './admin/Categories' },
      { path: '/admin/content/tags', name: '标签管理', component: './admin/Tags' },
      { path: '/admin/files', name: '文件管理', component: './admin/Files' },
      { path: '/admin/homepage', redirect: '/admin/system/homepage' },
      { path: '/admin/ai/config', name: 'AI 配置', component: './admin/AiConfig' },
      { path: '/admin/ai/stats', name: 'AI 统计', component: './admin/AiStats' },
      { path: '/admin/users', name: '用户管理', component: './admin/Users' },
      { path: '/admin/roles', name: '角色管理', component: './admin/Roles' },
      { path: '/admin/menus', name: '菜单管理', component: './admin/Menus' },
      { path: '/admin/system', name: '系统配置', component: './admin/System' },
      { path: '/admin/system/site', name: '站点配置', component: './admin/SystemSite' },
      { path: '/admin/system/homepage', name: '首页配置', component: './admin/Homepage' },
      { path: '/admin/system/content', name: '内容中心配置', component: './admin/SystemContent' },
      { path: '/admin/system/about', name: '关于我配置', component: './admin/SystemAbout' },
      { path: '/admin/system/projects', name: '项目配置', component: './admin/SystemProjects' },
      { path: '/admin/system/theme', name: '主题配置', component: './admin/SystemTheme' },
      { path: '/admin/logs', name: '操作日志', component: './admin/Logs' },
    ],
  },
  { path: '/403', layout: false, component: './exception/403' },
  { path: '/404', layout: false, component: './exception/404' },
  { component: './exception/404', path: '/*' },
];
