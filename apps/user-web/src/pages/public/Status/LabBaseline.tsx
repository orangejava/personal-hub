import React from 'react';
import PerfTip, { MetricTipPanel } from '@/components/perf/PerfTip';
import type { MetricTip } from '@/utils/perf/metricTips';
import { type MetricTier, PAGE_THRESHOLDS, tierFor } from '@/utils/perf/score';

/** Lighthouse 性能分：90 及以上良好，50–89 待改进，低于 50 差。 */
function lighthouseScoreTier(score: number): MetricTier {
  if (score >= 90) return 'good';
  if (score >= 50) return 'needs-improvement';
  return 'poor';
}

/** 总阻塞时间用 Lighthouse 的档，面板里没有这一项。 */
const TBT_THRESHOLD = { good: 200, poor: 600 };

function formatLabTime(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

interface LabRow {
  page: string;
  device: string;
  score: number;
  fcp: number;
  lcp: number;
  cls: number;
  tbt: number;
}

interface LabSnapshot {
  /** 统计日，页面上写成「2026年10月10日」。同一天只保留一轮。 */
  measuredOn: string;
  rows: LabRow[];
}

/** 生产站实验室记录。新的一轮按日期接在数组后面，时间单位是毫秒，CLS 无单位。 */
const LAB_SNAPSHOTS: LabSnapshot[] = [
  {
    measuredOn: '2026年10月10日',
    rows: [
      {
        page: '首页',
        device: '桌面',
        score: 71,
        fcp: 2000,
        lcp: 2600,
        cls: 0,
        tbt: 50,
      },
      {
        page: '首页',
        device: '手机',
        score: 48,
        fcp: 10800,
        lcp: 13600,
        cls: 0,
        tbt: 320,
      },
      {
        page: '内容中心',
        device: '桌面',
        score: 71,
        fcp: 2000,
        lcp: 2500,
        cls: 0,
        tbt: 50,
      },
      {
        page: '内容中心',
        device: '手机',
        score: 43,
        fcp: 10800,
        lcp: 13300,
        cls: 0,
        tbt: 490,
      },
      {
        page: '小册章节',
        device: '桌面',
        score: 64,
        fcp: 1900,
        lcp: 3800,
        cls: 0,
        tbt: 40,
      },
      {
        page: '小册章节',
        device: '手机',
        score: 41,
        fcp: 10800,
        lcp: 20200,
        cls: 0,
        tbt: 550,
      },
      {
        page: 'AI 对话',
        device: '桌面',
        score: 64,
        fcp: 2000,
        lcp: 3100,
        cls: 0.1,
        tbt: 50,
      },
      {
        page: 'AI 对话',
        device: '手机',
        score: 42,
        fcp: 10800,
        lcp: 16700,
        cls: 0,
        tbt: 530,
      },
    ],
  },
];

const COLUMN_TIPS: Record<string, MetricTip> = {
  score: {
    abbr: '分',
    title: 'Lighthouse 性能分',
    body: '实验室总分，不是上面本机综合分的算法。',
    range: '良好 ≥ 90，50–89 待改进，低于 50 差',
  },
  fcp: {
    abbr: 'FCP',
    title: '首次内容绘制',
    body: '第一块内容出现的时间。',
    range: '良好 ≤ 1.8 s，差 > 3 s',
  },
  lcp: {
    abbr: 'LCP',
    title: '最大内容绘制',
    body: '主内容出现的时间。',
    range: '良好 ≤ 2.5 s，差 > 4 s',
  },
  cls: {
    abbr: 'CLS',
    title: '累计布局偏移',
    body: '画面跳动的程度，越小越稳。',
    range: '良好 ≤ 0.1，差 > 0.25',
  },
  tbt: {
    abbr: 'TBT',
    title: '总阻塞时间',
    body: '主线程被长任务堵住、点了暂时没反应的时间。',
    range: '良好 ≤ 200 ms，差 > 600 ms',
  },
};

const SECTION_TIP: MetricTip = {
  abbr: '基线',
  title: '生产站测法',
  body: '测的是 www.personalhub.center。Lighthouse 会清缓存，并按慢设备估算。桌面和手机都是模拟，不是真机。上面的分数是这台浏览器的真实访问。每一轮用年月日标题隔开，新的一轮接在下面。',
  range: '2026年10月10日这一轮还没开 gzip，入口约 1.84 MB',
};

function LabHeader({ tipId }: { tipId: string }) {
  const tip = COLUMN_TIPS[tipId];
  return (
    <th>
      <PerfTip title={<MetricTipPanel tip={tip} />}>
        <button
          type="button"
          className="ph-perf-cell-label"
          aria-label={`${tip.title}。${tip.body}`}
        >
          {tip.abbr === '分' ? '性能分' : tip.abbr}
        </button>
      </PerfTip>
    </th>
  );
}

function LabValue({ tier, children }: { tier: MetricTier; children: string }) {
  return (
    <span className={`ph-perf-lab-value ph-perf-tier-${tier}`}>{children}</span>
  );
}

function LabTable({ rows }: { rows: LabRow[] }) {
  return (
    <div className="ph-perf-lab-scroll">
      <table className="ph-perf-api-table ph-perf-lab-table">
        <thead>
          <tr>
            <th>页面</th>
            <th>设备</th>
            <LabHeader tipId="score" />
            <LabHeader tipId="fcp" />
            <LabHeader tipId="lcp" />
            <LabHeader tipId="cls" />
            <LabHeader tipId="tbt" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.page}-${row.device}`}>
              <td>{row.page}</td>
              <td>{row.device}</td>
              <td>
                <LabValue tier={lighthouseScoreTier(row.score)}>
                  {String(row.score)}
                </LabValue>
              </td>
              <td>
                <LabValue tier={tierFor(row.fcp, PAGE_THRESHOLDS.FCP)}>
                  {formatLabTime(row.fcp)}
                </LabValue>
              </td>
              <td>
                <LabValue tier={tierFor(row.lcp, PAGE_THRESHOLDS.LCP)}>
                  {formatLabTime(row.lcp)}
                </LabValue>
              </td>
              <td>
                <LabValue tier={tierFor(row.cls, PAGE_THRESHOLDS.CLS)}>
                  {row.cls.toFixed(3)}
                </LabValue>
              </td>
              <td>
                <LabValue tier={tierFor(row.tbt, TBT_THRESHOLD)}>
                  {formatLabTime(row.tbt)}
                </LabValue>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 生产站实验室记录。数字写死，不跟本机采集一起变。 */
const LabBaseline: React.FC = () => (
  <section className="ph-perf-block">
    <h2 className="ph-perf-section-title">
      生产环境 Lighthouse
      <PerfTip title={<MetricTipPanel tip={SECTION_TIP} />}>
        <button
          type="button"
          className="ph-perf-cell-label"
          aria-label={`${SECTION_TIP.title}。${SECTION_TIP.body}`}
        >
          说明
        </button>
      </PerfTip>
    </h2>
    {LAB_SNAPSHOTS.map((snapshot) => (
      <div key={snapshot.measuredOn} className="ph-perf-lab-round">
        <h3 className="ph-perf-lab-date">{snapshot.measuredOn}</h3>
        <LabTable rows={snapshot.rows} />
      </div>
    ))}
  </section>
);

export default LabBaseline;
