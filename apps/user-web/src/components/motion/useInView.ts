import { useInView as useMotionInView } from 'motion/react';
import { useRef } from 'react';

interface UseInViewOptions {
  /** 为 true 时只触发一次，用来延迟挂载和发请求。 */
  once?: boolean;
  /** 视口提前量。首页数据请求用 200px，让区块滚到附近再出现。 */
  margin?: string;
}

/**
 * 进入视口（含提前量）时返回 true。
 * 必须放在 MotionRoot 内使用。
 */
export function useInView<T extends HTMLElement = HTMLElement>(
  options?: UseInViewOptions,
) {
  const ref = useRef<T>(null);
  const inView = useMotionInView(ref, {
    once: options?.once ?? true,
    margin: (options?.margin ?? '200px') as `${number}px`,
  });
  return { ref, inView };
}
