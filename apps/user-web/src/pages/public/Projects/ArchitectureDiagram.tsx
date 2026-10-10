import React from 'react';

const CLIENTS = [
  { key: 'user-web', label: '用户端', planned: false },
  { key: 'admin-web', label: '管理端', planned: false },
  { key: 'flutter', label: 'Flutter', planned: true },
  { key: 'desktop', label: '桌面端', planned: true },
] as const;

const STORES = ['PostgreSQL', 'Redis', 'COS'] as const;

/**
 * 这是结构图，不是作品列表。
 * 节点保持内容宽度，窄屏改成纵向，避免拉成整行长条。
 */
const ArchitectureDiagram: React.FC = () => {
  return (
    <figure className="ph-architecture">
      <figcaption>各个端把请求交给 Nest，再落到数据库、缓存和文件。</figcaption>
      <div className="ph-architecture-flow">
        <div className="ph-architecture-clients">
          {CLIENTS.map((item) => (
            <span
              key={item.key}
              className={item.planned ? 'is-planned' : undefined}
            >
              {item.label}
            </span>
          ))}
        </div>
        <span className="ph-architecture-join" aria-hidden="true" />
        <strong>Nest</strong>
        <span className="ph-architecture-join" aria-hidden="true" />
        <div className="ph-architecture-stores">
          {STORES.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </div>
    </figure>
  );
};

export default ArchitectureDiagram;
