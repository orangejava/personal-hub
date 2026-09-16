/** 本地多露出一批，必要时再翻下一页。 */
export function resolveMediaHistoryLoadMore(input: {
  visibleCount: number;
  loadedCount: number;
  total: number;
  step?: number;
}) {
  const step = input.step ?? 10;
  const nextVisible = input.visibleCount + step;
  return {
    nextVisible,
    shouldFetchNextPage: nextVisible >= input.loadedCount && input.loadedCount < input.total,
  };
}
