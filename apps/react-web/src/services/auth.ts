/**
 * 认证与用户服务
 */
import { request } from '@umijs/max';
import type { LoginParams, LoginResult, User, ApiResponse } from '@personal-hub/shared-types';
import type { MenuItem, PermissionCode } from '@personal-hub/shared-types';
import { adaptNestPermissions, type NestPermissionSnapshot } from '@/auth/mapNestPermissions';
import { mapNestUser } from '@/auth/mapNestUser';
import {
  clearAuthSession,
  getAccessToken,
  isNestAuthEnabled,
  setAccessToken,
  setMockBridgeRole,
} from '@/auth/session';

interface NestEnvelope<T> {
  data: T;
  requestId?: string;
}

interface NestLoginData {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    nickname: string | null;
    role: string;
    status: string;
    mustChangePassword?: boolean;
    createdAt: string;
  };
}

function toApiResponse<T>(data: T, requestId?: string): ApiResponse<T> {
  return { code: 0, message: 'ok', data, requestId };
}

function rememberNestLogin(data: NestLoginData): LoginResult {
  const user = mapNestUser(data.user);
  setAccessToken(data.accessToken);
  setMockBridgeRole(user.role);
  return { token: data.accessToken, user };
}

function nestHttpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

/** 登录 */
export async function login(data: LoginParams) {
  if (!isNestAuthEnabled()) {
    return request<ApiResponse<LoginResult>>('/api/auth/login', {
      method: 'POST',
      data,
    });
  }

  const res = await request<NestEnvelope<NestLoginData>>('/api/v1/auth/login', {
    method: 'POST',
    data,
    skipErrorHandler: true,
  });
  return toApiResponse(rememberNestLogin(res.data), res.requestId);
}

/**
 * 用 Refresh Cookie 换新的 Access Token。
 * 返回 false 只表示会话已不在（401）。403 / 5xx / 断网会抛出，由调用方决定是否留在当前页。
 */
export async function refreshAccessToken(): Promise<boolean> {
  if (!isNestAuthEnabled()) {
    return false;
  }
  try {
    const res = await request<NestEnvelope<NestLoginData>>('/api/v1/auth/refresh', {
      method: 'POST',
      skipErrorHandler: true,
    });
    rememberNestLogin(res.data);
    return true;
  } catch (error: unknown) {
    if (nestHttpStatus(error) === 401) {
      clearAuthSession();
      return false;
    }
    throw error;
  }
}

/**
 * 退出当前 Nest 会话。成功前不清内存 Token。
 * 服务端优先认 Refresh Cookie，Access 过期也不必先换票。
 */
export async function logout() {
  if (!isNestAuthEnabled()) {
    return request<ApiResponse<null>>('/api/auth/logout', { method: 'POST' });
  }
  await request('/api/v1/auth/logout', {
    method: 'POST',
    skipErrorHandler: true,
  });
  return toApiResponse(null);
}

/** 当前用户
 * @param options.skipErrorHandler 启动期调用应传 true，避免未登录时触发全局登录跳转
 */
export async function fetchCurrentUser(options?: { skipErrorHandler?: boolean }) {
  if (!isNestAuthEnabled()) {
    return request<ApiResponse<User>>('/api/auth/current-user', {
      skipErrorHandler: options?.skipErrorHandler,
    });
  }

  if (!getAccessToken()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      const error = new Error('未登录');
      (error as Error & { response?: { status: number } }).response = { status: 401 };
      throw error;
    }
  }

  const res = await request<NestEnvelope<NestLoginData['user']>>('/api/v1/auth/me', {
    skipErrorHandler: options?.skipErrorHandler ?? true,
  });
  const user = mapNestUser(res.data);
  setMockBridgeRole(user.role);
  return toApiResponse(user, res.requestId);
}

interface PermissionPayload {
  permissions: PermissionCode[];
  permissionGrants?: Array<{ code: string; dataScope: 'OWN' | 'ALL' }>;
  menu: MenuItem[];
}

/** 当前用户权限与菜单 */
export async function fetchPermissions() {
  if (!isNestAuthEnabled()) {
    return request<ApiResponse<PermissionPayload>>('/api/auth/permissions');
  }

  const res = await request<NestEnvelope<NestPermissionSnapshot>>('/api/v1/auth/permissions', {
    skipErrorHandler: true,
  });
  const adapted = adaptNestPermissions(res.data);
  return toApiResponse<PermissionPayload>(
    {
      permissions: adapted.permissions,
      permissionGrants: adapted.permissionGrants,
      menu: adapted.menu,
    },
    res.requestId,
  );
}

interface NestAccepted {
  accepted: boolean;
}

interface NestVerified {
  verified: boolean;
}

function readResponseHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }
  const bag = headers as { get?: (key: string) => string | undefined; [key: string]: unknown };
  if (typeof bag.get === 'function') {
    const fromGetter = bag.get(name) ?? bag.get(name.toLowerCase());
    if (fromGetter) {
      return fromGetter;
    }
  }
  const raw = bag[name] ?? bag[name.toLowerCase()];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    return raw[0];
  }
  return undefined;
}

/**
 * 从 Nest 错误响应取出业务码、文案，以及 429 的 Retry-After（秒）。
 * 登录冷却 UI 必须读 header：JSON message 只有「请稍后再试」，不含剩余时间。
 */
function nestError(error: unknown): {
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
} {
  const response = (
    error as {
      response?: {
        headers?: unknown;
        data?: { error?: { code?: string; message?: string } };
      };
    }
  )?.response;
  const retryAfterRaw = readResponseHeader(response?.headers, 'retry-after');
  const retryAfterSeconds = Number(retryAfterRaw);
  return {
    ...(response?.data?.error ?? {}),
    retryAfterSeconds:
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.floor(retryAfterSeconds)
        : undefined,
  };
}

/** 公开注册：始终 202，不签发登录态 */
export async function register(data: {
  email: string;
  password: string;
  nickname?: string;
}) {
  if (!isNestAuthEnabled()) {
    return request<ApiResponse<{ accepted: boolean }>>('/api/auth/register', {
      method: 'POST',
      data,
      skipErrorHandler: true,
    });
  }

  const res = await request<NestEnvelope<NestAccepted>>('/api/v1/auth/register', {
    method: 'POST',
    data,
    skipErrorHandler: true,
  });
  return toApiResponse(res.data, res.requestId);
}

/** 消费邮件验证链接 */
export async function verifyEmail(data: { token: string }) {
  if (!isNestAuthEnabled()) {
    return request<ApiResponse<{ verified: boolean }>>('/api/auth/verify-email', {
      method: 'POST',
      data,
      skipErrorHandler: true,
    });
  }

  const res = await request<NestEnvelope<NestVerified>>('/api/v1/auth/verify-email', {
    method: 'POST',
    data,
    skipErrorHandler: true,
  });
  return toApiResponse(res.data, res.requestId);
}

/** 重发验证邮件：未知邮箱也返回成功，避免枚举 */
export async function resendVerification(data: { email: string }) {
  if (!isNestAuthEnabled()) {
    return request<ApiResponse<{ accepted: boolean }>>('/api/auth/resend-verification', {
      method: 'POST',
      data,
      skipErrorHandler: true,
    });
  }

  const res = await request<NestEnvelope<NestAccepted>>('/api/v1/auth/resend-verification', {
    method: 'POST',
    data,
    skipErrorHandler: true,
  });
  return toApiResponse(res.data, res.requestId);
}

export { nestError, nestHttpStatus };

export interface AuthSessionItem {
  id: string;
  deviceName: string;
  browser: string;
  ipMasked: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

/** 申请一次性登录验证码 */
export async function createCaptchaChallenge(data: { email: string }) {
  const res = await request<
    NestEnvelope<{ challengeId: string; imageSvg: string; expiresIn: number }>
  >('/api/v1/auth/captcha-challenges', {
    method: 'POST',
    data,
    skipErrorHandler: true,
  });
  return toApiResponse(res.data, res.requestId);
}

/** 当前账号活跃会话 */
export async function fetchAuthSessions() {
  const res = await request<NestEnvelope<AuthSessionItem[]>>('/api/v1/auth/sessions', {
    skipErrorHandler: true,
  });
  return toApiResponse(res.data, res.requestId);
}

/** 撤销指定非当前会话 */
export async function revokeAuthSession(sessionId: string) {
  const res = await request<NestEnvelope<{ revoked: boolean }>>(
    `/api/v1/auth/sessions/${sessionId}`,
    {
      method: 'DELETE',
      skipErrorHandler: true,
    },
  );
  return toApiResponse(res.data, res.requestId);
}

/** 撤销其它会话；keepCurrent 默认 true */
export async function revokeOtherAuthSessions() {
  const res = await request<NestEnvelope<{ revokedCount: number }>>(
    '/api/v1/auth/sessions/revoke-all',
    {
      method: 'POST',
      data: { keepCurrent: true },
      skipErrorHandler: true,
    },
  );
  return toApiResponse(res.data, res.requestId);
}

/** 忘记密码：始终成功，避免枚举邮箱 */
export async function forgotPassword(data: { email: string }) {
  const res = await request<NestEnvelope<NestAccepted>>('/api/v1/auth/forgot-password', {
    method: 'POST',
    data,
    skipErrorHandler: true,
  });
  return toApiResponse(res.data, res.requestId);
}

/** 消费重置链接 Token */
export async function resetPassword(data: { token: string; newPassword: string }) {
  const res = await request<NestEnvelope<{ passwordReset: boolean }>>(
    '/api/v1/auth/reset-password',
    {
      method: 'POST',
      data,
      skipErrorHandler: true,
    },
  );
  return toApiResponse(res.data, res.requestId);
}

export interface NestAdminUser {
  id: string;
  email: string;
  nickname: string | null;
  role: string;
  status: string;
  createdAt: string;
}

export interface NestAdminUserPage {
  list: NestAdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

/** 后台只读用户列表 */
export async function fetchNestAdminUsers(params: {
  current?: number;
  pageSize?: number;
  email?: string;
}) {
  const res = await request<NestEnvelope<NestAdminUserPage>>('/api/v1/admin/users', {
    params: {
      page: params.current,
      pageSize: params.pageSize,
      email: params.email,
    },
    skipErrorHandler: true,
  });
  return toApiResponse(res.data, res.requestId);
}

/** 后台查看指定用户会话 */
export async function fetchNestAdminUserSessions(userId: string) {
  const res = await request<NestEnvelope<AuthSessionItem[]>>(
    `/api/v1/admin/users/${userId}/sessions`,
    { skipErrorHandler: true },
  );
  return toApiResponse(res.data, res.requestId);
}

/** 管理员踢指定用户全部设备 */
export async function revokeNestAdminUserSessions(userId: string) {
  const res = await request<NestEnvelope<{ revokedCount: number }>>(
    `/api/v1/admin/users/${userId}/sessions/revoke-all`,
    {
      method: 'POST',
      skipErrorHandler: true,
    },
  );
  return toApiResponse(res.data, res.requestId);
}

/** 修改密码；成功后服务端会撤销全部会话 */
export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const res = await request<NestEnvelope<{ passwordChanged: boolean }>>(
    '/api/v1/auth/change-password',
    {
      method: 'POST',
      data,
      skipErrorHandler: true,
    },
  );
  clearAuthSession();
  return toApiResponse(res.data, res.requestId);
}
