import React, { useEffect, useState } from 'react';

interface ShowcaseImageProps {
  src?: string | null;
  fallback: string;
  alt: string;
  className?: string;
}

/**
 * 封面优先用公开配置里的签名 URL。
 * 没有 URL，或图片加载失败，都回到占位图，不向用户报错。
 */
const ShowcaseImage: React.FC<ShowcaseImageProps> = ({
  src,
  fallback,
  alt,
  className,
}) => {
  const [failed, setFailed] = useState(false);
  const resolved = !src || failed ? fallback : src;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <img
      className={className}
      src={resolved}
      alt={alt}
      onError={() => {
        if (resolved !== fallback) setFailed(true);
      }}
    />
  );
};

export default ShowcaseImage;
