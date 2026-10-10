import { describe, expect, it } from 'vitest';
import { hideClosedAiMenu, isPublicReaderPath } from './publicNav';

describe('isPublicReaderPath', () => {
  it('小册和内容详情走阅读页，内容列表不走', () => {
    expect(isPublicReaderPath('/content/booklets/abc/chapters/1')).toBe(true);
    expect(isPublicReaderPath('/content/ck123')).toBe(true);
    expect(isPublicReaderPath('/content/ck123/')).toBe(true);
    expect(isPublicReaderPath('/content')).toBe(false);
    expect(isPublicReaderPath('/content/')).toBe(false);
    expect(isPublicReaderPath('/')).toBe(false);
  });
});

describe('hideClosedAiMenu', () => {
  const menu = [
    { path: '/', name: '首页' },
    { path: '/ai', name: 'AI', children: [{ path: '/ai/chat', name: '对话' }] },
    { path: '/about', name: '关于' },
  ];

  it('关闭 AI 入口时去掉 /ai 菜单，其余保留', () => {
    expect(hideClosedAiMenu(menu, false).map((item) => item.path)).toEqual(['/', '/about']);
  });

  it('未显式关闭时保留 AI 菜单', () => {
    expect(hideClosedAiMenu(menu, undefined)).toEqual(menu);
    expect(hideClosedAiMenu(menu, true)).toEqual(menu);
  });
});
