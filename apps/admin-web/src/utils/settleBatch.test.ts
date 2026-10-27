import { describe, expect, it } from 'vitest';
import { settleBatch } from './settleBatch';

describe('settleBatch', () => {
  it('限制并发数、保留原顺序，并在单项失败后继续处理后续批次', async () => {
    let active = 0;
    let peak = 0;
    const results = await settleBatch(
      [1, 2, 3, 4, 5],
      async (item) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        if (item === 3) throw new Error('单项失败');
        return item * 10;
      },
      2,
    );

    expect(peak).toBe(2);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled', 'fulfilled', 'rejected', 'fulfilled', 'fulfilled',
    ]);
    expect(results[4]).toEqual({ status: 'fulfilled', value: 50 });
  });
});
