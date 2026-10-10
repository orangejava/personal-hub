import { history, useLocation } from '@umijs/max';
import { Button, Drawer } from 'antd';
import React, { lazy, Suspense, useMemo, useState } from 'react';
import ApiList from '@/components/perf/ApiList';
import MetricCells from '@/components/perf/MetricCells';
import ScoreValue from '@/components/perf/ScoreValue';
import { usePerfAppearance } from '@/components/perf/usePerfAppearance';
import { usePerfRevision } from '@/components/perf/usePerfRevision';
import { useViewportBand } from '@/hooks/useViewportBand';
import { buildDashboard, currentPageCells } from '@/utils/perf/aggregate';
import './perf-panel.less';

const PerfCharts = lazy(() => import('@/components/perf/PerfCharts'));

/** 每次「更多」只露出一截，避免一次把性能页全部铺进抽屉。 */
const MORE_PAGE_BATCH = 3;
const MORE_API_BATCH = 5;

/**
 * 公开顶栏的快速视图。图表只在点「更多」后加载，不进常驻包。
 */
const PerfDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const location = useLocation();
  const { band } = useViewportBand();
  const appearance = usePerfAppearance();
  const revision = usePerfRevision();
  const [visiblePages, setVisiblePages] = useState(0);
  const [showCharts, setShowCharts] = useState(false);
  const [visibleApis, setVisibleApis] = useState(0);
  const page = useMemo(
    () => currentPageCells(location.pathname),
    [location.pathname, revision],
  );
  const dashboard = useMemo(() => buildDashboard(), [revision]);
  const themeClass = appearance.dark ? 'ph-perf-shell ph-perf-dark' : 'ph-perf-shell ph-perf-light';
  const moreApis = dashboard.apis.slice(5);

  const shownPages = dashboard.pages.slice(0, visiblePages);
  const shownApis = moreApis.slice(0, visibleApis);
  const hasMore =
    visiblePages < dashboard.pages.length || !showCharts || visibleApis < moreApis.length;

  const openStatus = () => {
    onClose();
    history.push('/status');
  };
  const loadMore = () => {
    if (visiblePages < dashboard.pages.length) {
      setVisiblePages((count) => Math.min(dashboard.pages.length, count + MORE_PAGE_BATCH));
      return;
    }
    if (!showCharts) {
      setShowCharts(true);
      return;
    }
    setVisibleApis((count) => Math.min(moreApis.length, count + MORE_API_BATCH));
  };

  return (
    <Drawer
      className={themeClass}
      rootClassName={`ph-perf-drawer-root ${themeClass}`}
      title="性能"
      placement="right"
      size={band === 'phone' ? '100%' : 480}
      open={open}
      destroyOnHidden
      style={appearance.themeStyle}
      styles={{ mask: { background: 'rgba(0, 0, 0, 0.45)' } }}
      onClose={onClose}
    >
      <div className={`${themeClass} ph-perf-stack`} style={appearance.themeStyle}>
        <section className="ph-perf-block">
          <div className="ph-perf-title-row">
            <p className="ph-perf-muted">{page.label}</p>
            <Button type="primary" size="small" onClick={openStatus}>
              查看完整面板
            </Button>
          </div>
          <p className="ph-perf-kicker">当前页，不是全部记录的总分</p>
          <div className="ph-perf-score-row">
            <ScoreValue value={page.score} tip={page.scoreTip} />
          </div>
          {page.missing ? <p className="ph-perf-missing">数据不足</p> : null}
          <MetricCells cells={page.cells} />
        </section>
        <section className="ph-perf-block">
          <h3 className="ph-perf-section-title">最慢的 5 个接口</h3>
          <p className="ph-perf-kicker">次数少时 p50 和 p95 会相同。次数多了，p95 通常更慢</p>
          <ApiList rows={dashboard.slowestApis} phone={band === 'phone'} />
        </section>
        {shownPages.length > 0 || showCharts || shownApis.length > 0 ? (
          <div className="ph-perf-more">
            {shownPages.length > 0 ? (
              <section className="ph-perf-block">
                <h3 className="ph-perf-section-title">
                  各页面 {shownPages.length}/{dashboard.pages.length}
                </h3>
                <div className="ph-perf-page-grid" style={{ marginTop: 12 }}>
                  {shownPages.map((item) => (
                    <article key={item.template} className="ph-perf-card">
                      <div className="ph-perf-card-head">
                        <h3>{item.label}</h3>
                        <ScoreValue
                        value={item.score}
                        tip={item.scoreTip}
                        style={{ fontSize: 28 }}
                      />
                      </div>
                      {item.missing ? <p className="ph-perf-missing">数据不足</p> : null}
                      <MetricCells cells={item.cells} />
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            {showCharts ? (
              <Suspense fallback={<p className="ph-perf-muted">图表加载中</p>}>
                <PerfCharts
                  dark={appearance.dark}
                  lcpSeries={dashboard.lcpSeries}
                  apiSeries={dashboard.apiSeries}
                  jsBundles={dashboard.jsBundles}
                />
              </Suspense>
            ) : null}
            {shownApis.length > 0 ? (
              <section className="ph-perf-block">
                <h3 className="ph-perf-section-title">
                  其余接口 {shownApis.length}/{moreApis.length}
                </h3>
                <ApiList rows={shownApis} phone={band === 'phone'} />
              </section>
            ) : null}
          </div>
        ) : null}
        {hasMore ? (
          <Button type="primary" style={{ marginTop: 16 }} onClick={loadMore}>
            更多
          </Button>
        ) : null}
      </div>
    </Drawer>
  );
};

export default PerfDrawer;
