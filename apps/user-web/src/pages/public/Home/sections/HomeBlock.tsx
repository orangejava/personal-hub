import React from 'react';
import { useInView } from '@/components/motion';

interface HomeBlockProps {
  children: React.ReactNode;
  /** 未进入视口前先占住高度，避免后面的区块突然撑开滚动条。 */
  minHeight: number | string;
}

/** 首屏以外的区块滚到附近再挂载。提前量 200px。 */
const HomeBlock: React.FC<HomeBlockProps> = ({ children, minHeight }) => {
  const { ref, inView } = useInView<HTMLElement>({
    once: true,
    margin: '200px',
  });

  return (
    <section ref={ref} className="ph-home-block" style={{ minHeight }}>
      {inView ? children : null}
    </section>
  );
};

export default HomeBlock;
