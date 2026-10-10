import { PERF_PAGES } from '@/config/pageRegistry';

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;

function splitPath(pathname: string): string[] {
  const path = pathname.split('?')[0]?.split('#')[0] ?? '';
  if (path === '/' || path === '') return [];
  return path.replace(/\/+$/, '').split('/').filter(Boolean);
}

/**
 * 把具体页面路径收成清单里的路由模板。
 * 更长、静态段更多的模板优先，避免 `/content/:id` 吃掉小册章节。
 * 不在清单里的路径返回 null，面板不为其单开一张卡。
 */
export function matchPageTemplate(pathname: string): string | null {
  const parts = splitPath(pathname);
  let best: { template: string; score: number } | null = null;

  for (const page of PERF_PAGES) {
    const templateParts = splitPath(page.template);
    if (templateParts.length !== parts.length) continue;

    let score = 0;
    let matched = true;
    for (let index = 0; index < templateParts.length; index += 1) {
      const expected = templateParts[index];
      const actual = parts[index];
      if (expected.startsWith(':')) {
        score += 1;
      } else if (expected === actual) {
        score += 10;
      } else {
        matched = false;
        break;
      }
    }

    if (matched && (!best || score > best.score)) {
      best = { template: page.template, score };
    }
  }

  return best?.template ?? null;
}

/**
 * 接口按「方法 + 路由模板」分组。
 * 去掉查询参数，并把 UUID、纯数字段换成 `:id`，避免面板露出具体资源。
 */
export function toApiRouteTemplate(rawUrl: string): string {
  let path = rawUrl.split('#')[0]?.split('?')[0] ?? '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      path = new URL(path).pathname;
    } catch {
      // 非法绝对地址时保留原字符串，仍会去掉查询参数。
    }
  }

  const templated = path
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (UUID_SEGMENT.test(segment) || NUMERIC_SEGMENT.test(segment)) return ':id';
      return segment;
    })
    .join('/');

  return templated || '/';
}
