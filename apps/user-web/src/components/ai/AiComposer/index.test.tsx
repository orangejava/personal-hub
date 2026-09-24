import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiComposer from '.';

let footerClientWidth = 500;
let footerScrollWidth = 480;
let phoneMatches = false;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('AiComposer responsive footer', () => {
  beforeEach(() => {
    footerClientWidth = 500;
    footerScrollWidth = 480;
    phoneMatches = false;
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((media: string) => ({
        matches: phoneMatches,
        media,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('ph-ai-composer-footer')) return footerClientWidth;
      if (this.classList.contains('ph-ai-composer-left')) return 260;
      return 0;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('ph-ai-composer-footer')) return footerScrollWidth;
      if (this.classList.contains('ph-ai-composer-left')) return 260;
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('外框不变但动作内容变宽时重新测量并进入紧凑模式', async () => {
    const props = {
      value: '生成一张图片',
      model: {
        value: 'model-a',
        options: [{ label: '模型 A', value: 'model-a' }],
        onChange: vi.fn(),
      },
      onChange: vi.fn(),
      onSubmit: vi.fn(),
    };
    const { container, rerender } = render(
      <AiComposer {...props} pinnedLeading={<button type="button">配置</button>} />,
    );

    expect(
      container.querySelector('.ph-ai-composer')?.classList.contains('ph-ai-composer-compact'),
    ).toBe(false);

    footerScrollWidth = 620;
    rerender(
      <AiComposer
        {...props}
        pinnedLeading={<button type="button">生成配置 16:9 | 4 张 | 标准画质</button>}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector('.ph-ai-composer')?.classList.contains('ph-ai-composer-compact'),
      ).toBe(true);
    });
    expect(container.querySelector('.ph-ai-composer-left')?.textContent).not.toContain('生成配置');
  });

  it('布局内容变短后重新探测并退出紧凑模式', async () => {
    const props = {
      value: '生成一张图片',
      model: {
        value: 'model-a',
        options: [{ label: '模型 A', value: 'model-a' }],
        onChange: vi.fn(),
      },
      onChange: vi.fn(),
      onSubmit: vi.fn(),
    };
    footerScrollWidth = 620;
    const { container, rerender } = render(
      <AiComposer
        {...props}
        layoutKey="long"
        pinnedLeading={<button type="button">生成配置 16:9 | 4 张 | 标准画质</button>}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector('.ph-ai-composer')?.classList.contains('ph-ai-composer-compact'),
      ).toBe(true);
    });

    footerScrollWidth = 480;
    rerender(
      <AiComposer
        {...props}
        layoutKey="short"
        pinnedLeading={<button type="button">配置</button>}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector('.ph-ai-composer')?.classList.contains('ph-ai-composer-compact'),
      ).toBe(false);
    });
  });

  it('离开手机断点时关闭更多面板并恢复普通底栏', async () => {
    phoneMatches = true;
    const props = {
      value: '测试内容',
      onChange: vi.fn(),
      onSubmit: vi.fn(),
    };
    const { container, rerender } = render(<AiComposer {...props} />);

    const moreButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('更多'),
    );
    if (!moreButton) throw new Error('未找到紧凑底栏的更多按钮');
    fireEvent.click(moreButton);
    await waitFor(() => {
      expect(document.querySelector('.ant-drawer-open')).not.toBeNull();
    });

    phoneMatches = false;
    rerender(<AiComposer {...props} />);

    await waitFor(() => {
      expect(
        container.querySelector('.ph-ai-composer')?.classList.contains('ph-ai-composer-compact'),
      ).toBe(false);
      expect(document.querySelector('.ant-drawer-open')).toBeNull();
    });
  });
});
