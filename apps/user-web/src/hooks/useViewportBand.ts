import { useEffect, useState } from 'react';
import viewportBands from '@/config/viewport-bands.json';

export type ViewportBand = 'phone' | 'tablet' | 'desktop';

export interface ViewportBandState {
  /** 当前宽度档。手机 <768，平板 768–991，桌面 ≥992。 */
  band: ViewportBand;
  /** Chat 会话历史在窄桌面及以下使用 Drawer，避免常驻侧栏压缩消息区。 */
  chatHistoryDrawer: boolean;
  /** 可视高度不超过 shortHeightMax，横屏手机也走紧凑阅读。 */
  short: boolean;
  /** 阅读多栏只在够宽且不是矮屏时打开，其余都用底部操作栏。 */
  readerSheets: boolean;
}

interface ViewportSnapshot extends ViewportBandState {
  width: number;
  height: number;
}

const desktopSnapshot: ViewportSnapshot = {
  band: 'desktop',
  chatHistoryDrawer: false,
  short: false,
  readerSheets: false,
  width: viewportBands.desktopMin,
  height: viewportBands.shortHeightMax + 1,
};

/**
 * 读取视口宽高档。
 * 数字只来自 viewport-bands.json，避免页面各自写一套 768/992。
 */
function readViewport(): ViewportSnapshot {
  if (typeof window === 'undefined') return desktopSnapshot;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const short = height <= viewportBands.shortHeightMax;
  let band: ViewportBand = 'desktop';
  if (width <= viewportBands.phoneMax) band = 'phone';
  else if (width <= viewportBands.tabletMax) band = 'tablet';

  return {
    band,
    chatHistoryDrawer: width < viewportBands.chatSidePanelMin,
    short,
    readerSheets: width < viewportBands.readerColumnsMin || short,
    width,
    height,
  };
}

/** 订阅宽度档、Chat 会话栏、矮屏和阅读底栏模式。首屏直接读取窗口，避免断点状态延迟。 */
export function useViewportBand(): ViewportBandState {
  const [snapshot, setSnapshot] = useState(readViewport);

  useEffect(() => {
    const update = () => setSnapshot(readViewport());
    const queries = [
      window.matchMedia(`(max-width: ${viewportBands.phoneMax}px)`),
      window.matchMedia(`(max-width: ${viewportBands.tabletMax}px)`),
      window.matchMedia(`(max-width: ${viewportBands.chatSidePanelMin - 1}px)`),
      window.matchMedia(`(max-width: ${viewportBands.readerColumnsMin - 1}px)`),
      window.matchMedia(`(max-height: ${viewportBands.shortHeightMax}px)`),
    ];
    queries.forEach((query) => {
      query.addEventListener('change', update);
    });
    window.addEventListener('resize', update);
    update();
    return () => {
      queries.forEach((query) => {
        query.removeEventListener('change', update);
      });
      window.removeEventListener('resize', update);
    };
  }, []);

  return {
    band: snapshot.band,
    chatHistoryDrawer: snapshot.chatHistoryDrawer,
    short: snapshot.short,
    readerSheets: snapshot.readerSheets,
  };
}
