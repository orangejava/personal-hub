import type { MetricTip } from '@/utils/perf/metricTips';
import {
  type MetricThreshold,
  type MetricTier,
  tierFor,
} from '@/utils/perf/score';

/** 通过 / 未通过 / 这项在该页不适用。 */
export type LabCheck = 'pass' | 'fail' | 'na';

export type LabValue = number | LabCheck;

/**
 * 实验室指标。
 * 前五项是原来的性能分和四项时间，后面是同一份报告里其余有读数或有结论的项。
 */
export type LabMetricId =
  | 'score'
  | 'fcp'
  | 'lcp'
  | 'cls'
  | 'tbt'
  | 'si'
  | 'tti'
  | 'fid'
  | 'ttfb'
  | 'mainThread'
  | 'bootup'
  | 'serverLatency'
  | 'rtt'
  | 'totalKib'
  | 'unusedJs'
  | 'unusedCss'
  | 'unminCss'
  | 'unminJs'
  | 'legacyJs'
  | 'modernHttp'
  | 'renderBlocking'
  | 'redirectMs'
  | 'docLatency'
  | 'shifts'
  | 'longTasks'
  | 'animations'
  | 'a11y'
  | 'bp'
  | 'seo'
  | 'insecure'
  | 'httpsRedirect'
  | 'console'
  | 'sourceMap'
  | 'contrast'
  | 'htmlLang'
  | 'formLabel'
  | 'viewport'
  | 'robots'
  | 'netTree'
  | 'clsCause'
  | 'reflow';

export interface LabRow {
  page: string;
  device: string;
  /** 缺键表示这一轮原始报告还没录入，页面显示「—」。 */
  values: Partial<Record<LabMetricId, LabValue>>;
}

export interface LabSnapshot {
  measuredOn: string;
  /** 这一轮开测时线上是什么。 */
  condition: string;
  /** 这一轮测完仍然值得做的事。 */
  pending: string;
  /** 表以外、这一轮值得先读的数字。 */
  measured: string;
  rows: LabRow[];
}

type LabKind =
  | { kind: 'score' }
  | { kind: 'ms'; threshold: MetricThreshold }
  | { kind: 'cls' }
  | { kind: 'kib'; threshold: MetricThreshold }
  | { kind: 'count'; threshold: MetricThreshold }
  | { kind: 'countAlert' }
  | { kind: 'check' };

export interface LabMetricColumn {
  id: LabMetricId;
  label: string;
  tip: MetricTip;
  format: (value: LabValue) => string;
  /** 没有档位时不加颜色标签，避免诊断次数被涂成良好或差。 */
  tier: (value: LabValue) => MetricTier | 'unknown' | null;
}

const SCORE_TIP_RANGE = '良好 ≥ 90，50–89 待改进，低于 50 差';
const TBT_THRESHOLD = { good: 200, poor: 600 };
const CLS_THRESHOLD = { good: 0.1, poor: 0.25 };

function scoreTier(score: number): MetricTier {
  if (score >= 90) return 'good';
  if (score >= 50) return 'needs-improvement';
  return 'poor';
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

function formatCheck(value: LabCheck): string {
  if (value === 'pass') return '通过';
  if (value === 'fail') return '未通过';
  return '不适用';
}

function checkTier(value: LabCheck): MetricTier | 'unknown' {
  if (value === 'pass') return 'good';
  if (value === 'fail') return 'poor';
  return 'unknown';
}

function column(
  id: LabMetricId,
  label: string,
  tip: MetricTip,
  spec: LabKind,
): LabMetricColumn {
  return {
    id,
    label,
    tip,
    format: (value) => {
      if (value === 'na' && spec.kind !== 'check') return formatCheck('na');
      if (spec.kind === 'check') return formatCheck(value as LabCheck);
      if (spec.kind === 'ms') return formatMs(value as number);
      if (spec.kind === 'cls') return (value as number).toFixed(3);
      if (spec.kind === 'kib') return `${value as number} KiB`;
      return String(value);
    },
    tier: (value) => {
      if (value === 'na' && spec.kind !== 'check') return 'unknown';
      if (spec.kind === 'check') return checkTier(value as LabCheck);
      if (spec.kind === 'score') return scoreTier(value as number);
      if (spec.kind === 'cls') return tierFor(value as number, CLS_THRESHOLD);
      if (spec.kind === 'countAlert')
        return (value as number) > 0 ? 'poor' : 'good';
      return tierFor(value as number, spec.threshold);
    },
  };
}

/** 页面列不进指标列，表头仍要有说明。格内左为桌面，右为手机。 */
export const LAB_LEAD_TIPS = {
  page: {
    abbr: '页面',
    title: '被测页面',
    body: '生产站四个入口：首页、内容中心、小册章节、AI 对话。同一页一行，格内左为桌面、右为手机。',
  },
} as const satisfies Record<string, MetricTip>;

/** 列顺序固定：性能分和四项时间在前，其余指标接在后面，靠横向滚动查看。 */
export const LAB_COLUMNS: LabMetricColumn[] = [
  column(
    'score',
    '性能分',
    {
      abbr: '分',
      title: 'Lighthouse 性能分',
      body: '实验室性能总分，不是本机综合分，也不含无障碍、最佳实践和 SEO。',
      range: SCORE_TIP_RANGE,
    },
    { kind: 'score' },
  ),
  column(
    'fcp',
    'FCP',
    {
      abbr: 'FCP',
      title: '首次内容绘制',
      body: '第一块内容出现的时间。',
      range: '良好 ≤ 1.8 s，差 > 3 s',
    },
    { kind: 'ms', threshold: { good: 1800, poor: 3000 } },
  ),
  column(
    'lcp',
    'LCP',
    {
      abbr: 'LCP',
      title: '最大内容绘制',
      body: '主内容出现的时间。',
      range: '良好 ≤ 2.5 s，差 > 4 s',
    },
    { kind: 'ms', threshold: { good: 2500, poor: 4000 } },
  ),
  column(
    'cls',
    'CLS',
    {
      abbr: 'CLS',
      title: '累计布局偏移',
      body: '画面跳动的程度，越小越稳。',
      range: '良好 ≤ 0.1，差 > 0.25',
    },
    { kind: 'cls' },
  ),
  column(
    'tbt',
    'TBT',
    {
      abbr: 'TBT',
      title: '总阻塞时间',
      body: '主线程被长任务堵住、点击暂时没有响应的累计时间。',
      range: '良好 ≤ 200 ms，差 > 600 ms',
    },
    { kind: 'ms', threshold: TBT_THRESHOLD },
  ),
  column(
    'si',
    'SI',
    {
      abbr: 'SI',
      title: 'Speed Index',
      body: '页面内容逐渐画出来的速度。和 FCP、LCP 相关，但不等于其中某一项。',
      range: '良好 ≤ 3.4 s，差 > 5.8 s',
    },
    { kind: 'ms', threshold: { good: 3400, poor: 5800 } },
  ),
  column(
    'tti',
    'TTI',
    {
      abbr: 'TTI',
      title: '可交互时间',
      body: '主内容出现并且主线程安静下来、可以稳定响应输入的时间。',
      range: '良好 ≤ 3.8 s，差 > 7.3 s',
    },
    { kind: 'ms', threshold: { good: 3800, poor: 7300 } },
  ),
  column(
    'fid',
    'FID',
    {
      abbr: 'FID',
      title: '输入延迟预估',
      body: 'Lighthouse 的 Max Potential FID，按最长主线程任务估算第一次输入要等多久。',
      range: '良好 ≤ 100 ms，差 > 300 ms',
    },
    { kind: 'ms', threshold: { good: 100, poor: 300 } },
  ),
  column(
    'ttfb',
    'TTFB',
    {
      abbr: 'TTFB',
      title: '文档响应',
      body: 'HTML 文档本身的服务器响应时间，不是接口耗时。',
      range: '良好 ≤ 800 ms，差 > 1.8 s',
    },
    { kind: 'ms', threshold: { good: 800, poor: 1800 } },
  ),
  column(
    'mainThread',
    '主线程',
    {
      abbr: '主线程',
      title: '主线程工作',
      body: '加载期间主线程忙碌的总时间。手机端偏长时，LCP 往往会一起变长。',
      range: '良好 ≤ 2 s，差 > 4 s',
    },
    { kind: 'ms', threshold: { good: 2000, poor: 4000 } },
  ),
  column(
    'bootup',
    '脚本执行',
    {
      abbr: '脚本',
      title: 'JavaScript 执行',
      body: '脚本解析、编译和执行占用的时间，是主线程工作里的主要部分。',
      range: '良好 ≤ 1 s，差 > 1.5 s',
    },
    { kind: 'ms', threshold: { good: 1000, poor: 1500 } },
  ),
  column(
    'serverLatency',
    '后端延迟',
    {
      abbr: '后端',
      title: '服务器后端延迟',
      body: 'Lighthouse 汇总的服务器延迟，含文档和静态资源。',
      range: '良好 ≤ 100 ms，差 > 500 ms',
    },
    { kind: 'ms', threshold: { good: 100, poor: 500 } },
  ),
  column(
    'rtt',
    '往返',
    {
      abbr: '往返',
      title: '网络往返时间',
      body: '实验室环境里这项经常接近 0，不能当成线上用户的网络延迟。',
      range: '良好 ≤ 100 ms，差 > 300 ms',
    },
    { kind: 'ms', threshold: { good: 100, poor: 300 } },
  ),
  column(
    'totalKib',
    '整页体积',
    {
      abbr: '整页',
      title: '整页传输体积',
      body: '这次加载全部请求的传输大小。分档按本站体积划分，Lighthouse 对这项本身判为通过。',
      range: '本站对照：≤ 800 KiB 较小，> 1000 KiB 偏大',
    },
    { kind: 'kib', threshold: { good: 800, poor: 1000 } },
  ),
  column(
    'unusedJs',
    '未使用 JS',
    {
      abbr: 'JS',
      title: '未使用的 JavaScript',
      body: '加载了但这次导航没有执行到的脚本，是估算还能减掉的体积。',
      range: '0 为良好，超过 20 KiB 为差',
    },
    { kind: 'kib', threshold: { good: 0, poor: 20 } },
  ),
  column(
    'unusedCss',
    '未使用 CSS',
    {
      abbr: 'CSS',
      title: '未使用的 CSS',
      body: '下载了但没有用到的样式，是估算还能减掉的体积。',
      range: '0 为良好，超过 20 KiB 为差',
    },
    { kind: 'kib', threshold: { good: 0, poor: 20 } },
  ),
  column(
    'unminCss',
    '未压缩 CSS',
    {
      abbr: 'CSS',
      title: '未压缩的 CSS',
      body: '样式还没做压缩时，估算还能减掉的体积。',
      range: '0 为良好，超过 20 KiB 为差',
    },
    { kind: 'kib', threshold: { good: 0, poor: 20 } },
  ),
  column(
    'unminJs',
    '未压缩 JS',
    {
      abbr: 'JS',
      title: '未压缩的 JavaScript',
      body: '脚本还没做压缩时，估算还能减掉的体积。这几份报告里该项为 0。',
      range: '0 为良好，超过 20 KiB 为差',
    },
    { kind: 'kib', threshold: { good: 0, poor: 20 } },
  ),
  column(
    'legacyJs',
    '旧版 JS',
    {
      abbr: '旧版',
      title: '旧版 JavaScript',
      body: '为旧浏览器保留的语法转换，估算还能减掉的体积。',
      range: '0 为良好，超过 20 KiB 为差',
    },
    { kind: 'kib', threshold: { good: 0, poor: 20 } },
  ),
  column(
    'modernHttp',
    '现代 HTTP',
    {
      abbr: 'HTTP',
      title: '现代 HTTP',
      body: '改用 HTTP/2 等方式后，估算还能缩短的加载时间，不是这次测到的实际耗时。',
      range: '0 为良好，超过 200 ms 为差',
    },
    { kind: 'ms', threshold: { good: 0, poor: 200 } },
  ),
  column(
    'renderBlocking',
    '渲染阻塞',
    {
      abbr: '阻塞',
      title: '渲染阻塞请求',
      body: '挡住首次绘制的样式或脚本，估算推迟了首次内容绘制多久。',
      range: '0 为良好，超过 200 ms 为差',
    },
    { kind: 'ms', threshold: { good: 0, poor: 200 } },
  ),
  column(
    'redirectMs',
    '重定向',
    {
      abbr: '重定向',
      title: '多次重定向',
      body: '打开页面前多出来的跳转耗时。0 表示没有多余跳转。',
      range: '0 为良好，超过 200 ms 为差',
    },
    { kind: 'ms', threshold: { good: 0, poor: 200 } },
  ),
  column(
    'docLatency',
    '文档延迟',
    {
      abbr: '文档',
      title: '文档请求延迟',
      body: 'HTML 文档请求上估算还能缩短的时间。0 表示这项没有给出可节省量。',
      range: '0 为良好，超过 200 ms 为差',
    },
    { kind: 'ms', threshold: { good: 0, poor: 200 } },
  ),
  column(
    'shifts',
    '偏移次数',
    {
      abbr: '次数',
      title: '布局偏移次数',
      body: '加载过程中发生位移的次数。幅度看 CLS。',
      range: '良好 ≤ 1 次，差 > 5 次',
    },
    { kind: 'count', threshold: { good: 1, poor: 5 } },
  ),
  column(
    'longTasks',
    '长任务',
    {
      abbr: '长任务',
      title: '长任务条数',
      body: '主线程上超过 50 ms 的任务条数。堵住输入的总时间看 TBT。',
      range: '良好 ≤ 2 条，差 > 5 条',
    },
    { kind: 'count', threshold: { good: 2, poor: 5 } },
  ),
  column(
    'animations',
    '动画',
    {
      abbr: '动画',
      title: '未合成动画',
      body: '没有走合成器、可能增加绘制成本的动画元素个数。',
      range: '良好 ≤ 3 个，差 > 8 个',
    },
    { kind: 'count', threshold: { good: 3, poor: 8 } },
  ),
  column(
    'a11y',
    '无障碍',
    {
      abbr: '无障碍',
      title: '无障碍分',
      body: 'Lighthouse 无障碍类别分。对比度、表单标签、页面语言都会算进这一分。',
      range: SCORE_TIP_RANGE,
    },
    { kind: 'score' },
  ),
  column(
    'bp',
    '最佳实践',
    {
      abbr: '实践',
      title: '最佳实践分',
      body: 'HTTPS、控制台错误、源映射等检查的类别分。',
      range: SCORE_TIP_RANGE,
    },
    { kind: 'score' },
  ),
  column(
    'seo',
    'SEO',
    {
      abbr: 'SEO',
      title: 'SEO 分',
      body: '抓取、描述、robots.txt 等检查的类别分。',
      range: SCORE_TIP_RANGE,
    },
    { kind: 'score' },
  ),
  column(
    'insecure',
    '不安全请求',
    {
      abbr: 'HTTP',
      title: '不安全请求',
      body: '仍通过 HTTP 发出的请求条数。有一条就算未通过。',
    },
    { kind: 'countAlert' },
  ),
  column(
    'httpsRedirect',
    'HTTPS 跳转',
    {
      abbr: '跳转',
      title: 'HTTP 跳到 HTTPS',
      body: '是否把 HTTP 访问重定向到 HTTPS。',
    },
    { kind: 'check' },
  ),
  column(
    'console',
    '控制台',
    {
      abbr: '控制台',
      title: '控制台错误',
      body: '加载过程中是否记录了浏览器错误。',
    },
    { kind: 'check' },
  ),
  column(
    'sourceMap',
    '源映射',
    {
      abbr: '映射',
      title: '源代码映射',
      body: '体积较大的第一方脚本是否提供 source map。缺少时生产排障会更难。',
    },
    { kind: 'check' },
  ),
  column(
    'contrast',
    '对比度',
    {
      abbr: '对比度',
      title: '文字对比度',
      body: '前景色和背景色是否达到可读对比度。',
    },
    { kind: 'check' },
  ),
  column(
    'htmlLang',
    '页面语言',
    {
      abbr: 'lang',
      title: '页面语言',
      body: '`<html>` 是否带有 lang 属性。',
    },
    { kind: 'check' },
  ),
  column(
    'formLabel',
    '表单标签',
    {
      abbr: '表单',
      title: '表单标签',
      body: '表单控件是否有关联标签。页面上没有表单时为不适用。',
    },
    { kind: 'check' },
  ),
  column(
    'viewport',
    '视口',
    {
      abbr: '视口',
      title: '视口缩放',
      body: '是否禁止用户缩放，或把最大缩放限制在 5 倍以下。',
    },
    { kind: 'check' },
  ),
  column(
    'robots',
    'robots',
    {
      abbr: 'robots',
      title: 'robots.txt',
      body: 'robots.txt 里的错误条数。有错误则这项未通过。',
    },
    { kind: 'countAlert' },
  ),
  column(
    'netTree',
    '网络依赖',
    {
      abbr: '依赖',
      title: '网络依赖关系',
      body: '关键请求是否串成过长的依赖链。这项只有通过或未通过。',
    },
    { kind: 'check' },
  ),
  column(
    'clsCause',
    '偏移原因',
    {
      abbr: '原因',
      title: '布局偏移原因',
      body: 'Lighthouse 是否指出了造成明显位移的元素。',
    },
    { kind: 'check' },
  ),
  column(
    'reflow',
    '强制重排',
    {
      abbr: '重排',
      title: '强制自动重排',
      body: '是否存在会迫使浏览器同步计算布局的脚本。',
    },
    { kind: 'check' },
  ),
];

function row(page: string, device: string, values: LabRow['values']): LabRow {
  return { page, device, values };
}

/** 10 月 10 日八份报告里相同的检查。 */
const OCT10_COMMON = {
  rtt: 0,
  unminCss: 0,
  unminJs: 0,
  legacyJs: 49,
  httpsRedirect: 'fail',
  console: 'fail',
  sourceMap: 'fail',
  htmlLang: 'fail',
  viewport: 'fail',
  robots: 16,
  netTree: 'fail',
  bp: 74,
  seo: 91,
} as const satisfies Partial<Record<LabMetricId, LabValue>>;

/** 10 月 14 日八份报告里相同的检查。 */
const OCT14_COMMON = {
  rtt: 0,
  unminCss: 4,
  unminJs: 0,
  legacyJs: 15,
  httpsRedirect: 'fail',
  console: 'fail',
  sourceMap: 'fail',
  htmlLang: 'fail',
  viewport: 'fail',
  robots: 16,
  netTree: 'fail',
  bp: 74,
  seo: 91,
} as const satisfies Partial<Record<LabMetricId, LabValue>>;

/** 生产站实验室记录。新的一轮按日期接在数组后面。时间是毫秒，体积是 KiB，CLS 无单位。 */
export const LAB_SNAPSHOTS: LabSnapshot[] = [
  {
    measuredOn: '2026年10月10日',
    condition:
      '本轮为 gzip 与哈希资源一年缓存上线前的生产站。入口脚本按未压缩体积传输，约 1.84 MB。构建侧已包含 React 生产构建与 Umi 按路由拆包。',
    pending:
      '静态资源尚未启用 Nginx gzip，带哈希的脚本、样式、字体和图片也没有长期缓存。未使用 JavaScript 约 1,166–1,553 KiB。手机端 LCP 为 13.3–20.2 s，主线程 2.6–3.6 s。全站仍为 HTTP。对比度仅首页手机通过。',
    measured:
      '入口传输约 1.84 MB，与未压缩体积相同。整页传输：首页 2,279 KiB，内容中心 2,187 KiB，AI 对话 2,826 KiB，小册章节 3,496 KiB。性能分与其余指标见下表，左为桌面，右为手机。',
    rows: [
      row('首页', '桌面', {
        ...OCT10_COMMON,
        score: 71,
        fcp: 1959,
        lcp: 2566,
        cls: 0,
        tbt: 47,
        si: 3851,
        tti: 2566,
        fid: 97,
        ttfb: 26,
        mainThread: 673,
        bootup: 400,
        serverLatency: 41,
        totalKib: 2279,
        unusedJs: 1314,
        unusedCss: 16,
        modernHttp: 440,
        renderBlocking: 80,
        redirectMs: 0,
        docLatency: 0,
        shifts: 'na',
        longTasks: 1,
        animations: 2,
        a11y: 83,
        insecure: 17,
        contrast: 'fail',
        formLabel: 'na',
        clsCause: 'pass',
        reflow: 'fail',
      }),
      row('首页', '手机', {
        ...OCT10_COMMON,
        score: 48,
        fcp: 10796,
        lcp: 13583,
        cls: 0,
        tbt: 321,
        si: 11257,
        tti: 13583,
        fid: 353,
        ttfb: 63,
        mainThread: 2584,
        bootup: 1578,
        serverLatency: 47,
        totalKib: 2279,
        unusedJs: 1320,
        unusedCss: 16,
        modernHttp: 1080,
        renderBlocking: 600,
        redirectMs: 0,
        docLatency: 0,
        shifts: 1,
        longTasks: 4,
        animations: 2,
        a11y: 88,
        insecure: 17,
        contrast: 'pass',
        formLabel: 'na',
        clsCause: 'pass',
        reflow: 'pass',
      }),
      row('内容中心', '桌面', {
        ...OCT10_COMMON,
        score: 71,
        fcp: 1970,
        lcp: 2489,
        cls: 0,
        tbt: 47,
        si: 3872,
        tti: 2490,
        fid: 97,
        ttfb: 22,
        mainThread: 780,
        bootup: 466,
        serverLatency: 24,
        totalKib: 2187,
        unusedJs: 1166,
        unusedCss: 0,
        modernHttp: 0,
        renderBlocking: 80,
        redirectMs: 184,
        docLatency: 20,
        shifts: 'na',
        longTasks: 1,
        animations: 14,
        a11y: 78,
        insecure: 23,
        contrast: 'fail',
        formLabel: 'fail',
        clsCause: 'pass',
        reflow: 'pass',
      }),
      row('内容中心', '手机', {
        ...OCT10_COMMON,
        score: 43,
        fcp: 10811,
        lcp: 13253,
        cls: 0,
        tbt: 487,
        si: 13219,
        tti: 13255,
        fid: 403,
        ttfb: 798,
        mainThread: 3256,
        bootup: 1936,
        serverLatency: 45,
        totalKib: 2187,
        unusedJs: 1165,
        unusedCss: 0,
        modernHttp: 1480,
        renderBlocking: 450,
        redirectMs: 0,
        docLatency: 700,
        shifts: 1,
        longTasks: 5,
        animations: 14,
        a11y: 78,
        insecure: 22,
        contrast: 'fail',
        formLabel: 'fail',
        clsCause: 'pass',
        reflow: 'fail',
      }),
      row('小册章节', '桌面', {
        ...OCT10_COMMON,
        score: 64,
        fcp: 1950,
        lcp: 3765,
        cls: 0,
        tbt: 39,
        si: 4755,
        tti: 3771,
        fid: 86,
        ttfb: 102,
        mainThread: 810,
        bootup: 487,
        serverLatency: 42,
        totalKib: 3496,
        unusedJs: 1420,
        unusedCss: 20,
        modernHttp: 680,
        renderBlocking: 80,
        redirectMs: 0,
        docLatency: 0,
        shifts: 'na',
        longTasks: 3,
        animations: 8,
        a11y: 83,
        insecure: 31,
        contrast: 'fail',
        formLabel: 'na',
        clsCause: 'pass',
        reflow: 'fail',
      }),
      row('小册章节', '手机', {
        ...OCT10_COMMON,
        score: 41,
        fcp: 10796,
        lcp: 20235,
        cls: 0,
        tbt: 545,
        si: 13517,
        tti: 20283,
        fid: 415,
        ttfb: 35,
        mainThread: 3645,
        bootup: 2160,
        serverLatency: 26,
        totalKib: 3496,
        unusedJs: 1420,
        unusedCss: 20,
        modernHttp: 1880,
        renderBlocking: 450,
        redirectMs: 0,
        docLatency: 0,
        shifts: 'na',
        longTasks: 8,
        animations: 10,
        a11y: 83,
        insecure: 31,
        contrast: 'fail',
        formLabel: 'na',
        clsCause: 'pass',
        reflow: 'fail',
      }),
      row('AI 对话', '桌面', {
        ...OCT10_COMMON,
        score: 64,
        fcp: 2015,
        lcp: 3056,
        cls: 0.1,
        tbt: 45,
        si: 4410,
        tti: 3056,
        fid: 89,
        ttfb: 22,
        mainThread: 966,
        bootup: 568,
        serverLatency: 37,
        totalKib: 2826,
        unusedJs: 1537,
        unusedCss: 42,
        modernHttp: 0,
        renderBlocking: 80,
        redirectMs: 197,
        docLatency: 20,
        shifts: 8,
        longTasks: 2,
        animations: 7,
        a11y: 78,
        insecure: 30,
        contrast: 'fail',
        formLabel: 'fail',
        clsCause: 'fail',
        reflow: 'fail',
      }),
      row('AI 对话', '手机', {
        ...OCT10_COMMON,
        score: 42,
        fcp: 10802,
        lcp: 16715,
        cls: 0,
        tbt: 529,
        si: 12807,
        tti: 16888,
        fid: 354,
        ttfb: 35,
        mainThread: 3552,
        bootup: 2217,
        serverLatency: 49,
        totalKib: 2826,
        unusedJs: 1553,
        unusedCss: 42,
        modernHttp: 1490,
        renderBlocking: 600,
        redirectMs: 0,
        docLatency: 0,
        shifts: 'na',
        longTasks: 6,
        animations: 3,
        a11y: 78,
        insecure: 29,
        contrast: 'fail',
        formLabel: 'fail',
        clsCause: 'pass',
        reflow: 'fail',
      }),
    ],
  },
  {
    measuredOn: '2026年10月14日',
    condition:
      '相对 10 月 10 日，入口传输体积由约 1.84 MB 降至 474 KiB，未压缩体积仍约 1.46 MB。桌面首页性能分由 71 升至 97，手机端由 48 升至 73。',
    pending:
      '未使用 JavaScript 仍有 370–460 KiB。手机端主线程耗时 3.3–4.5 s，其中脚本执行 1.7–2.3 s，对应手机端 LCP 5.6–8.3 s。渲染阻塞请求估算还可再省 40–200 ms。全站仍为 HTTP，未将 HTTP 重定向到 HTTPS；html 缺少 lang；视口禁止缩放；robots.txt 有 16 处错误；控制台存在报错；大体积脚本缺少 source map。对比度仅首页手机通过。无障碍分 78–88，最佳实践均为 74，SEO 均为 91。',
    measured:
      '整页传输：首页 698 KiB，内容中心 710 KiB，AI 对话 901 KiB，小册章节 1,096 KiB。文档响应 20–110 ms。性能分与其余指标见下表，左为桌面，右为手机。',
    rows: [
      row('首页', '桌面', {
        ...OCT14_COMMON,
        score: 97,
        fcp: 365,
        lcp: 1261,
        cls: 0.001,
        tbt: 30,
        si: 1087,
        tti: 1261,
        fid: 80,
        ttfb: 109,
        mainThread: 961,
        bootup: 449,
        serverLatency: 34,
        totalKib: 698,
        unusedJs: 399,
        unusedCss: 0,
        modernHttp: 450,
        renderBlocking: 70,
        redirectMs: 0,
        docLatency: 0,
        shifts: 1,
        longTasks: 2,
        animations: 3,
        a11y: 85,
        insecure: 20,
        contrast: 'fail',
        formLabel: 'na',
        clsCause: 'pass',
        reflow: 'pass',
      }),
      row('首页', '手机', {
        ...OCT14_COMMON,
        score: 73,
        fcp: 1156,
        lcp: 5563,
        cls: 0,
        tbt: 284,
        si: 2580,
        tti: 5563,
        fid: 333,
        ttfb: 32,
        mainThread: 3328,
        bootup: 1745,
        serverLatency: 32,
        totalKib: 698,
        unusedJs: 401,
        unusedCss: 0,
        modernHttp: 1120,
        renderBlocking: 40,
        redirectMs: 0,
        docLatency: 0,
        shifts: 1,
        longTasks: 4,
        animations: 17,
        a11y: 88,
        insecure: 20,
        contrast: 'pass',
        formLabel: 'na',
        clsCause: 'pass',
        reflow: 'pass',
      }),
      row('内容中心', '桌面', {
        ...OCT14_COMMON,
        score: 100,
        fcp: 347,
        lcp: 379,
        cls: 0.004,
        tbt: 37,
        si: 877,
        tti: 993,
        fid: 87,
        ttfb: 19,
        mainThread: 911,
        bootup: 477,
        serverLatency: 33,
        totalKib: 710,
        unusedJs: 371,
        unusedCss: 17,
        modernHttp: 130,
        renderBlocking: 80,
        redirectMs: 0,
        docLatency: 0,
        shifts: 2,
        longTasks: 1,
        animations: 1,
        a11y: 78,
        insecure: 28,
        contrast: 'fail',
        formLabel: 'fail',
        clsCause: 'pass',
        reflow: 'pass',
      }),
      row('内容中心', '手机', {
        ...OCT14_COMMON,
        score: 92,
        fcp: 985,
        lcp: 1290,
        cls: 0,
        tbt: 352,
        si: 2335,
        tti: 5106,
        fid: 325,
        ttfb: 19,
        mainThread: 3954,
        bootup: 1956,
        serverLatency: 28,
        totalKib: 710,
        unusedJs: 370,
        unusedCss: 17,
        modernHttp: 450,
        renderBlocking: 180,
        redirectMs: 0,
        docLatency: 0,
        shifts: 1,
        longTasks: 5,
        animations: 18,
        a11y: 78,
        insecure: 28,
        contrast: 'fail',
        formLabel: 'fail',
        clsCause: 'pass',
        reflow: 'pass',
      }),
      row('小册章节', '桌面', {
        ...OCT14_COMMON,
        score: 88,
        fcp: 364,
        lcp: 1877,
        cls: 0.111,
        tbt: 35,
        si: 939,
        tti: 1884,
        fid: 77,
        ttfb: 29,
        mainThread: 1001,
        bootup: 518,
        serverLatency: 40,
        totalKib: 1096,
        unusedJs: 444,
        unusedCss: 0,
        modernHttp: 680,
        renderBlocking: 90,
        redirectMs: 0,
        docLatency: 0,
        shifts: 3,
        longTasks: 2,
        animations: 1,
        a11y: 83,
        insecure: 37,
        contrast: 'fail',
        formLabel: 'na',
        clsCause: 'fail',
        reflow: 'fail',
      }),
      row('小册章节', '手机', {
        ...OCT14_COMMON,
        score: 63,
        fcp: 1133,
        lcp: 8268,
        cls: 0,
        tbt: 474,
        si: 2338,
        tti: 8293,
        fid: 319,
        ttfb: 17,
        mainThread: 3895,
        bootup: 2084,
        serverLatency: 27,
        totalKib: 1096,
        unusedJs: 444,
        unusedCss: 0,
        modernHttp: 1840,
        renderBlocking: 190,
        redirectMs: 0,
        docLatency: 0,
        shifts: 1,
        longTasks: 5,
        animations: 17,
        a11y: 83,
        insecure: 37,
        contrast: 'fail',
        formLabel: 'na',
        clsCause: 'pass',
        reflow: 'fail',
      }),
      row('AI 对话', '桌面', {
        ...OCT14_COMMON,
        score: 92,
        fcp: 374,
        lcp: 1531,
        cls: 0.095,
        tbt: 23,
        si: 968,
        tti: 1532,
        fid: 73,
        ttfb: 15,
        mainThread: 1205,
        bootup: 555,
        serverLatency: 29,
        totalKib: 901,
        unusedJs: 456,
        unusedCss: 0,
        modernHttp: 0,
        renderBlocking: 70,
        redirectMs: 189,
        docLatency: 40,
        shifts: 12,
        longTasks: 1,
        animations: 14,
        a11y: 78,
        insecure: 36,
        contrast: 'fail',
        formLabel: 'fail',
        clsCause: 'pass',
        reflow: 'pass',
      }),
      row('AI 对话', '手机', {
        ...OCT14_COMMON,
        score: 66,
        fcp: 1005,
        lcp: 6891,
        cls: 0,
        tbt: 432,
        si: 2483,
        tti: 6893,
        fid: 327,
        ttfb: 19,
        mainThread: 4533,
        bootup: 2275,
        serverLatency: 35,
        totalKib: 901,
        unusedJs: 457,
        unusedCss: 0,
        modernHttp: 1580,
        renderBlocking: 200,
        redirectMs: 0,
        docLatency: 0,
        shifts: 'na',
        longTasks: 6,
        animations: 1,
        a11y: 78,
        insecure: 35,
        contrast: 'fail',
        formLabel: 'fail',
        clsCause: 'pass',
        reflow: 'pass',
      }),
    ],
  },
];
