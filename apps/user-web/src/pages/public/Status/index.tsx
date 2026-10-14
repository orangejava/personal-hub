import { Button, Segmented, Switch } from 'antd';
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import ApiList from '@/components/perf/ApiList';
import MetricCells from '@/components/perf/MetricCells';
import ScoreValue from '@/components/perf/ScoreValue';
import { usePerfAppearance } from '@/components/perf/usePerfAppearance';
import { usePerfRevision } from '@/components/perf/usePerfRevision';
import { PERF_PAGES } from '@/config/pageRegistry';
import { useViewportBand } from '@/hooks/useViewportBand';
import PublicLayout from '@/layouts/PublicLayout';
import { buildDashboard } from '@/utils/perf/aggregate';
import LabBaseline from './LabBaseline';
import SiteOverview from './SiteOverview';
import '@/components/perf/perf-panel.less';

const PerfCharts = lazy(() => import('@/components/perf/PerfCharts'));

type StatusSource = 'local' | 'site' | 'lab';

const SOURCE_KICKER: Record<StatusSource, string> = {
  local: '全部记录，不是下面卡片的平均分',
  site: '全站聚合，不是这台浏览器的分数',
  lab: '生产环境按日期分轮，不是这台浏览器的实时分数',
};

function sourceFromSegment(value: string | number): StatusSource {
  if (value === 'site' || value === 'lab') return value;
  return 'local';
}

/** 公开性能面板。本机看这台浏览器，全站看服务端汇总，Lighthouse 只放生产实验室记录。 */
const StatusPage: React.FC = () => {
  const { band } = useViewportBand();
  const appearance = usePerfAppearance();
  const revision = usePerfRevision();
  const [source, setSource] = useState<StatusSource>('local');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selected, setSelected] = useState<string[]>(() =>
    PERF_PAGES.map((page) => page.template),
  );
  const dashboard = useMemo(
    () => buildDashboard(selected),
    [selected, revision, refreshTick],
  );
  const themeClass = appearance.dark
    ? 'ph-perf-shell ph-perf-dark'
    : 'ph-perf-shell ph-perf-light';

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(
      () => setRefreshTick((value) => value + 1),
      60000,
    );
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
      <div
        className={`ph-perf-page ph-perf-stack ${themeClass}`}
        style={appearance.themeStyle}
      >
        <section className="ph-perf-block">
          <div className="ph-perf-toolbar">
            <div>
              <Segmented
                value={source}
                options={[
                  { label: '本机', value: 'local' },
                  { label: '全站', value: 'site' },
                  { label: 'Lighthouse', value: 'lab' },
                ]}
                onChange={(value) => setSource(sourceFromSegment(value))}
              />
              <p className="ph-perf-kicker">{SOURCE_KICKER[source]}</p>
              {source === 'local' ? (
                <div className="ph-perf-score-row">
                  <ScoreValue
                    value={dashboard.headlineScore}
                    tip={dashboard.headlineTip}
                  />
                  <span className="ph-perf-source">{dashboard.sourceLabel}</span>
                </div>
              ) : null}
              {source === 'local' && dashboard.headlineMissing ? (
                <p className="ph-perf-missing">数据不足</p>
              ) : null}
            </div>
            {source === 'local' ? (
              <div className="ph-perf-score-row">
                <span className="ph-perf-muted">每 60 秒刷新</span>
                <Switch checked={autoRefresh} onChange={toggleAutoRefresh} />
                <Button onClick={refreshNow}>立即刷新</Button>
              </div>
            ) : null}
          </div>
        </section>

        {source === 'site' ? <SiteOverview /> : null}

        {source === 'local' ? (
        <>
        <section className="ph-perf-block">
          <h2 className="ph-perf-section-title">各页面</h2>
          <p className="ph-perf-kicker">
            每张卡片单独看本页的 LCP、TTFB 和路由切换
          </p>
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
                    <ScoreValue
                      value={page.score}
                      tip={page.scoreTip}
                      style={{ fontSize: 28 }}
                    />
                  </div>
                  {page.missing ? (
                    <p className="ph-perf-missing">数据不足</p>
                  ) : null}
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
          <p className="ph-perf-kicker">
            次数少时 p50 和 p95 会相同。次数多了，p95 通常更慢
          </p>
          <ApiList rows={dashboard.apis} phone={band === 'phone'} />
        </section>
        </>
        ) : null}

        {source === 'lab' ? <LabBaseline /> : null}
      </div>
    </PublicLayout>
  );
};

export default StatusPage;
