/**
 * 按小批次执行管理端逐项写请求，避免大批选择时同时占满 API/数据库连接。
 * @param items 所选记录 ID 或轻量对象
 * @param operation 单条写操作
 * @param concurrency 同时执行数，默认 5
 * @returns 与 items 顺序一致的逐项结果
 */
export async function settleBatch<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  concurrency = 5,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let start = 0; start < items.length; start += concurrency) {
    const chunk = items.slice(start, start + concurrency);
    results.push(...(await Promise.allSettled(chunk.map(operation))));
  }
  return results;
}
