import { describe, expect, it, vi } from 'vitest';
import { AiRewardService } from '../src/modules/ai/ai-reward.service';

describe('签到日历可领取状态', () => {
  it('启用但额度为零时关闭领取入口，正额度时恢复', async () => {
    const rule = { enabled: true, amount: 0, label: '每日签到' };
    const prisma = {
      aiRewardRule: { findUnique: vi.fn().mockResolvedValue(rule) },
      aiCheckin: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new AiRewardService(prisma as never);
    expect((await service.calendar('user', '2026-11')).enabled).toBe(false);
    rule.amount = 100;
    expect((await service.calendar('user', '2026-11')).enabled).toBe(true);
  });
});
