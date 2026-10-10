import { Button } from 'antd';
import React, { useState } from 'react';
import {
  MotionRoot,
  Reveal,
  ScrollScene,
  Stagger,
  useInView,
} from '@/components/motion';
import PublicLayout from '@/layouts/PublicLayout';

/** 开发环境验收四个动效组件。生产构建不注册这条路由。 */
const MotionProbe: React.FC = () => {
  const { ref, inView } = useInView<HTMLElement>({
    once: true,
    margin: '200px',
  });
  const [ticks, setTicks] = useState(0);

  return (
    <section ref={ref} style={{ marginTop: 48 }}>
      <h2>useInView</h2>
      <p>{inView ? '已进入视口' : '还在视口外'}</p>
      <Button onClick={() => setTicks((value) => value + 1)}>
        计数 {ticks}
      </Button>
    </section>
  );
};

const MotionLab: React.FC = () => {
  return (
    <PublicLayout>
      <MotionRoot>
        <div style={{ display: 'grid', gap: 32 }}>
          <Reveal>
            <h1>Reveal</h1>
            <p>进入视口后淡入上移。</p>
          </Reveal>
          <Stagger>
            <div key="one">第一行</div>
            <div key="two">第二行</div>
            <div key="three">第三行</div>
          </Stagger>
          <ScrollScene steps={2}>
            {(progress) => (
              <div>
                <h2>ScrollScene</h2>
                <p>进度 {progress.toFixed(2)}</p>
              </div>
            )}
          </ScrollScene>
          <MotionProbe />
        </div>
      </MotionRoot>
    </PublicLayout>
  );
};

export default MotionLab;
