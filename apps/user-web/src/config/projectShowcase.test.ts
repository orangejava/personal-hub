import { describe, expect, it } from 'vitest';
import { PROJECT_PROGRESS, PROJECT_SHOWCASE } from './projectShowcase';

describe('作品矩阵文案', () => {
  it('五张端卡片与 PRD 表一致，只有用户端有性能链接', () => {
    expect(PROJECT_SHOWCASE.map((item) => item.key)).toEqual([
      'user-web',
      'admin-web',
      'server',
      'flutter',
      'desktop',
    ]);
    expect(
      PROJECT_SHOWCASE.find((item) => item.key === 'user-web'),
    ).toMatchObject({
      name: '用户端 Web',
      status: '已上线',
      href: '/',
      performanceHref: '/status',
    });
    expect(
      PROJECT_SHOWCASE.filter((item) => item.href).map((item) => item.key),
    ).toEqual(['user-web']);
    expect(
      PROJECT_SHOWCASE.filter((item) => item.performanceHref).map(
        (item) => item.key,
      ),
    ).toEqual(['user-web']);
    expect(
      PROJECT_SHOWCASE.filter((item) => item.status === '规划中').map(
        (item) => item.key,
      ),
    ).toEqual(['flutter', 'desktop']);
  });

  it('进度按发布记录排列，新的在前，每条都有变更', () => {
    expect(PROJECT_PROGRESS.map((item) => item.title)).toEqual([
      '上线后优化',
      '首版公网上线',
      'Nest M0–M6',
      'React-first 阶段 0–5',
    ]);
    expect(PROJECT_PROGRESS[0]?.status).toBe('进行中');
    expect(
      PROJECT_PROGRESS.slice(1).every((item) => item.status === '已发布'),
    ).toBe(true);
    expect(PROJECT_PROGRESS.every((item) => item.changes.length > 0)).toBe(
      true,
    );
  });
});
