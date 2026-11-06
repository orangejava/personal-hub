import { describe, expect, it } from 'vitest';
import { shanghaiCheckinMonth } from './checkinStatus';

describe('签到月份', () => {
  it('跨时区月初仍按上海月份请求', () => {
    expect(shanghaiCheckinMonth(new Date('2026-10-31T16:30:00Z'))).toBe('2026-11');
    expect(shanghaiCheckinMonth(new Date('2026-11-30T15:30:00Z'))).toBe('2026-11');
  });
});
