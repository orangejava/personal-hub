import pages from '@personal-hub/shared-types/metrics-pages.json';

/** 前后端共享页面清单，新增模板只维护共享 JSON。 */
export interface PerfPageDefinition {
  template: string;
  label: string;
}

export const PERF_PAGES: PerfPageDefinition[] = pages;

const PAGE_LABELS = new Map(
  PERF_PAGES.map((page) => [page.template, page.label]),
);

/** 路由模板对应的面板名称；未登记的模板返回模板本身。 */
export function perfPageLabel(template: string): string {
  return PAGE_LABELS.get(template) ?? template;
}
