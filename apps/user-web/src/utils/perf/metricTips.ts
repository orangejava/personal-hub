export interface MetricTip {
  abbr: string;
  title: string;
  body: string;
  range?: string;
}

/** 缩写悬停文案。只留定义和阈值，采集细节不放进提示。 */
export const METRIC_TIPS: Record<string, MetricTip> = {
  TTFB: { abbr: 'TTFB', title: '首字节时间', body: '响应开始返回的时间。', range: '良好 ≤ 800 ms' },
  FCP: { abbr: 'FCP', title: '首次内容绘制', body: '第一块内容出现的时间。', range: '良好 ≤ 1.8 s' },
  LCP: { abbr: 'LCP', title: '最大内容绘制', body: '主内容出现的时间。', range: '良好 ≤ 2.5 s' },
  CLS: { abbr: 'CLS', title: '累计布局偏移', body: '画面跳动的程度，越小越稳。', range: '良好 ≤ 0.1' },
  INP: { abbr: 'INP', title: '交互延迟', body: '点击后到下一帧的时间。', range: '良好 ≤ 200 ms' },
  route: { abbr: '路由', title: '路由切换', body: '站内跳转到新页面画出来的时间。', range: '良好 ≤ 300 ms' },
  js: { abbr: 'JS', title: '首屏脚本', body: '这次导航加载的 JS 体积。不计入顶部总分。', range: '良好 ≤ 300 KB' },
  apiP95: { abbr: 'p95', title: '接口慢请求', body: '最慢的 5% 才比它更慢。', range: '良好 ≤ 300 ms' },
  p50: {
    abbr: 'p50',
    title: '中位数',
    body: '耗时从小到大排，取正中间那一次。只有 1 次请求时，中间就是这一次。',
  },
  p95: {
    abbr: 'p95',
    title: '95 分位',
    body: '排到 95% 处的那一次，用来看偏慢的请求。次数很少时排不出更慢的一档，就会和 p50 相同。',
  },
};
