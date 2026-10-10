import { matchPageTemplate } from '@/utils/perf/routeTemplate';
import { appendPageSample, upsertRecentPageSample } from '@/utils/perf/store';

interface TimedResource {
  startTime: number;
  responseStart: number;
  initiatorType: string;
}

let observing = false;
let clsRoute: string | null = null;
let clsValue = 0;
/** 观察器比第一次路由更早拿到的位移，记到第一个页面上。 */
let clsBeforeRoute = 0;
let generation = 0;
let lateTimer = 0;
let clsFlushTimer = 0;

/** 一次停留里位移会连着来，稍等再写，避免每跳一次都打 localStorage。 */
const CLS_FLUSH_DELAY_MS = 400;

/**
 * 站内跳转没有新的文档加载，浏览器不会再报 TTFB / FCP / LCP。
 * 这里取这次导航之后第一笔请求的首字节；没有新请求就返回 null。
 */
export function resourceTtfb(entries: TimedResource[], since: number): number | null {
  const hits = entries
    .filter(
      (entry) =>
        entry.startTime >= since &&
        entry.responseStart > 0 &&
        (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest'),
    )
    .sort((left, right) => left.startTime - right.startTime);
  const first = hits[0];
  if (!first) return null;
  return Math.max(0, first.responseStart - first.startTime);
}

function boxArea(element: Element): number {
  const rect = element.getBoundingClientRect();
  const width = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
  const height = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

/** 只量主内容，避免顶栏在每个页面都变成最大的那一块。 */
function largestInMain(): number {
  const root = document.querySelector('main');
  if (!root) return 0;
  let best = 0;
  root.querySelectorAll('img, svg, video, h1, h2, h3, p, li').forEach((node) => {
    const text = node.textContent?.trim() ?? '';
    const visual =
      node instanceof HTMLImageElement || node instanceof SVGElement || node instanceof HTMLVideoElement;
    if (!visual && text.length === 0) return;
    best = Math.max(best, boxArea(node));
  });
  return best;
}

function flushCls(): void {
  if (!clsRoute) return;
  upsertRecentPageSample({
    route: clsRoute,
    metric: 'CLS',
    value: clsValue,
    at: Date.now(),
  });
}

function scheduleClsFlush(): void {
  window.clearTimeout(clsFlushTimer);
  clsFlushTimer = window.setTimeout(() => {
    clsFlushTimer = 0;
    flushCls();
  }, CLS_FLUSH_DELAY_MS);
}

/**
 * 把一次非输入引起的布局位移累加到当前页。
 * 还没有路由时先攒着，进入第一页再记；已在页面上则稍后写入，不用等离开。
 */
export function applyLayoutShift(value: number): void {
  if (value <= 0) return;
  if (!clsRoute) {
    clsBeforeRoute += value;
    return;
  }
  clsValue += value;
  scheduleClsFlush();
}

function rememberRequestTtfb(template: string, since: number): boolean {
  if (typeof performance === 'undefined') return false;
  const value = resourceTtfb(
    performance.getEntriesByType('resource') as PerformanceResourceTiming[],
    since,
  );
  if (value == null) return false;
  appendPageSample({ route: template, metric: 'TTFB', value, at: Date.now() });
  return true;
}

function watchLateContent(template: string, since: number, token: number, area: number): void {
  const root = document.querySelector('main');
  if (!root) return;
  let best = area;
  const images = [...root.querySelectorAll('img')];
  const consider = (image: HTMLImageElement) => {
    if (token !== generation) return;
    const next = boxArea(image);
    if (next <= best) return;
    best = next;
    upsertRecentPageSample({
      route: template,
      metric: 'LCP',
      value: Math.max(0, performance.now() - since),
      at: Date.now(),
    });
  };
  images.forEach((image) => {
    if (image.complete) return;
    image.addEventListener('load', () => consider(image), { once: true });
  });
}

/** 布局位移按当前路由累加。整页刷新和站内跳转都走这里，不再把整次访问的累计值记到最后一页。 */
export function startSpaVitals(): void {
  if (observing || typeof PerformanceObserver === 'undefined') return;
  observing = true;
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
      if (shift.hadRecentInput) return;
      applyLayoutShift(shift.value ?? 0);
    });
  });
  try {
    observer.observe({ type: 'layout-shift', buffered: true });
  } catch {
    observing = false;
  }
}

/** 离开上一页时先收口它的 CLS，再从 0 开始记这一页。 */
export function beginSpaRoute(pathname: string): void {
  generation += 1;
  window.clearTimeout(lateTimer);
  window.clearTimeout(clsFlushTimer);
  clsFlushTimer = 0;
  flushCls();
  clsRoute = matchPageTemplate(pathname);
  clsValue = clsRoute ? clsBeforeRoute : 0;
  clsBeforeRoute = 0;
}

/**
 * 页面提交后记下这一跳的画面时间。
 * 第一次整页加载仍交给 web-vitals，这里只补站内跳转，避免同一页记两套。
 */
export function settleSpaRoute(pathname: string, since: number, soft: boolean): void {
  const template = matchPageTemplate(pathname);
  window.clearTimeout(clsFlushTimer);
  clsFlushTimer = 0;
  flushCls();
  if (!soft || !template) return;
  const token = generation;
  const elapsed = Math.max(0, performance.now() - since);
  const area = largestInMain();
  if (area > 0) {
    appendPageSample({ route: template, metric: 'FCP', value: elapsed, at: Date.now() });
    appendPageSample({ route: template, metric: 'LCP', value: elapsed, at: Date.now() });
    watchLateContent(template, since, token, area);
  }
  if (rememberRequestTtfb(template, since)) return;
  lateTimer = window.setTimeout(() => {
    if (token !== generation) return;
    rememberRequestTtfb(template, since);
  }, 1500);
}
