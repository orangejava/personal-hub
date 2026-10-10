import { onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { matchPageTemplate } from '@/utils/perf/routeTemplate';
import { startSpaVitals } from '@/utils/perf/spaVitals';
import { appendPageSample, upsertRecentPageSample, type PageMetricName } from '@/utils/perf/store';

let started = false;

function reportOnRoute(
  metric: PageMetricName,
  value: number,
  route: string | null,
  upsert: boolean,
): void {
  if (!route) return;
  const sample = { route, metric, value, at: Date.now() };
  if (upsert) upsertRecentPageSample(sample);
  else appendPageSample(sample);
}

/**
 * 全站只初始化一次。INP 用官方库，避免自己写 PerformanceObserver 算错。
 * TTFB、FCP、LCP 的官方值只属于这次文档加载。站内跳转改由 spaVitals 按当页画面补记。
 * CLS 也按当页累计，避免整次访问的位移被记到最后停留的页面。
 */
export function startPerfCollection(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const documentRoute = matchPageTemplate(window.location.pathname);
  startSpaVitals();

  onTTFB((metric) => reportOnRoute('TTFB', metric.value, documentRoute, false));
  onFCP((metric) => reportOnRoute('FCP', metric.value, documentRoute, false));
  onLCP((metric) => reportOnRoute('LCP', metric.value, documentRoute, false));
  onINP(
    (metric) =>
      reportOnRoute('INP', metric.value, matchPageTemplate(window.location.pathname), true),
    { reportAllChanges: true },
  );
}
