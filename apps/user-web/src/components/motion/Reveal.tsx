import { m, useReducedMotion } from 'motion/react';
import React from 'react';
import { useViewportBand } from '@/hooks/useViewportBand';

interface RevealProps {
  children: React.ReactNode;
  /** fade 只改透明度，给 Hero 的 minimal 排版用。 */
  variant?: 'rise' | 'fade';
  delay?: number;
  className?: string;
}

/** 进入视口时淡入。手机时长更短，避免窄屏上位移拖沓。 */
const Reveal: React.FC<RevealProps> = ({
  children,
  variant = 'rise',
  delay = 0,
  className,
}) => {
  const reduce = useReducedMotion();
  const { band } = useViewportBand();
  const duration = band === 'phone' ? 0.3 : 0.6;
  const rise = variant === 'rise' && !reduce;

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: rise ? 16 : 0 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration, delay, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  );
};

export default Reveal;
