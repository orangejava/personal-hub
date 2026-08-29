/**
 * PageTransition 的 routeKey：同小册内切章不 remount，避免左侧栏整页闪动。
 */
export function getPageTransitionKey(pathname: string): string {
  const bookletChapter = pathname.match(
    /^(\/content\/booklets\/[^/]+)\/chapters\/[^/]+\/?$/,
  );
  if (bookletChapter) {
    return `${bookletChapter[1]}/chapters`;
  }
  return pathname;
}
