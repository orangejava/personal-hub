import { history } from '@umijs/max';
import { logout as logoutService } from '@/services/auth';

const loginPath = '/user/login';

/** 退出登录：调用退出接口（忽略错误）后清状态并跳登录页 */
export async function loginOut() {
  try {
    await logoutService();
  } catch {
    // 本地已清状态，忽略接口错误
  }
  const { search, pathname } = window.location;
  if (pathname !== loginPath) {
    history.replace(
      `${loginPath}?redirect=${encodeURIComponent(pathname + search)}`,
    );
  }
}
