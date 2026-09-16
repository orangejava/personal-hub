import { describe, expect, it } from 'vitest';
import { resolveMediaHistoryLoadMore } from './mediaHistory';
import { shouldFireLoadMoreOnce } from './workspaceScroll';

describe('resolveMediaHistoryLoadMore', () => {
  it('可见条数追上已加载数量且还有总数时翻下一页', () => {
    expect(
      resolveMediaHistoryLoadMore({
        visibleCount: 10,
        loadedCount: 20,
        total: 40,
      }),
    ).toEqual({ nextVisible: 20, shouldFetchNextPage: true });
  });

  it('已经覆盖全部已加载且没有更多页时不再翻页', () => {
    expect(
      resolveMediaHistoryLoadMore({
        visibleCount: 20,
        loadedCount: 20,
        total: 20,
      }),
    ).toEqual({ nextVisible: 30, shouldFetchNextPage: false });
  });
});

describe('shouldFireLoadMoreOnce', () => {
  it('停在顶部只触发一次，离开后再允许下一次', () => {
    const first = shouldFireLoadMoreOnce({
      scrollTop: 8,
      ready: true,
      armed: true,
    });
    expect(first).toEqual({ fire: true, armed: false });

    const stillTop = shouldFireLoadMoreOnce({
      scrollTop: 10,
      ready: true,
      armed: first.armed,
    });
    expect(stillTop).toEqual({ fire: false, armed: false });

    const leftTop = shouldFireLoadMoreOnce({
      scrollTop: 80,
      ready: true,
      armed: stillTop.armed,
    });
    expect(leftTop).toEqual({ fire: false, armed: true });
  });
});
