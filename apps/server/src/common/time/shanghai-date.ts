const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 上海自然日映射到 PostgreSQL DATE 的 UTC 午夜表示。 */
export function shanghaiDate(now: Date): Date {
  const local = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** 本周一零点对应的 UTC 时刻，供 timestamptz 范围查询使用。 */
export function shanghaiWeekStart(now: Date): Date {
  const day = shanghaiDate(now);
  const daysSinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - daysSinceMonday * DAY_MS - SHANGHAI_OFFSET_MS);
}
