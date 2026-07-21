/**
 * personal-hub 路由表
 * 阶段 4：后台运营台路由骨架 + AI 导航占位
 */
export default [
  // 公开前台：layout:false，使用 PublicLayout 自定义顶栏
  {
    path: '/',
    layout: false,
    component: './public/Home',
  },
  {
    path: '/content',
    layout: false,
    component: './public/Content',
  },
  {
    path: '/content/booklets/:id/chapters/:chapterId',
    layout: false,
    component: './public/BookletChapter',
  },
  {
    path: '/content/:id',
    layout: false,
    component: './public/ContentDetail',
  },
  {
    path: '/projects',
    layout: false,
    component: './public/Projects',
  },
  {
    path: '/about',
    layout: false,
    component: './public/About',
  },
  {
    path: '/ai',
    layout: false,
    routes: [
      { path: '/ai', component: './ai/Home' },
      { path: '/ai/chat', component: './ai/Chat' },
      { path: '/ai/text', component: './ai/Text' },
      { path: '/ai/image', component: './ai/Image' },
      { path: '/ai/video', component: './ai/Video' },
      { path: '/ai/assets', component: './ai/Assets' },
      { path: '/ai/membership', component: './ai/Membership' },
      { path: '/ai/plans', component: './ai/Membership' },
      { path: '/ai/profile', component: './ai/PlaceholderTool' },
      { path: '/ai/team', component: './ai/PlaceholderTool' },
      { path: '/ai/creation-center', component: './ai/PlaceholderTool' },
      { path: '/ai/invite', component: './ai/PlaceholderTool' },
      { path: '/ai/publish', component: './ai/PlaceholderTool' },
      { path: '/ai/tutorials', component: './ai/PlaceholderTool' },
      { path: '/ai/api', component: './ai/PlaceholderTool' },
      { path: '/ai/webui', component: './ai/PlaceholderTool' },
      { path: '/ai/comfyui', component: './ai/PlaceholderTool' },
      { path: '/ai/lora', component: './ai/PlaceholderTool' },
      { path: '/ai/apps', component: './ai/PlaceholderTool' },
    ],
  },

  // 登录页
  {
    path: '/user',
    layout: false,
    routes: [
      { path: '/user/login', name: 'login', component: './user/login' },
      { path: '/user', redirect: '/user/login' },
    ],
  },

  // 工作区：使用全局 ProLayout，access 控制可访问
  {
    path: '/workspace',
    access: 'canWorkspace',
    routes: [
      { path: '/workspace', redirect: '/workspace/dashboard' },
      { path: '/workspace/dashboard', name: '工作台', component: './workspace/Dashboard' },
      { path: '/workspace/content', name: '文档管理', component: './workspace/Content' },
      { path: '/workspace/content/new', name: '新建内容', component: './workspace/ContentNew' },
      { path: '/workspace/markdown', name: '新建 Markdown', component: './workspace/Markdown' },
      { path: '/workspace/markdown/:id', name: '编辑 Markdown', component: './workspace/Markdown' },
      { path: '/workspace/richtext', name: '新建富文本', component: './workspace/RichText' },
      { path: '/workspace/richtext/:id', name: '编辑富文本', component: './workspace/RichText' },
      { path: '/workspace/booklets', name: '小册管理', component: './workspace/Booklets' },
      { path: '/workspace/favorites', name: '我的收藏', component: './workspace/Favorites' },
      { path: '/workspace/ai/history', name: 'AI 历史', component: './workspace/AiHistory' },
      { path: '/workspace/usage', name: '我的用量', component: './workspace/Usage' },
      { path: '/workspace/profile', name: '个人设置', component: './workspace/Profile' },
    ],
  },

  // 后台运营台（阶段 4）
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
      { path: '/admin/homepage', name: '首页配置', component: './admin/Homepage' },
      { path: '/admin/ai/config', name: 'AI 配置', component: './admin/AiConfig' },
      { path: '/admin/ai/stats', name: 'AI 统计', component: './admin/AiStats' },
      { path: '/admin/users', name: '用户管理', component: './admin/Users' },
      { path: '/admin/roles', name: '角色管理', component: './admin/Roles' },
      { path: '/admin/menus', name: '菜单管理', component: './admin/Menus' },
      { path: '/admin/system', name: '系统配置', component: './admin/System' },
      { path: '/admin/system/theme', name: '主题配置', component: './admin/SystemTheme' },
      { path: '/admin/logs', name: '操作日志', component: './admin/Logs' },
    ],
  },

  // 异常页
  { path: '/403', layout: false, component: './exception/403' },
  { path: '/404', layout: false, component: './exception/404' },
  { component: './exception/404', path: '/*' },
];
