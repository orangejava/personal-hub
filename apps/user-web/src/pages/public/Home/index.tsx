import { useModel } from '@umijs/max';
import React from 'react';
import { MotionRoot } from '@/components/motion';
import { useDocumentGrows } from '@/hooks/useDocumentGrows';
import { useViewportBand } from '@/hooks/useViewportBand';
import PublicLayout from '@/layouts/PublicLayout';
import SiteFiling from '@/components/shared/SiteFiling';
import {
  DEFAULT_AI_TOOLS,
  DEFAULT_TECH_STACK,
  groupTechStack,
  visibleHomeModules,
} from './content';
import AiToolsSection from './sections/AiToolsSection';
import CapabilitiesSection from './sections/CapabilitiesSection';
import EndingSection from './sections/EndingSection';
import FeaturedSection from './sections/FeaturedSection';
import HeroSection from './sections/HeroSection';
import HomeBlock from './sections/HomeBlock';
import PerformanceSection from './sections/PerformanceSection';
import ShowcasePreviewSection from './sections/ShowcasePreviewSection';
import TechStackSection from './sections/TechStackSection';
import './index.less';

function blockMinHeight(key: string, scene: boolean) {
  if (key === 'capabilities') {
    return scene ? 'calc(3 * (100svh - var(--ph-header-height)) + 12vh)' : 640;
  }
  if (key === 'featured') return 520;
  if (key === 'aiTools') return 280;
  if (key === 'showcase') return 420;
  if (key === 'techStack') return 320;
  if (key === 'performance') return 480;
  return 240;
}

/** 首页按后台 modules 的 visible / sort 渲染。 */
const Home: React.FC = () => {
  useDocumentGrows();
  const { initialState } = useModel('@@initialState');
  const { band, short } = useViewportBand();
  const config = initialState?.systemConfig;
  const homepage = config?.homepage;
  const modules = visibleHomeModules(homepage?.modules);
  const aiTools = homepage?.aiTools ?? DEFAULT_AI_TOOLS;
  const techStack = homepage?.techStack ?? DEFAULT_TECH_STACK;
  const scene = band === 'desktop' && !short;
  const aiEnabled = config?.aiEnabled !== false;
  const heroStyle = config?.layout?.homeHeroStyle ?? 'split';

  const renderModule = (key: string) => {
    if (key === 'hero') {
      return (
        <HeroSection
          homepage={config?.homepage}
          heroStyle={heroStyle}
          short={short}
        />
      );
    }
    // 工具全关或技术栈为空时区块自己返回 null，外层仍会占 minHeight，所以这里先不挂。
    if (
      key === 'aiTools' &&
      (!aiEnabled || !aiTools.some((item) => item.enabled))
    )
      return null;
    if (key === 'techStack' && groupTechStack(techStack).length === 0)
      return null;

    let section: React.ReactNode = null;
    if (key === 'capabilities') section = <CapabilitiesSection />;
    if (key === 'featured') section = <FeaturedSection />;
    if (key === 'aiTools') section = <AiToolsSection tools={aiTools} />;
    if (key === 'showcase') {
      section = <ShowcasePreviewSection assets={config?.projectVisualAssets} />;
    }
    if (key === 'techStack') {
      section = <TechStackSection items={techStack} />;
    }
    if (key === 'performance') section = <PerformanceSection />;
    if (!section) return null;

    return (
      <HomeBlock key={key} minHeight={blockMinHeight(key, scene)}>
        {section}
      </HomeBlock>
    );
  };

  return (
    <PublicLayout fullWidth>
      <MotionRoot>
        <div className="ph-home">
          {modules.map((item) => (
            <React.Fragment key={item.key}>
              {renderModule(item.key)}
            </React.Fragment>
          ))}
          <HomeBlock minHeight={220}>
            <EndingSection />
          </HomeBlock>
          <SiteFiling />
        </div>
      </MotionRoot>
    </PublicLayout>
  );
};

export default Home;
