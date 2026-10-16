import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SiteFiling from './index';

describe('SiteFiling', () => {
  it('展示公共配置中的 ICP 备案号并链接工信部查询站点', () => {
    render(<SiteFiling />);

    const link = screen.getByRole('link', { name: '鄂ICP备2026055237号' });
    expect(link.getAttribute('href')).toBe('https://beian.miit.gov.cn/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
