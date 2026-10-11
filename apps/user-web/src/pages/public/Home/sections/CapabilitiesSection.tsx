import React from 'react';
import { Reveal, ScrollScene } from '@/components/motion';
import { useViewportBand } from '@/hooks/useViewportBand';
import { CAPABILITIES } from '../content';

function activeCapability(progress: number) {
  const index = Math.floor(progress * CAPABILITIES.length);
  return Math.min(CAPABILITIES.length - 1, Math.max(0, index));
}

/**
 * 最后一张从 2/3 处才出现，原始进度要到松开那一帧才是 100%，采样经常停在前面。
 * 最后一张走过约三分之一就画满，滚完这一段时条是满的。
 */
function capabilityBarPercent(progress: number): number {
  const count = CAPABILITIES.length;
  const clamped = Math.min(1, Math.max(0, progress));
  const lastStart = (count - 1) / count;
  const finishAt = lastStart + (1 - lastStart) * 0.35;
  if (clamped >= finishAt) return 100;
  return Math.round((clamped / finishAt) * 100);
}

function CapabilityCard({
  item,
  active,
  index,
}: {
  item: (typeof CAPABILITIES)[number];
  active?: boolean;
  /** 紧凑档三张卡同时可见，序号标在卡上。桌面滚动场景改由左侧步骤列表表示。 */
  index?: number;
}) {
  return (
    <article
      className={active ? 'ph-home-capability is-active' : 'ph-home-capability'}
      aria-hidden={active === false}
    >
      {index == null ? null : (
        <span className="ph-home-capability-index">
          {String(index + 1).padStart(2, '0')}
        </span>
      )}
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
          {CAPABILITIES.map((item, index) => (
            <Reveal key={item.key}>
              <CapabilityCard item={item} active index={index} />
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
        <div className="ph-home-capability-copy">
          <h2>平台能力</h2>
          <ol className="ph-home-capability-steps">
            {CAPABILITIES.map((item, index) => (
              <li
                key={item.key}
                className={
                  index === current
                    ? 'is-current'
                    : index < current
                      ? 'is-done'
                      : undefined
                }
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {item.title}
              </li>
            ))}
          </ol>
        </div>
        <div className="ph-home-capability-stage">
          {CAPABILITIES.map((item, index) => (
            <CapabilityCard
              key={item.key}
              item={item}
              active={index === current}
            />
          ))}
        </div>
        <div className="ph-home-capability-progress" aria-hidden="true">
          <span style={{ width: `${capabilityBarPercent(progress)}%` }} />
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
