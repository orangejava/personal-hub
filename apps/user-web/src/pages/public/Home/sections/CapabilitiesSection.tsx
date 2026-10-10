import React from 'react';
import { Reveal, ScrollScene } from '@/components/motion';
import { useViewportBand } from '@/hooks/useViewportBand';
import { CAPABILITIES } from '../content';

function activeCapability(progress: number) {
  const index = Math.floor(progress * CAPABILITIES.length);
  return Math.min(CAPABILITIES.length - 1, Math.max(0, index));
}

function CapabilityCard({
  item,
  active,
}: {
  item: (typeof CAPABILITIES)[number];
  active?: boolean;
}) {
  return (
    <article
      className={active ? 'ph-home-capability is-active' : 'ph-home-capability'}
    >
      <h3>{item.title}</h3>
      <p>{item.description}</p>
    </article>
  );
}

/** 桌面用滚动进度切换卡片；平板、手机和矮屏改成纵向排列。 */
const CapabilitiesSection: React.FC = () => {
  const { band, short } = useViewportBand();
  const scene = band === 'desktop' && !short;

  if (!scene) {
    return (
      <div className="ph-home-section">
        <h2>平台能力</h2>
        <div className="ph-home-capability-stack">
          {CAPABILITIES.map((item) => (
            <Reveal key={item.key}>
              <CapabilityCard item={item} active />
            </Reveal>
          ))}
        </div>
      </div>
    );
  }

  const renderScene = (progress: number) => {
    const current = activeCapability(progress);
    return (
      <div className="ph-home-capability-frame">
        <h2>平台能力</h2>
        <div className="ph-home-capability-stage">
          {CAPABILITIES.map((item, index) => (
            <CapabilityCard
              key={item.key}
              item={item}
              active={index === current}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <ScrollScene
      steps={CAPABILITIES.length}
      className="ph-home-capability-scene"
    >
      {renderScene}
    </ScrollScene>
  );
};

export default CapabilitiesSection;
