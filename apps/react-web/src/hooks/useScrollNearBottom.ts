import { useEffect, useState } from 'react';

/**
 * 页面是否已滚到接近底部（用于文末操作区、返回内容中心等）。
 */
export function useScrollNearBottom(threshold = 80, resetKey?: string) {
  const [nearBottom, setNearBottom] = useState(false);

  useEffect(() => {
    const update = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      setNearBottom(max <= 0 || window.scrollY >= max - threshold);
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, [threshold, resetKey]);

  return nearBottom;
}
