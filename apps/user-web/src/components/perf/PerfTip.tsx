import { Tooltip } from 'antd';
import React from 'react';
import { usePerfAppearance } from '@/components/perf/usePerfAppearance';
import type { MetricTip } from '@/utils/perf/metricTips';
import type { ScoreTip } from '@/utils/perf/score';

/**
 * 只在上下两侧切换。贴左右边缘时水平挪进屏幕，不改垂直位置。
 * shiftX 用 true，取消箭头预留空隙，否则贴右边时仍会伸出一截。
 */
const TIP_OVERFLOW = {
  adjustY: 1 as const,
  shiftX: true,
  shiftY: false,
};

/** 提示跟站点深浅色走。位置交给 antd Tooltip。 */
const PerfTip: React.FC<{ title: React.ReactNode; children: React.ReactElement }> = ({
  title,
  children,
}) => {
  const { dark, themeStyle } = usePerfAppearance();
  const themeClass = dark ? 'ph-perf-tip-dark' : 'ph-perf-tip-light';

  return (
    <Tooltip
      title={title}
      placement="top"
      trigger={['hover', 'focus']}
      arrow={false}
      autoAdjustOverflow={TIP_OVERFLOW}
      classNames={{ root: `ph-perf-tip-root ${themeClass}`, container: 'ph-perf-tip-container' }}
      styles={{
        // 提示挂到 body，读不到面板上的变量，主色要带到弹层根节点。
        root: { maxWidth: 'calc(100vw - 16px)', ...themeStyle },
        container: { padding: 0, background: 'transparent', boxShadow: 'none', maxWidth: 'calc(100vw - 16px)' },
      }}
    >
      {children}
    </Tooltip>
  );
};

export const MetricTipPanel: React.FC<{ tip: MetricTip }> = ({ tip }) => (
  <div className="ph-perf-tip">
    <span className="ph-perf-tip-badge">{tip.abbr}</span>
    <strong>{tip.title}</strong>
    <p>{tip.body}</p>
    {tip.range ? <p className="ph-perf-tip-range">{tip.range}</p> : null}
  </div>
);

export const ScoreTipPanel: React.FC<{ tip: ScoreTip }> = ({ tip }) => (
  <div className="ph-perf-tip">
    <span className="ph-perf-tip-badge">{tip.kicker}</span>
    <p>{tip.summary}</p>
    <ul className="ph-perf-tip-rows">
      {tip.rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          <b>{row.score == null ? '不计' : row.score}</b>
          <em>×{row.weight}</em>
        </li>
      ))}
    </ul>
    <p className="ph-perf-tip-formula">{tip.formula}</p>
    <p className="ph-perf-tip-note">{tip.note}</p>
  </div>
);

export default PerfTip;
