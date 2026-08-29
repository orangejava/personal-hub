import { useEffect, useState } from 'react';

/** 页面纵向滚动是否超过阈值（用于回到顶部按钮） */
export function useScrollPast(threshold: number, resetKey?: string) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const getScrollY = () =>
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const update = () => setPast(getScrollY() >= threshold);

    update();
    window.addEventListener('scroll', update, { passive: true });
    document.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      document.removeEventListener('scroll', update);
    };
  }, [threshold, resetKey]);

  return past;
}
