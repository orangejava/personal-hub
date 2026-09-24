import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewportBand } from './useViewportBand';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('useViewportBand', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((media: string) => ({
        matches: false,
        media,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('仅在 1200px 以下启用 Chat 会话 Drawer', () => {
    setViewportWidth(1199);
    const { result } = renderHook(() => useViewportBand());
    expect(result.current.chatHistoryDrawer).toBe(true);

    act(() => setViewportWidth(1200));
    expect(result.current.chatHistoryDrawer).toBe(false);

    act(() => setViewportWidth(744));
    expect(result.current.chatHistoryDrawer).toBe(true);
  });
});
