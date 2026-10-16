import { describe, expect, it, vi } from 'vitest';
import { AdminDashboardService } from '../src/modules/admin/admin-dashboard.service';
import { shanghaiDate, shanghaiWeekStart } from '../src/common/time/shanghai-date';

describe('admin dashboard', () => {
  it('上海周一凌晨的日期与周起点不受服务器时区影响', () => {
    const now = new Date('2026-10-11T16:30:00.000Z');
    expect(shanghaiDate(now).toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(shanghaiWeekStart(now).toISOString()).toBe('2026-10-11T16:00:00.000Z');
  });

  it('从真实查询结果映射四项统计，空数据为零', async () => {
    const prisma = {
      content: { count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1) },
      user: { count: vi.fn().mockResolvedValue(2) },
      $queryRaw: vi.fn().mockResolvedValue([{ count: 0n }]),
    };
    const service = new AdminDashboardService(prisma as never);
    expect(await service.overview(new Date('2026-10-11T16:30:00.000Z'))).toEqual({
      contentTotal: 3,
      userTotal: 2,
      contentReadersToday: 0,
      publishedThisWeek: 1,
    });
    expect(prisma.content.count).toHaveBeenNthCalledWith(2, {
      where: {
        deletedAt: null,
        publishedAt: {
          gte: new Date('2026-10-11T16:00:00.000Z'),
          lte: new Date('2026-10-11T16:30:00.000Z'),
        },
      },
    });
  });
});
