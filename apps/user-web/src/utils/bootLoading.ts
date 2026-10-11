const BOOT_LOADING_KEY = 'ph.boot.loading';

export interface BootLoadingCache {
  loadingStyle?: string;
  loadingTitle?: string;
  loadingSubtitle?: string;
  loadingImageUrl?: string | null;
  loadingSvg?: string;
  loadingShowSkeleton?: boolean;
  loadingMotion?: string;
  loadingSizeMode?: string;
  loadingMaxWidth?: number;
  loadingMaxHeight?: number;
  loadingWidth?: number;
  loadingHeight?: number;
  loadingVideoUrl?: string | null;
  colorPrimary?: string;
  theme?: { colorPrimary?: string };
  savedAt?: number;
}

/**
 * 首屏脚本在 React 之前执行，读不到接口。
 * 把最近一次公开配置写进本地，下次打开可以先画出方形、图片或 SVG，而不是默认圆点。
 */
export function rememberBootLoading(config: BootLoadingCache) {
  if (!config.loadingStyle) return;
  try {
    localStorage.setItem(
      BOOT_LOADING_KEY,
      JSON.stringify({
        loadingStyle: config.loadingStyle,
        loadingTitle: config.loadingTitle,
        loadingSubtitle: config.loadingSubtitle,
        loadingImageUrl: config.loadingImageUrl,
        loadingSvg: config.loadingSvg,
        loadingShowSkeleton: config.loadingShowSkeleton !== false,
        loadingMotion: config.loadingMotion,
        loadingSizeMode: config.loadingSizeMode,
        loadingMaxWidth: config.loadingMaxWidth,
        loadingMaxHeight: config.loadingMaxHeight,
        loadingWidth: config.loadingWidth,
        loadingHeight: config.loadingHeight,
        loadingVideoUrl: config.loadingVideoUrl,
        colorPrimary: config.colorPrimary || config.theme?.colorPrimary || '',
        savedAt: Date.now(),
      }),
    );
  } catch {
    // 隐私模式写不进本地缓存时，首屏脚本会再请求公开配置。
  }
}
