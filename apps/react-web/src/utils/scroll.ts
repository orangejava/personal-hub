/**
 * 阅读类页面切换内容后滚到顶部。
 *
 * 只用于公开详情/小册章节等正文切换；后台表格筛选不调用，避免打断筛选后的上下文。
 */
export function scrollPageToTop(behavior: ScrollBehavior = 'auto') {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, behavior });
}
