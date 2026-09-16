const LOGIN_PATH = '/user/login';

const AUTH_PATHS = [
  LOGIN_PATH,
  '/user/register',
  '/user/register-result',
  '/user/verify-email',
  '/user/forgot-password',
  '/user/reset-password',
  '/user/change-password',
];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * 登录页地址。从业务页点「登录」时带上当前 path，登录成功才能回到原页面。
 *
 * @param from 回跳目标，默认取当前地址；已在登录/注册等鉴权页时不再套一层 redirect
 */
export function buildLoginPath(from?: string): string {
  const current =
    from ??
    (typeof window === 'undefined'
      ? '/'
      : `${window.location.pathname}${window.location.search}${window.location.hash}`);
  if (!current.startsWith('/') || current.startsWith('//')) {
    return LOGIN_PATH;
  }

  try {
    const url = new URL(current, 'http://local.invalid');
    if (isAuthPath(url.pathname)) {
      const existing = url.searchParams.get('redirect');
      return existing
        ? `${LOGIN_PATH}?redirect=${encodeURIComponent(existing)}`
        : LOGIN_PATH;
    }
    const redirect = `${url.pathname}${url.search}${url.hash}`;
    return `${LOGIN_PATH}?redirect=${encodeURIComponent(redirect)}`;
  } catch {
    return LOGIN_PATH;
  }
}
