/**
 * 认证与用户服务。HTTP 走 Umi request；会话与映射在 `@personal-hub/api-client`。
 */
import { createAuthApi, type AuthHttpRequest } from '@personal-hub/api-client';
import { request } from '@umijs/max';
import { mapNestMenusToLayout } from '@/auth/routeRegistry';

const authApi = createAuthApi({
  // Umi request 重载与注入的 AuthHttpRequest 不完全对齐，在边界处做适配。
  request: ((url, options) => request(url, options ?? {})) as AuthHttpRequest,
  mapMenus: mapNestMenusToLayout,
});

export const {
  login,
  refreshAccessToken,
  logout,
  fetchCurrentUser,
  fetchPermissions,
  register,
  verifyEmail,
  resendVerification,
  createCaptchaChallenge,
  fetchAuthSessions,
  revokeAuthSession,
  revokeOtherAuthSessions,
  forgotPassword,
  resetPassword,
  fetchNestAdminUsers,
  fetchNestAdminUserSessions,
  revokeNestAdminUserSessions,
  changePassword,
} = authApi;

export {
  nestError,
  nestHttpStatus,
  type AuthSessionItem,
  type NestAdminUser,
  type NestAdminUserPage,
} from '@personal-hub/api-client';
