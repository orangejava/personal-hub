import type { MetricsOverview, MetricsRange } from '@personal-hub/shared-types';
import { Button } from 'antd';
import React, { useEffect, useState } from 'react';
import PerfTip, { MetricTipPanel } from '@/components/perf/PerfTip';
import { perfPageLabel } from '@/config/pageRegistry';
import { useRequest } from '@/hooks/useRequest';
import { fetchMetricsOverview } from '@/services/metrics';
import type { MetricTip } from '@/utils/perf/metricTips';
import { type MetricTier, PAGE_THRESHOLDS, tierFor } from '@/utils/perf/score';

const PAGE_SIZE = 15;

const RANGES: { value: MetricsRange; label: string }[] = [
  { value: '24h', label: '24 小时' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
];

function formatMetric(metric: string, value: number | null): string {
  if (value == null) return '数据不足';
  if (metric === 'CLS') return value.toFixed(3);
  if (value === 120_000) return '>5 s';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

type PerfTier = MetricTier | 'unknown';

const SAMPLE_TIP: MetricTip = {
  abbr: '上报',
  title: '默认上报',
  body: '页面指标默认只抽 20% 的访问。离开页面时上报这一页的 TTFB、FCP、LCP、CLS、INP。接口不抽样，每个请求结束就记一次。',
  range: '后台改过抽样后，这里显示当前比例。没改过就是 20%。',
};

const ROLLUP_TIP: MetricTip = {
  abbr: '汇总',
  title: '何时写入数据库',
  body: '数据先进入 Redis，当前这一小时会马上出现。worker 启动后马上处理一遍，之后每 5 分钟重试一次。它只把已经结束的小时写入数据库，正在进行的这一小时仍留在 Redis。',
  range:
    'Redis 里的分钟计数保留 48 小时。worker 连续故障超过这段时间时需要人工排查。',
};

const VITAL_TIP: MetricTip = {
  abbr: '页面',
  title: '页面指标',
  body: 'p95 按这项指标着色。绿色是良好，黄色是待改进，红色是差。例如 LCP 良好不超过 2.5 秒，CLS 良好不超过 0.1。',
  range: '只包含被抽中的访问，不是全部打开次数。',
};

const HTTP_TIP: MetricTip = {
  abbr: '接口',
  title: '接口耗时',
  body: '状态按响应码着色：2xx 绿，4xx 黄，5xx 红。p95 良好不超过 300 毫秒，超过 800 毫秒为差。',
  range: '管理接口不出现。登录、刷新等认证接口合并成「认证」。',
};

const DEPLOY_TIP: MetricTip = {
  abbr: '发布',
  title: '发布标记',
  body: '服务启动时如果带了 GIT_SHA，就记一条。最新一条用强调色标出，并和它前后各 7 天的 LCP、接口 p95 对比。',
  range: '没配 GIT_SHA 时这里一直是空的。',
};

/** 抽样提示带上接口返回的当前比例，默认仍是 20%。 */
function sampleTip(rate: number): MetricTip {
  const percent = Math.round(rate * 100);
  return {
    ...SAMPLE_TIP,
    range: `当前抽样 ${percent}%。没改过后台时就是默认的 20%。`,
  };
}

function vitalTier(metric: string, value: number | null): PerfTier {
  if (value == null) return 'unknown';
  const threshold = PAGE_THRESHOLDS[metric as keyof typeof PAGE_THRESHOLDS];
  if (!threshold) return 'unknown';
  return tierFor(value, threshold);
}

function httpLatencyTier(value: number | null): PerfTier {
  if (value == null) return 'unknown';
  return tierFor(value, PAGE_THRESHOLDS.apiP95);
}

function statusTier(statusClass: string): PerfTier {
  if (statusClass === '2xx') return 'good';
  if (statusClass === '4xx' || statusClass === 'other')
    return 'needs-improvement';
  if (statusClass === '5xx') return 'poor';
  return 'unknown';
}

function spokenTip(tip: MetricTip): string {
  return [tip.title, tip.body, tip.range]
    .filter((item): item is string => Boolean(item))
    .map((part) => (part.endsWith('。') ? part : `${part}。`))
    .join('');
}

function TipButton({ tip, label }: { tip: MetricTip; label: string }) {
  const text = spokenTip(tip);
  return (
    <PerfTip title={<MetricTipPanel tip={tip} />}>
      <button type="button" className="ph-perf-cell-label" aria-label={text}>
        {label}
      </button>
    </PerfTip>
  );
}

function SectionTitle({
  mark,
  title,
  tip,
}: {
  mark: string;
  title: string;
  tip: MetricTip;
}) {
  return (
    <h2 className="ph-perf-section-title">
      <span
        className={`ph-perf-mark ph-perf-mark-${mark}`}
        aria-hidden="true"
      />
      {title}
      <TipButton tip={tip} label="说明" />
    </h2>
  );
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 超过 15 条才分页。换时间范围时回到第一页，避免停在已经没有数据的页上。
 */
function PagedRows<T>({
  rows,
  resetKey,
  children,
}: {
  rows: T[];
  resetKey: string;
  children: (slice: T[]) => React.ReactNode;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const start = (current - 1) * PAGE_SIZE;
  const showPrevious = () => setPage((value) => Math.max(1, value - 1));
  const showNext = () => setPage((value) => Math.min(pageCount, value + 1));

  return (
    <>
      {children(rows.slice(start, start + PAGE_SIZE))}
      {rows.length > PAGE_SIZE ? (
        <div className="ph-perf-pager">
          <Button size="small" disabled={current <= 1} onClick={showPrevious}>
            上一页
          </Button>
          <span className="ph-perf-muted">
            {current} / {pageCount}，共 {rows.length} 条
          </span>
          <Button
            size="small"
            disabled={current >= pageCount}
            onClick={showNext}
          >
            下一页
          </Button>
        </div>
      ) : null}
    </>
  );
}

/**
 * 全站聚合。本机分数仍由 /status 的另一支负责，这里不改首页大分数。
 */
const SiteOverview: React.FC = () => {
  const [range, setRange] = useState<MetricsRange>('24h');
  const { data, loading, error } = useRequest(
    () => fetchMetricsOverview(range),
    {
      refreshDeps: [range],
    },
  );

  return (
    <section className="ph-perf-block">
      <div className="ph-perf-filters">
        {RANGES.map((item) => (
          <Button
            key={item.value}
            size="small"
            type={range === item.value ? 'primary' : 'default'}
            onClick={() => setRange(item.value)}
          >
            {item.label}
          </Button>
        ))}
        <TipButton
          tip={data ? sampleTip(data.sampleRate) : SAMPLE_TIP}
          label="上报"
        />
        <TipButton tip={ROLLUP_TIP} label="汇总" />
      </div>
      <p className="ph-perf-kicker">
        页面指标默认上报 20% 的访问
        {data ? `，当前是 ${Math.round(data.sampleRate * 100)}%` : ''}
        。当前这一小时马上显示；已经结束的小时由 worker 每 5
        分钟尝试写入数据库。
      </p>
      {loading ? <p className="ph-perf-muted">正在读取全站数据</p> : null}
      {error ? <p className="ph-perf-missing">全站数据暂时读不到</p> : null}
      {data ? <SiteTables overview={data} range={range} /> : null}
    </section>
  );
};

function SiteTables({
  overview,
  range,
}: {
  overview: MetricsOverview;
  range: MetricsRange;
}) {
  return (
    <>
      {overview.partial ? (
        <p className="ph-perf-kicker">
          包含尚未收口的分钟数据；Redis 不可用时，暂时只显示已入库的数据
        </p>
      ) : null}
      <SectionTitle mark="vital" title="页面指标" tip={VITAL_TIP} />
      {overview.vitals.length === 0 ? (
        <p className="ph-perf-muted">还没有全站页面样本</p>
      ) : (
        <PagedRows rows={overview.vitals} resetKey={range}>
          {(rows) => (
            <div className="ph-perf-chart-scroll">
              <table className="ph-perf-site-table">
                <thead>
                  <tr>
                    <th>页面</th>
                    <th>指标</th>
                    <th>p50</th>
                    <th>p95</th>
                    <th>次数</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.route}-${row.metric}`}>
                      <td>{perfPageLabel(row.route)}</td>
                      <td>{row.metric}</td>
                      <td>{formatMetric(row.metric, row.p50)}</td>
                      <td
                        className={`ph-perf-tier-${vitalTier(row.metric, row.p95)}`}
                      >
                        {formatMetric(row.metric, row.p95)}
                      </td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PagedRows>
      )}
      <SectionTitle mark="http" title="接口" tip={HTTP_TIP} />
      {overview.http.length === 0 ? (
        <p className="ph-perf-muted">还没有全站接口样本</p>
      ) : (
        <PagedRows rows={overview.http} resetKey={range}>
          {(rows) => (
            <div className="ph-perf-chart-scroll">
              <table className="ph-perf-site-table">
                <thead>
                  <tr>
                    <th>接口</th>
                    <th>状态</th>
                    <th>p50</th>
                    <th>p95</th>
                    <th>次数</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.method}-${row.label}-${row.statusClass}`}>
                      <td>
                        {row.method} {row.label}
                      </td>
                      <td>
                        <span
                          className={`ph-perf-status-pill ph-perf-tier-${statusTier(row.statusClass)}`}
                        >
                          {row.statusClass}
                        </span>
                      </td>
                      <td>{formatMetric('http', row.p50)}</td>
                      <td
                        className={`ph-perf-tier-${httpLatencyTier(row.p95)}`}
                      >
                        {formatMetric('http', row.p95)}
                      </td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PagedRows>
      )}
      <SectionTitle mark="deploy" title="发布标记" tip={DEPLOY_TIP} />
      {overview.compare ? (
        <p className="ph-perf-kicker">
          {overview.compare.marker.gitSha.slice(0, 7)} 前后各 7 天，LCP p95{' '}
          {formatMetric('LCP', overview.compare.before.lcpP95)} →{' '}
          {formatMetric('LCP', overview.compare.after.lcpP95)}，接口 p95{' '}
          {formatMetric('http', overview.compare.before.httpP95)} →{' '}
          {formatMetric('http', overview.compare.after.httpP95)}
        </p>
      ) : (
        <p className="ph-perf-muted">
          还没有发布标记。容器设置 GIT_SHA 后，启动时会记一条。
        </p>
      )}
      {overview.deploys.length > 0 ? (
        <PagedRows rows={overview.deploys} resetKey={range}>
          {(rows) => (
            <ul className="ph-perf-deploy-list">
              {rows.map((item) => (
                <li
                  key={item.gitSha}
                  className={
                    item.gitSha === overview.deploys[0]?.gitSha
                      ? 'is-latest'
                      : undefined
                  }
                >
                  <span
                    className="ph-perf-mark ph-perf-mark-deploy"
                    aria-hidden="true"
                  />
                  {formatWhen(item.deployedAt)} {item.gitSha.slice(0, 7)}
                  {item.note ? ` ${item.note}` : ''}
                </li>
              ))}
            </ul>
          )}
        </PagedRows>
      ) : null}
    </>
  );
}

export default SiteOverview;
