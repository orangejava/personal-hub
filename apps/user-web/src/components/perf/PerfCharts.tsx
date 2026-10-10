import { Column, Line } from '@ant-design/plots';
import { Button } from 'antd';
import React, { useRef } from 'react';
import type { ChartPoint } from '@/utils/perf/aggregate';

interface PerfChartsProps {
  dark: boolean;
  lcpSeries: ChartPoint[];
  apiSeries: ChartPoint[];
  jsBundles: { name: string; kb: number }[];
}

function toggleFullscreen(node: HTMLElement | null) {
  if (!node) return;
  if (document.fullscreenElement === node) {
    void document.exitFullscreen();
    return;
  }
  void node.requestFullscreen();
}

const ChartCard: React.FC<{
  title: string;
  empty: boolean;
  children: React.ReactNode;
}> = ({ title, empty, children }) => {
  const frame = useRef<HTMLElement>(null);
  const openFullscreen = () => toggleFullscreen(frame.current);

  return (
    <article className="ph-perf-chart-card" ref={frame}>
      <div className="ph-perf-chart-head">
        <h3>{title}</h3>
        <Button size="small" onClick={openFullscreen}>
          全屏
        </Button>
      </div>
      {empty ? (
        <p className="ph-perf-muted">数据不足</p>
      ) : (
        <div className="ph-perf-chart-scroll">
          <div className="ph-perf-chart-inner">{children}</div>
        </div>
      )}
    </article>
  );
};

/** 图表库只从这里引入，由 /status 懒加载，避免进入口包。 */
const PerfCharts: React.FC<PerfChartsProps> = ({ dark, lcpSeries, apiSeries, jsBundles }) => {
  const theme = dark ? 'classicDark' : 'classic';

  return (
    <div className="ph-perf-chart-grid">
      <ChartCard title="各页面 LCP" empty={lcpSeries.length === 0}>
        <Line
          data={lcpSeries}
          xField="time"
          yField="value"
          colorField="page"
          height={260}
          theme={theme}
          legend={{ color: { position: 'top' } }}
        />
      </ChartCard>
      <ChartCard title="接口 p95" empty={apiSeries.length === 0}>
        <Line data={apiSeries} xField="time" yField="value" height={260} theme={theme} />
      </ChartCard>
      <ChartCard title="JS 分包体积" empty={jsBundles.length === 0}>
        <Column data={jsBundles} xField="name" yField="kb" height={260} theme={theme} />
      </ChartCard>
    </div>
  );
};

export default PerfCharts;
