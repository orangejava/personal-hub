import { m, useReducedMotion } from 'motion/react';
import React from 'react';
import { useViewportBand } from '@/hooks/useViewportBand';

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
}

/** 子元素依次错落进入。只改透明度和位移，时长跟视口档走。 */
const Stagger: React.FC<StaggerProps> = ({ children, className }) => {
  const reduce = useReducedMotion();
  const { band } = useViewportBand();
  const duration = band === 'phone' ? 0.3 : 0.6;
  const distance = reduce ? 0 : 16;

  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduce ? 0 : 0.08 } },
      }}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return (
          <m.div
            key={child.key}
            variants={{
              hidden: { opacity: 0, y: distance },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration, ease: 'easeOut' },
              },
            }}
          >
            {child}
          </m.div>
        );
      })}
    </m.div>
  );
};

export default Stagger;
