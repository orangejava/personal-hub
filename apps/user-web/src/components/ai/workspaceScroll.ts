/**
 * 滚到顶只触发一次加载；必须先离开顶部，才能再加载下一批。
 */
export function shouldFireLoadMoreOnce(input: {
  scrollTop: number;
  ready: boolean;
  armed: boolean;
  topThreshold?: number;
  leaveTopThreshold?: number;
}) {
  const topThreshold = input.topThreshold ?? 24;
  const leaveTopThreshold = input.leaveTopThreshold ?? 48;
  if (input.scrollTop > leaveTopThreshold) {
    return { fire: false, armed: true };
  }
  if (input.ready && input.armed && input.scrollTop <= topThreshold) {
    return { fire: true, armed: false };
  }
  return { fire: false, armed: input.armed };
}
