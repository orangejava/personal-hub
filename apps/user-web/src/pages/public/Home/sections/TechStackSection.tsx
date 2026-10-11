import React from 'react';
import type { PublicHomepageConfig } from '@/services/system';
import { groupTechStack, techCategoryLabel } from '../content';

interface TechStackSectionProps {
  items: PublicHomepageConfig['techStack'];
}

/** 按配置里的 category 分组，不在页面里写死技术名称。 */
const TechStackSection: React.FC<TechStackSectionProps> = ({ items }) => {
  const groups = groupTechStack(items);
  if (groups.length === 0) return null;

  return (
    <div className="ph-home-section">
      <h2>网站技术栈</h2>
      <div className="ph-home-tech-groups">
        {groups.map(([category, list]) => (
          <section key={category}>
            <h3>{techCategoryLabel(category)}</h3>
            <ul>
              {list.map((item) => (
                <li key={`${category}-${item.name}`}>{item.name}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

export default TechStackSection;
