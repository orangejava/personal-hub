/**
 * 认证与用户服务
 */
import { request } from '@umijs/max';
import type { LoginParams, LoginResult, User, ApiResponse } from '@personal-hub/shared-types';
import type { MenuItem, PermissionCode } from '@personal-hub/shared-types';

/** 登录 */
export async function login(data: LoginParams) {
  return request<ApiResponse<LoginResult>>('/api/auth/login', {
    method: 'POST',
    data,
  });
}

/** 退出 */
export async function logout() {
  return request<ApiResponse<null>>('/api/auth/logout', { method: 'POST' });
}

/** 当前用户
 * @param options.skipErrorHandler 启动期调用应传 true，避免未登录时触发全局登录跳转
 */
export async function fetchCurrentUser(options?: { skipErrorHandler?: boolean }) {
  return request<ApiResponse<User>>('/api/auth/current-user', { skipErrorHandler: options?.skipErrorHandler });
}

/** 当前用户权限与菜单 */
export async function fetchPermissions() {
  return request<ApiResponse<{ permissions: PermissionCode[]; menu: MenuItem[] }>>(
    '/api/auth/permissions',
  );
}
