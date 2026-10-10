import React from 'react';
import PerfTip, { MetricTipPanel } from '@/components/perf/PerfTip';
import type { MetricCell } from '@/utils/perf/aggregate';
import { METRIC_TIPS } from '@/utils/perf/metricTips';

/** 按档位着色的小格子。缩写可聚焦，方便没有悬停的设备看口径。 */
const MetricCells: React.FC<{ cells: MetricCell[] }> = ({ cells }) => (
  <div className="ph-perf-cells">
    {cells.map((cell) => {
      const tip = METRIC_TIPS[cell.key];
      const label = (
        <button type="button" className="ph-perf-cell-label" aria-label={tip ? `${tip.title}。${tip.body}` : cell.label}>
          {cell.label}
        </button>
      );
      return (
        <div key={cell.key} className={`ph-perf-cell ph-perf-tier-${cell.tier}`}>
          {tip ? <PerfTip title={<MetricTipPanel tip={tip} />}>{label}</PerfTip> : label}
          <strong>{cell.display}</strong>
        </div>
      );
    })}
  </div>
);

export default MetricCells;
