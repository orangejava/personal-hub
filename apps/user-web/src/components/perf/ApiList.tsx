import React from 'react';
import PerfTip, { MetricTipPanel } from '@/components/perf/PerfTip';
import type { ApiRowModel } from '@/utils/perf/aggregate';
import { METRIC_TIPS } from '@/utils/perf/metricTips';

function PercentLabel({ name }: { name: 'p50' | 'p95' }) {
  const tip = METRIC_TIPS[name];
  return (
    <PerfTip title={<MetricTipPanel tip={tip} />}>
      <button type="button" className="ph-perf-cell-label" aria-label={`${tip.title}。${tip.body}`}>
        {name}
      </button>
    </PerfTip>
  );
}

function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** 手机档改成卡片，避免表格把页面撑出横向滚动。 */
const ApiList: React.FC<{ rows: ApiRowModel[]; phone: boolean }> = ({ rows, phone }) => {
  if (rows.length === 0) {
    return <p className="ph-perf-muted">这次会话还没有接口记录。</p>;
  }

  if (phone) {
    return (
      <ul className="ph-perf-api-list">
        {rows.map((row) => (
          <li key={row.name} className={`ph-perf-api-card ph-perf-tier-${row.tier}`}>
            <strong>{row.name}</strong>
            <div className="ph-perf-api-meta">
              <span>{row.count} 次</span>
              <span>
                <PercentLabel name="p50" /> {formatMs(row.p50)}
              </span>
              <span>
                <PercentLabel name="p95" /> {formatMs(row.p95)}
              </span>
              <span>错误率 {formatRate(row.errorRate)}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="ph-perf-chart-scroll">
      <table className="ph-perf-api-table">
      <thead>
        <tr>
          <th>接口</th>
          <th>次数</th>
          <th>
            <PercentLabel name="p50" />
          </th>
          <th>
            <PercentLabel name="p95" />
          </th>
          <th>错误率</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{row.count}</td>
            <td>{formatMs(row.p50)}</td>
            <td className={`ph-perf-tier-${row.tier}`}>{formatMs(row.p95)}</td>
            <td>{formatRate(row.errorRate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
};

export default ApiList;
