/**
 * 性能面板要统计的页面。
 * 只按路由模板聚合，具体 ID 不进入存储；新增页面时在这里加一行即可。
 */
export interface PerfPageDefinition {
  template: string;
  label: string;
}

export const PERF_PAGES: PerfPageDefinition[] = [
  { template: '/', label: '首页' },
  { template: '/content', label: '内容中心' },
  { template: '/content/:id', label: '内容详情' },
  { template: '/content/booklets/:id/chapters/:chapterId', label: '小册阅读' },
  { template: '/projects', label: '项目' },
  { template: '/about', label: '关于' },
  { template: '/status', label: '性能面板' },
  { template: '/ai', label: 'AI 首页' },
  { template: '/ai/chat', label: 'AI 对话' },
  { template: '/user/login', label: '登录' },
  { template: '/workspace/dashboard', label: '工作台' },
];

const PAGE_LABELS = new Map(PERF_PAGES.map((page) => [page.template, page.label]));

/** 路由模板对应的面板名称；未登记的模板返回模板本身。 */
export function perfPageLabel(template: string): string {
  return PAGE_LABELS.get(template) ?? template;
}
