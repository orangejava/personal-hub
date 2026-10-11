import { Link } from '@umijs/max';
import React, { useMemo } from 'react';
import { usePerfAppearance } from '@/components/perf/usePerfAppearance';
import { usePerfRevision } from '@/components/perf/usePerfRevision';
import { homeSummary, type MetricCell } from '@/utils/perf/aggregate';

const METRIC_NOTES: Record<string, string> = {
  TTFB: '服务器多久开始返回',
  FCP: '第一次看到内容',
  LCP: '最大内容多久画出来',
  CLS: '页面跳动程度',
  INP: '点击后多久有反应',
  route: '从别的页点进来后，主内容多久出现',
  js: '这次打开下载的脚本体积',
  apiP95: '本次会话里接口的 p95，不是只有首页',
};

/** 首页摘要只看本机记录里的 `/`，不把图表和接口列表搬过来。 */
const PerformanceSection: React.FC = () => {
  const revision = usePerfRevision();
  const { dark, themeStyle } = usePerfAppearance();
  const home = useMemo(() => homeSummary(), [revision]);
  const cells: MetricCell[] = home.cells;
  const score = home.score == null ? '数据不足' : String(home.score);

  return (
    <div className="ph-home-section">
      <h2>性能数据</h2>
      <p className="ph-home-section-note">
        这台浏览器记下的首页。分数按下面八项加权，没有样本的项不计入。性能页的首页卡片仍只看
        LCP、TTFB 和路由切换。
      </p>
      <div className="ph-home-perf">
        <p className="ph-home-perf-score">{score}</p>
        <ul
          className={
            dark
              ? 'ph-home-perf-metrics is-dark'
              : 'ph-home-perf-metrics is-light'
          }
          style={themeStyle}
        >
          {cells.map((cell) => (
            <li key={cell.key} className={`ph-home-perf-tier-${cell.tier}`}>
              <span>{cell.label}</span>
              <strong>{cell.sufficient ? cell.display : '数据不足'}</strong>
              <small>{METRIC_NOTES[cell.key]}</small>
            </li>
          ))}
        </ul>
      </div>
      <Link className="ph-home-perf-link" to="/status">
        查看完整面板
      </Link>
    </div>
  );
};

export default PerformanceSection;
