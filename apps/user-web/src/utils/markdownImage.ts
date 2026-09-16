/** 掘金等图床 URL 规范化 + 开发代理 */
export function normalizeImageUrl(rawUrl: string): string {
  let url = String(rawUrl).trim().replace(/\\&/g, '&');
  const hashIndex = url.indexOf('#');
  if (hashIndex > -1) url = url.slice(0, hashIndex);
  return url;
}

export function resolveMarkdownImageSrc(src: string | undefined): string | undefined {
  if (!src) return undefined;
  const url = normalizeImageUrl(src);
  if (/byteimg\.com|juejin\.cn|bytedance\.com/i.test(url)) {
    return `/api/dev/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
