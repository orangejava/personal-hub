import { onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { matchPageTemplate } from '@/utils/perf/routeTemplate';
import { startSpaVitals } from '@/utils/perf/spaVitals';
import {
  appendPageSample,
  latestVitalSamples,
  type PageMetricName,
  upsertRecentPageSample,
} from '@/utils/perf/store';

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
      reportOnRoute(
        'INP',
        metric.value,
        matchPageTemplate(window.location.pathname),
        true,
      ),
    { reportAllChanges: true },
  );
  installBeacon();
}

/**
 * 同一次文档加载里，每个路由只占一个名额。
 * 藏起又打开再藏起不应把同一次 LCP 再记一笔；换到另一个路由仍然可以上报。
 *
 * @param sent 这次文档加载已经成功排队的路由
 * @param route 当前页面模板
 * @returns 这次可以上报时为 true，并先占住名额
 */
export function claimVitalBeacon(sent: Set<string>, route: string): boolean {
  if (sent.has(route)) return false;
  sent.add(route);
  return true;
}

/** 同一会话保留随机分位，而非旧比例下的布尔结果；改成 0%/100% 后刷新即可生效。 */
export function sampleSession(
  rate: number,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  random = Math.random,
): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  const key = 'ph.perf.sample.seed';
  try {
    const raw = storage.getItem(key);
    const saved = raw === null ? Number.NaN : Number(raw);
    const seed =
      Number.isFinite(saved) && saved >= 0 && saved < 1 ? saved : random();
    storage.setItem(key, String(seed));
    return seed < rate;
  } catch {
    return random() < rate;
  }
}

/**
 * 页面隐藏时按抽样把本页指标交给 sendBeacon。失败不提示，本机面板照常。
 * 抽样结果记在这次浏览里；配置未返回时不抽签，避免后台 0% 被默认值覆盖。
 */
function installBeacon(): void {
  let sampleRate: number | null = null;
  let decided = false;
  let sampled = false;
  const sentRoutes = new Set<string>();

  void fetch('/api/v1/metrics/sampling')
    .then((response) => (response.ok ? response.json() : null))
    .then((body: unknown) => {
      const data =
        body && typeof body === 'object' && 'data' in body
          ? (body as { data?: unknown }).data
          : body;
      const rate =
        data && typeof data === 'object' && 'sampleRate' in data
          ? Number((data as { sampleRate?: unknown }).sampleRate)
          : Number.NaN;
      if (Number.isFinite(rate) && rate >= 0 && rate <= 1) sampleRate = rate;
    })
    .catch(() => undefined);

  const allow = () => {
    if (sampleRate === null) return false;
    if (decided) return sampled;
    decided = true;
    try {
      sampled = sampleSession(sampleRate, sessionStorage);
    } catch {
      sampled = Math.random() < sampleRate;
    }
    return sampled;
  };

  const send = () => {
    if (!allow() || typeof navigator.sendBeacon !== 'function') return;
    const route = matchPageTemplate(window.location.pathname);
    if (!route) return;
    const samples = latestVitalSamples(route);
    if (samples.length === 0 || !claimVitalBeacon(sentRoutes, route)) return;
    const blob = new Blob([JSON.stringify({ route, samples })], {
      type: 'application/json',
    });
    // 浏览器拒收时把名额还回去，下次隐藏还能再试。
    if (!navigator.sendBeacon('/api/v1/metrics/web-vitals', blob))
      sentRoutes.delete(route);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send();
  });
  window.addEventListener('pagehide', send);
}
