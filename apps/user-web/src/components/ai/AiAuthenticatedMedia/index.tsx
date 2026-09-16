import type { AiAsset } from '@personal-hub/shared-types';
import React, { useEffect, useState } from 'react';
import { releaseAiAssetObjectUrl, resolveAiAssetObjectUrl } from '@/services/ai';

interface AiAuthenticatedMediaProps {
  asset: AiAsset;
  className?: string;
  alt?: string;
  /** 列表缩略图关掉原生控件，避免和 hover 操作条抢点击。 */
  controls?: boolean;
}

/**
 * 通过带 Token 的 fetch 把资产变成 blob URL。
 * 本地 memory 存储和生产对象存储都走同一条鉴权媒体接口。
 */
const AiAuthenticatedMedia: React.FC<AiAuthenticatedMediaProps> = ({
  asset,
  className,
  alt,
  controls = true,
}) => {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void resolveAiAssetObjectUrl(asset)
      .then((url) => {
        if (cancelled) {
          releaseAiAssetObjectUrl(asset.id);
          return;
        }
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(undefined);
        }
      });
    return () => {
      cancelled = true;
      releaseAiAssetObjectUrl(asset.id);
    };
  }, [asset.id, asset.fileUrl, asset.thumbnailUrl]);

  if (!src) {
    return <div className={className} />;
  }
  if (asset.type === 'video') {
    return (
      <video
        className={className}
        controls={controls}
        muted={!controls}
        playsInline
        preload="metadata"
        src={src}
      />
    );
  }
  return <img alt={alt ?? asset.title} className={className} src={src} />;
};

export default AiAuthenticatedMedia;
