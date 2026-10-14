import React, { useLayoutEffect, useRef, useState } from 'react';
import PerfTip, { MetricTipPanel } from '@/components/perf/PerfTip';
import type { MetricTip } from '@/utils/perf/metricTips';
import type { MetricTier } from '@/utils/perf/score';
import {
  LAB_COLUMNS,
  LAB_LEAD_TIPS,
  LAB_SNAPSHOTS,
  type LabMetricColumn,
  type LabRow,
  type LabSnapshot,
} from './labBaselineData';

const SECTION_TIP: MetricTip = {
  abbr: '基线',
  title: '生产站测法',
  body: '测 www.personalhub.center。会清缓存，桌面和手机都是模拟。',
  range:
    '每个数字格左为桌面，右为手机。向右滚动查看其余指标。没有录入的一侧为 —。',
};

const LAB_NOTE_FIELDS = [
  ['condition', '测试条件'],
  ['pending', '待优化'],
  ['measured', '实测摘要'],
] as const;

/** 同一页的桌面、手机合成一行。数据里仍按设备分条，方便以后补某一侧。 */
function pairByPage(
  rows: LabRow[],
): Array<{ page: string; desktop: LabRow; mobile: LabRow }> {
  const pairs: Array<{ page: string; desktop: LabRow; mobile: LabRow }> = [];
  for (const row of rows) {
    const current = pairs.find((item) => item.page === row.page);
    if (!current) {
      pairs.push({ page: row.page, desktop: row, mobile: row });
      continue;
    }
    if (row.device === '手机') current.mobile = row;
    else current.desktop = row;
  }
  return pairs;
}

function TipButton({ tip, label }: { tip: MetricTip; label: string }) {
  return (
    <PerfTip title={<MetricTipPanel tip={tip} />}>
      <button
        type="button"
        className="ph-perf-cell-label"
        aria-label={`${tip.title}。${tip.body}`}
      >
        {label}
      </button>
    </PerfTip>
  );
}

function LabValue({
  tier,
  children,
}: {
  tier: MetricTier | 'unknown' | null;
  children: string;
}) {
  if (!tier) return <span className="ph-perf-lab-plain">{children}</span>;
  return (
    <span className={`ph-perf-lab-value ph-perf-tier-${tier}`}>{children}</span>
  );
}

function MetricCell({ column, row }: { column: LabMetricColumn; row: LabRow }) {
  const value = row.values[column.id];
  if (value === undefined)
    return <span className="ph-perf-lab-missing">—</span>;
  return <LabValue tier={column.tier(value)}>{column.format(value)}</LabValue>;
}

function PairCell({
  column,
  desktop,
  mobile,
}: {
  column: LabMetricColumn;
  desktop: LabRow;
  mobile: LabRow;
}) {
  return (
    <span className="ph-perf-lab-pair">
      <MetricCell column={column} row={desktop} />
      <span className="ph-perf-lab-pair-sep" aria-hidden="true">
        /
      </span>
      <MetricCell column={column} row={mobile} />
    </span>
  );
}

function LabTable({ rows }: { rows: LabRow[] }) {
  const pages = pairByPage(rows);
  return (
    <div className="ph-perf-lab-scroll">
      <table className="ph-perf-api-table ph-perf-lab-table">
        <thead>
          <tr>
            <th className="ph-perf-lab-sticky is-page">
              <TipButton tip={LAB_LEAD_TIPS.page} label="页面" />
            </th>
            {LAB_COLUMNS.map((column) => (
              <th key={column.id}>
                <TipButton tip={column.tip} label={column.label} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.page}>
              <td className="ph-perf-lab-sticky is-page">{page.page}</td>
              {LAB_COLUMNS.map((column) => (
                <td key={column.id}>
                  <PairCell
                    column={column}
                    desktop={page.desktop}
                    mobile={page.mobile}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 说明卡片。正文默认三行，超出才出现「更多」。
 * 用折叠后的 scrollHeight 判断，避免短文本也出现按钮。
 */
function LabNote({ label, text }: { label: string; text: string }) {
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;
    const measure = () => {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    // 旧浏览器和无观察器的测试环境仍可展开正文，并在窗口变化时重新测量。
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  function toggleExpanded() {
    setExpanded((open) => !open);
  }

  return (
    <section
      className={expanded ? 'ph-perf-lab-note is-open' : 'ph-perf-lab-note'}
    >
      <h4>{label}</h4>
      <p ref={bodyRef}>{text}</p>
      {overflows || expanded ? (
        <button
          type="button"
          className="ph-perf-lab-note-more"
          aria-expanded={expanded}
          onClick={toggleExpanded}
        >
          {expanded ? '收起' : '更多'}
        </button>
      ) : null}
    </section>
  );
}

function LabRound({ snapshot }: { snapshot: LabSnapshot }) {
  return (
    <div className="ph-perf-lab-round">
      <h3 className="ph-perf-lab-date">{snapshot.measuredOn}</h3>
      <div className="ph-perf-lab-notes">
        {LAB_NOTE_FIELDS.map(([key, label]) => (
          <LabNote key={key} label={label} text={snapshot[key]} />
        ))}
      </div>
      <LabTable rows={snapshot.rows} />
    </div>
  );
}

/** 生产站实验室记录。数字写死，不跟本机采集一起变。 */
const LabBaseline: React.FC = () => (
  <section className="ph-perf-block">
    <h2 className="ph-perf-section-title">
      生产环境 Lighthouse
      <TipButton tip={SECTION_TIP} label="说明" />
    </h2>
    <p className="ph-perf-kicker">
      每个数字格左为桌面，右为手机。前面仍是性能分、FCP、LCP、CLS、TBT，向右滚动查看其余指标。
    </p>
    {LAB_SNAPSHOTS.map((snapshot) => (
      <LabRound key={snapshot.measuredOn} snapshot={snapshot} />
    ))}
  </section>
);

export default LabBaseline;
