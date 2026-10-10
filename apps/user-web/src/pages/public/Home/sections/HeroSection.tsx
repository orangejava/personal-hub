import { history } from '@umijs/max';
import { Button } from 'antd';
import React from 'react';
import { Reveal } from '@/components/motion';
import type { PublicHomepageConfig } from '@/services/system';
import { readHeroActions } from '../content';

interface HeroSectionProps {
  homepage?: PublicHomepageConfig;
  heroStyle: 'split' | 'center' | 'minimal';
  short: boolean;
}

function openHeroAction(target: string) {
  if (/^https?:\/\//.test(target)) {
    window.location.assign(target);
    return;
  }
  history.push(target || '/');
}

function scrollPastHero() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      '--ph-header-height',
    ),
  );
  window.scrollBy({
    top: Math.max(
      window.innerHeight - (Number.isFinite(header) ? header : 56),
      240,
    ),
    behavior: reduce ? 'auto' : 'smooth',
  });
}

/** 首屏只放文案和按钮，不发业务请求。高度扣掉顶栏，不依赖透明顶栏。 */
const HeroSection: React.FC<HeroSectionProps> = ({
  homepage,
  heroStyle,
  short,
}) => {
  const hero = readHeroActions(homepage);
  const showVisual = heroStyle === 'split';

  return (
    <section
      className={`ph-home-hero-stage ph-home-hero-stage-${heroStyle}${short ? ' ph-home-hero-stage-short' : ''}`}
    >
      <div className="ph-home-hero-inner">
        <div className="ph-home-hero-copy">
          {/* 标题是首屏最大内容，不能等错落淡入，否则 LCP 会被动画推后。 */}
          <h1>{hero.title}</h1>
          <Reveal variant="fade">
            <p>{hero.subtitle}</p>
          </Reveal>
          <div className="ph-home-hero-actions">
            <Button
              type="primary"
              size="large"
              onClick={() => openHeroAction(hero.primary.target)}
            >
              {hero.primary.label}
            </Button>
            <Button
              size="large"
              onClick={() => openHeroAction(hero.secondary.target)}
            >
              {hero.secondary.label}
            </Button>
          </div>
        </div>
        {showVisual ? (
          <div className="ph-home-hero-visual" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="ph-home-scroll-hint"
        onClick={scrollPastHero}
      >
        向下滚动
      </button>
    </section>
  );
};

export default HeroSection;
