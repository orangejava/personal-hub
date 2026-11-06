import type { AiCheckinCalendar } from '@personal-hub/shared-types';

export type AiCheckinStatus = 'claimed' | 'unclaimed' | 'disabled' | 'loading' | 'error';

/** 签到按上海自然日结算，所有入口用同一月份口径请求日历。 */
export function shanghaiCheckinMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

/** 以签到接口的可用性和领取记录为准，避免未加载或已暂停时误报待领取。 */
export function getAiCheckinStatus(
  data?: Pick<AiCheckinCalendar, 'enabled' | 'todayClaimed'>,
  error?: Error,
): AiCheckinStatus {
  if (error) return 'error';
  if (!data) return 'loading';
  if (data.todayClaimed) return 'claimed';
  return data.enabled ? 'unclaimed' : 'disabled';
}

export const aiCheckinStatusText: Record<AiCheckinStatus, string> = {
  claimed: '已领取',
  unclaimed: '待领取',
  disabled: '暂未开放',
  loading: '加载中',
  error: '加载失败',
};
