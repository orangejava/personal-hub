import { Button, Switch } from 'antd';
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import ApiList from '@/components/perf/ApiList';
import MetricCells from '@/components/perf/MetricCells';
import ScoreValue from '@/components/perf/ScoreValue';
import { usePerfAppearance } from '@/components/perf/usePerfAppearance';
import { usePerfRevision } from '@/components/perf/usePerfRevision';
import { PERF_PAGES } from '@/config/pageRegistry';
import { useViewportBand } from '@/hooks/useViewportBand';
import PublicLayout from '@/layouts/PublicLayout';
import { buildDashboard } from '@/utils/perf/aggregate';
import '@/components/perf/perf-panel.less';

const PerfCharts = lazy(() => import('@/components/perf/PerfCharts'));

/** 公开性能面板。数据来源一期固定为本机，筛选只影响卡片和图表。 */
const StatusPage: React.FC = () => {
  const { band } = useViewportBand();
  const appearance = usePerfAppearance();
  const revision = usePerfRevision();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selected, setSelected] = useState<string[]>(() => PERF_PAGES.map((page) => page.template));
  const dashboard = useMemo(
    () => buildDashboard(selected),
    [selected, revision, refreshTick],
  );
  const themeClass = appearance.dark ? 'ph-perf-shell ph-perf-dark' : 'ph-perf-shell ph-perf-light';

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => setRefreshTick((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  const refreshNow = () => setRefreshTick((value) => value + 1);
  const selectAll = () => setSelected(PERF_PAGES.map((page) => page.template));
  const selectNone = () => setSelected([]);
  const togglePage = (template: string) => {
    setSelected((current) =>
      current.includes(template)
        ? current.filter((item) => item !== template)
        : [...current, template],
    );
  };
  const toggleAutoRefresh = (checked: boolean) => setAutoRefresh(checked);

  return (
    <PublicLayout>
      <div className={`ph-perf-page ph-perf-stack ${themeClass}`} style={appearance.themeStyle}>
        <section className="ph-perf-block">
          <div className="ph-perf-toolbar">
            <div>
              <p className="ph-perf-kicker">全部记录，不是下面卡片的平均分</p>
              <div className="ph-perf-score-row">
                <ScoreValue value={dashboard.headlineScore} tip={dashboard.headlineTip} />
                <span className="ph-perf-source">{dashboard.sourceLabel}</span>
              </div>
              {dashboard.headlineMissing ? <p className="ph-perf-missing">数据不足</p> : null}
            </div>
            <div className="ph-perf-score-row">
              <span className="ph-perf-muted">每 60 秒刷新</span>
              <Switch checked={autoRefresh} onChange={toggleAutoRefresh} />
              <Button onClick={refreshNow}>立即刷新</Button>
            </div>
          </div>
        </section>

        <section className="ph-perf-block">
          <h2 className="ph-perf-section-title">各页面</h2>
          <p className="ph-perf-kicker">每张卡片单独看本页的 LCP、TTFB 和路由切换</p>
          <div className="ph-perf-filters">
          <Button size="small" onClick={selectAll}>
            全选
          </Button>
          <Button size="small" onClick={selectNone}>
            全不选
          </Button>
          {PERF_PAGES.map((page) => {
            const active = selected.includes(page.template);
            return (
              <Button
                key={page.template}
                size="small"
                type={active ? 'primary' : 'default'}
                onClick={() => togglePage(page.template)}
              >
                {page.label}
              </Button>
            );
          })}
        </div>

        {dashboard.pages.length === 0 ? (
          <p className="ph-perf-muted">未选择页面</p>
        ) : (
          <div className="ph-perf-page-grid">
            {dashboard.pages.map((page) => (
              <article key={page.template} className="ph-perf-card">
                <div className="ph-perf-card-head">
                  <h3>{page.label}</h3>
                  <ScoreValue value={page.score} tip={page.scoreTip} style={{ fontSize: 28 }} />
                </div>
                {page.missing ? <p className="ph-perf-missing">数据不足</p> : null}
                <MetricCells cells={page.cells} />
              </article>
            ))}
          </div>
        )}
        </section>

        <Suspense fallback={<p className="ph-perf-muted">图表加载中</p>}>
          <PerfCharts
            dark={appearance.dark}
            lcpSeries={dashboard.lcpSeries}
            apiSeries={dashboard.apiSeries}
            jsBundles={dashboard.jsBundles}
          />
        </Suspense>

        <section className="ph-perf-block">
          <h2 className="ph-perf-section-title">接口</h2>
          <p className="ph-perf-kicker">次数少时 p50 和 p95 会相同。次数多了，p95 通常更慢</p>
          <ApiList rows={dashboard.apis} phone={band === 'phone'} />
        </section>
      </div>
    </PublicLayout>
  );
};

export default StatusPage;
