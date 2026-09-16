/**
 * 阅读类页面切换内容后滚到顶部。
 *
 * 只用于公开详情/小册章节等正文切换；后台表格筛选不调用，避免打断筛选后的上下文。
 */
export function scrollPageToTop(behavior: ScrollBehavior = 'auto') {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, behavior });
}

/**
 * 将容器内选中项滚到可视区域垂直中间。
 * 内容未超出容器（无滚动条）时不调整，保持原样。
 */
export function scrollChildIntoCenter(
  container: HTMLElement,
  child: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
) {
  const maxScroll = container.scrollHeight - container.clientHeight;
  if (maxScroll <= 0) return;

  const containerRect = container.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();
  const childOffset =
    childRect.top - containerRect.top + container.scrollTop;
  const target =
    childOffset - container.clientHeight / 2 + childRect.height / 2;

  container.scrollTo({
    top: Math.max(0, Math.min(target, maxScroll)),
    behavior,
  });
}
