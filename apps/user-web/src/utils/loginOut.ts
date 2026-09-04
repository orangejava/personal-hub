import { history } from '@umijs/max';
import { message } from 'antd';
import { clearAuthSession, isNestAuthEnabled } from '@personal-hub/api-client';
import { publicMenu } from '@/config/publicMenu';
import { logout as logoutService, nestError, nestHttpStatus } from '@/services/auth';
import type { InitialState } from '@/types/app';

const loginPath = '/user/login';

type SetInitialState = (
  updater: (s: InitialState | undefined) => InitialState,
) => void;

function clearLocalLoginState(setInitialState?: SetInitialState) {
  if (isNestAuthEnabled()) {
    clearAuthSession();
  } else {
    localStorage.removeItem('ph-token');
  }

  setInitialState?.((s) => ({
    ...(s ?? {}),
    currentUser: undefined,
    permissions: undefined,
    permissionGrants: undefined,
    menu: publicMenu,
    publicMenu: s?.publicMenu ?? publicMenu,
  }));
}

function redirectToLogin() {
  const { search, pathname } = window.location;
  if (pathname !== loginPath) {
    history.replace(
      `${loginPath}?redirect=${encodeURIComponent(pathname + search)}`,
    );
  }
}

/**
 * 退出登录：必须等 Nest 登出成功再清本地状态并跳登录页。
 * 接口故障（断网、5xx、来源被拒）时留在当前页，避免页面像已退出、Redis 会话却还在。
 *
 * @param setInitialState 成功后清 currentUser
 * @returns 是否已结束本地登录态
 */
export async function loginOut(setInitialState?: SetInitialState): Promise<boolean> {
  try {
    await logoutService();
  } catch (error: unknown) {
    const status = nestHttpStatus(error);
    // 无凭证时服务端已改为 200；若仍 401，当作会话已不在。
    if (status === 401) {
      clearLocalLoginState(setInitialState);
      redirectToLogin();
      return true;
    }

    const nest = nestError(error);
    const fallback =
      status === undefined
        ? '退出失败，无法连接服务器，当前登录仍有效'
        : `退出失败（HTTP ${status}），当前登录仍有效，请重试`;
    message.error(nest.message || fallback);
    return false;
  }

  clearLocalLoginState(setInitialState);
  redirectToLogin();
  return true;
}
