import { message } from 'antd';
import { clearAuthSession, isNestAuthEnabled } from '@personal-hub/api-client';
import { buildUserWebLoginUrl } from '@personal-hub/app-origins';
import { logout as logoutService, nestError, nestHttpStatus } from '@/services/auth';
import type { InitialState } from '@/types/app';

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
    menu: undefined,
  }));
}

function redirectToUserLogin() {
  window.location.replace(buildUserWebLoginUrl(window.location.href));
}

/**
 * 退出登录：必须等 Nest 登出成功再清本地状态并跳用户端登录页。
 *
 * @param setInitialState 成功后清 currentUser
 * @returns 是否已结束本地登录态
 */
export async function loginOut(setInitialState?: SetInitialState): Promise<boolean> {
  try {
    await logoutService();
  } catch (error: unknown) {
    const status = nestHttpStatus(error);
    if (status === 401) {
      clearLocalLoginState(setInitialState);
      redirectToUserLogin();
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
  redirectToUserLogin();
  return true;
}
