import React from 'react';
import PerfTip, { ScoreTipPanel } from '@/components/perf/PerfTip';
import { scoreTipText, type ScoreTip } from '@/utils/perf/score';

/** 分数可悬停。弹层里列出权重和这次的算式。 */
const ScoreValue: React.FC<{
  value: number | null;
  tip: ScoreTip;
  className?: string;
  style?: React.CSSProperties;
}> = ({ value, tip, className = 'ph-perf-score', style }) => (
  <PerfTip title={<ScoreTipPanel tip={tip} />}>
    <button type="button" className={className} style={style} aria-label={scoreTipText(tip)}>
      {value ?? '—'}
    </button>
  </PerfTip>
);

export default ScoreValue;
