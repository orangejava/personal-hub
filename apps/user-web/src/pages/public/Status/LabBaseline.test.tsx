import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LabBaseline from './LabBaseline';

vi.mock('@/components/perf/PerfTip', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  MetricTipPanel: () => null,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Lighthouse 兼容性', () => {
  it('没有 ResizeObserver 时仍能展开和收起说明，卸载后清理 resize 监听', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60);
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<LabBaseline />);
    expect(
      screen.getByRole('heading', { name: /生产环境 Lighthouse/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '更多' })[0]);
    expect(
      screen
        .getByRole('button', { name: '收起' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '收起' }));
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
