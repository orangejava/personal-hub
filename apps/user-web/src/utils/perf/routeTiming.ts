import { matchPageTemplate } from '@/utils/perf/routeTemplate';
import { beginSpaRoute, settleSpaRoute } from '@/utils/perf/spaVitals';
import { appendPageSample, rememberJsBundles, type JsBundleStat } from '@/utils/perf/store';

let activePath = '';
let startedAt = 0;
let pending = false;
let firstNavigation = true;

function fileName(url: string): string {
  const path = url.split('?')[0]?.split('#')[0] ?? url;
  const name = path.split('/').pop();
  return name || 'js';
}

function isScript(entry: PerformanceResourceTiming): boolean {
  return entry.initiatorType === 'script' || /\.js$/i.test(fileName(entry.name));
}

/**
 * 首屏要把已经开始下载的入口 JS 算进去；站内跳转只算这次导航新出现的脚本。
 * 缓存命中时 transferSize 为 0，改读编码体积，否则柱状图会是空的。
 */
function snapshotScripts(includeAlreadyStarted: boolean, since: number): {
  bytes: number;
  files: JsBundleStat[];
} {
  if (typeof performance === 'undefined') return { bytes: 0, files: [] };
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const files: JsBundleStat[] = [];
  let bytes = 0;

  entries.forEach((entry) => {
    if (!isScript(entry)) return;
    if (!includeAlreadyStarted && entry.startTime < since) return;
    const size = entry.transferSize || entry.encodedBodySize || entry.decodedBodySize || 0;
    const name = fileName(entry.name);
    bytes += size;
    files.push({ name, bytes: size, duration: entry.duration });
  });

  return { bytes, files };
}

/** 路径变化时开始计时。查询参数变化不重新计时。 */
export function markRouteStart(pathname: string): void {
  if (pending && pathname === activePath) return;
  activePath = pathname;
  startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  pending = true;
  beginSpaRoute(pathname);
}

/**
 * 页面提交后的下一帧结束计时。
 * 路径对不上说明又发生了新导航，这次结果丢掉，避免记到错误页面。
 */
export function markRouteEnd(pathname: string): void {
  if (!pending || pathname !== activePath) return;
  const includeAlreadyStarted = firstNavigation;
  const since = startedAt;
  const duration =
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
  pending = false;
  firstNavigation = false;

  const template = matchPageTemplate(pathname);
  const scripts = snapshotScripts(includeAlreadyStarted, since);
  if (scripts.files.length > 0) rememberJsBundles(scripts.files);
  if (!template) return;

  appendPageSample({
    route: template,
    metric: 'route',
    value: Math.max(0, duration),
    at: Date.now(),
  });
  appendPageSample({
    route: template,
    metric: 'js',
    value: scripts.bytes,
    at: Date.now(),
  });
  settleSpaRoute(pathname, since, !includeAlreadyStarted);
}
