/**
 * 两个前端的站点根。
 * 本地默认 :8000 / :8001（两个 Origin，方便测 Refresh Cookie）。
 * 生产 Nginx 同站分流时，两个变量都应写成同一 Origin（例如 https://example.com），
 * 「进入后台」只是跳到同源的 `/admin/...`，生产 API 不必开放 CORS。
 */

function stripSlash(origin: string): string {
  return origin.replace(/\/$/, '');
}

export function getUserWebOrigin(): string {
  return stripSlash(
    process.env.UMI_APP_USER_WEB_ORIGIN ?? 'http://localhost:8000',
  );
}

export function getAdminWebOrigin(): string {
  return stripSlash(
    process.env.UMI_APP_ADMIN_WEB_ORIGIN ?? 'http://localhost:8001',
  );
}

/**
 * 管理端首页地址，供用户端「进入后台」跳转。
 *
 * @param path 管理端路径，默认运营概览
 */
export function buildAdminWebUrl(path = '/admin/dashboard'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getAdminWebOrigin()}${normalized}`;
}

/**
 * 用户端登录地址。管理端未登录时整页跳到这里，redirect 用绝对 URL 方便登录后回来。
 *
 * @param redirectAbsoluteUrl 登录成功后要打开的完整地址
 */
export function buildUserWebLoginUrl(redirectAbsoluteUrl: string): string {
  return `${getUserWebOrigin()}/user/login?redirect=${encodeURIComponent(redirectAbsoluteUrl)}`;
}

/**
 * 登录后的回跳是否允许离开用户端，前往管理端。
 */
export function isAllowedAdminRedirect(url: string): boolean {
  try {
    return new URL(url).origin === getAdminWebOrigin();
  } catch {
    return false;
  }
}

export type PostLoginRedirect =
  | { type: 'internal'; path: string }
  | { type: 'external'; url: string };

/**
 * 登录成功后的回跳：同源相对路径留在用户端；管理端绝对 URL 才允许整页离开。
 */
export function resolvePostLoginRedirect(
  redirect: string | null,
): PostLoginRedirect {
  if (
    redirect &&
    (redirect.startsWith('http://') || redirect.startsWith('https://'))
  ) {
    if (isAllowedAdminRedirect(redirect)) {
      return { type: 'external', url: redirect };
    }
    return { type: 'internal', path: '/' };
  }
  if (!redirect?.startsWith('/') || redirect.startsWith('//')) {
    return { type: 'internal', path: '/' };
  }
  try {
    const parsed = new URL(redirect, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return { type: 'internal', path: '/' };
    }
    return {
      type: 'internal',
      path: `${parsed.pathname}${parsed.search}${parsed.hash}`,
    };
  } catch {
    return { type: 'internal', path: '/' };
  }
}

/**
 * Umi `publicPath`。本地独立 Origin 用 `/`；
 * 生产 Nginx 把 `/admin` 指到管理端 dist 时传 `PUBLIC_PATH=/admin/`。
 */
export function resolvePublicPath(raw: string | undefined): string {
  const value = (raw ?? '/').trim() || '/';
  return value.endsWith('/') ? value : `${value}/`;
}

type ProxyIncomingHeaders = {
  origin?: string | string[];
  referer?: string | string[];
};

/**
 * 开发代理把浏览器 Origin / Referer 原样转给 Nest。
 * changeOrigin 只改 Host；若不转发，Cookie 鉴权会看到 :3001，对不上 CORS 白名单。
 */
export function forwardBrowserOriginOnProxyReq(
  proxyReq: { setHeader: (name: string, value: string) => void },
  req: { headers: ProxyIncomingHeaders },
): void {
  const origin = req.headers.origin;
  const originValue = Array.isArray(origin) ? origin[0] : origin;
  if (originValue) {
    proxyReq.setHeader('origin', originValue);
  }
  const referer = req.headers.referer;
  const refererValue = Array.isArray(referer) ? referer[0] : referer;
  if (refererValue) {
    proxyReq.setHeader('referer', refererValue);
  }
}
