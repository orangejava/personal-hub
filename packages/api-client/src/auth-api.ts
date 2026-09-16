import type {
  LoginParams,
  LoginResult,
  MenuItem,
  PermissionCode,
  User,
} from '@personal-hub/shared-types';
import type { AuthHttpRequest } from './http';
import { nestHttpStatus, readNestData } from './http';
import { mapNestUser } from './mapNestUser';
import {
  adaptNestPermissions,
  type MapNestMenus,
  type NestPermissionSnapshot,
} from './permissions';
import {
  clearAuthSession,
  getAccessToken,
  isNestAuthEnabled,
  setAccessToken,
  setMockBridgeRole,
} from './session';

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

interface NestAccepted {
  accepted: boolean;
}

interface NestVerified {
  verified: boolean;
}

function rememberNestLogin(data: NestLoginData): LoginResult {
  const user = mapNestUser(data.user);
  setAccessToken(data.accessToken);
  setMockBridgeRole(user.role);
  return { token: data.accessToken, user };
}

export interface AuthSessionItem {
  id: string;
  deviceName: string;
  browser: string;
  ipMasked: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
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

interface PermissionPayload {
  permissions: PermissionCode[];
  permissionGrants?: Array<{ code: string; dataScope: 'OWN' | 'ALL' }>;
  menu: MenuItem[];
}

export interface CreateAuthApiOptions {
  request: AuthHttpRequest;
  mapMenus: MapNestMenus;
}

/**
 * 创建 Auth API。HTTP 与菜单映射由各 app 注入，避免本包依赖 Umi。
 * 调用方拿到的已是业务对象（Umi 拦截器解包）；失败 throw。
 */
export function createAuthApi(options: CreateAuthApiOptions) {
  const { request, mapMenus } = options;

  async function login(data: LoginParams): Promise<LoginResult> {
    if (!isNestAuthEnabled()) {
      return request<LoginResult>('/api/auth/login', {
        method: 'POST',
        data,
      });
    }

    const payload = readNestData(
      await request<NestLoginData>('/api/v1/auth/login', {
        method: 'POST',
        data,
        skipErrorHandler: true,
      }),
    );
    return rememberNestLogin(payload);
  }

  async function refreshAccessToken(): Promise<boolean> {
    if (!isNestAuthEnabled()) {
      return false;
    }
    try {
      const payload = readNestData(
        await request<NestLoginData>('/api/v1/auth/refresh', {
          method: 'POST',
          skipErrorHandler: true,
        }),
      );
      rememberNestLogin(payload);
      return true;
    } catch (error: unknown) {
      if (nestHttpStatus(error) === 401) {
        clearAuthSession();
        return false;
      }
      throw error;
    }
  }

  async function logout(): Promise<null> {
    if (!isNestAuthEnabled()) {
      return request<null>('/api/auth/logout', { method: 'POST' });
    }
    await request('/api/v1/auth/logout', {
      method: 'POST',
      skipErrorHandler: true,
    });
    return null;
  }

  async function fetchCurrentUser(opts?: { skipErrorHandler?: boolean }): Promise<User> {
    if (!isNestAuthEnabled()) {
      return request<User>('/api/auth/current-user', {
        skipErrorHandler: opts?.skipErrorHandler,
      });
    }

    if (!getAccessToken()) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        const error = new Error('未登录');
        (error as Error & { response?: { status: number } }).response = {
          status: 401,
        };
        throw error;
      }
    }

    const payload = readNestData(
      await request<NestLoginData['user']>('/api/v1/auth/me', {
        skipErrorHandler: opts?.skipErrorHandler ?? true,
      }),
    );
    const user = mapNestUser(payload);
    setMockBridgeRole(user.role);
    return user;
  }

  async function fetchPermissions(): Promise<PermissionPayload> {
    if (!isNestAuthEnabled()) {
      return request<PermissionPayload>('/api/auth/permissions');
    }

    const snapshot = readNestData(
      await request<NestPermissionSnapshot>('/api/v1/auth/permissions', {
        skipErrorHandler: true,
      }),
    );
    const adapted = adaptNestPermissions(snapshot, mapMenus);
    return {
      permissions: adapted.permissions,
      permissionGrants: adapted.permissionGrants,
      menu: adapted.menu,
    };
  }

  async function register(data: {
    email: string;
    password: string;
    nickname?: string;
  }): Promise<NestAccepted> {
    if (!isNestAuthEnabled()) {
      return request<NestAccepted>('/api/auth/register', {
        method: 'POST',
        data,
        skipErrorHandler: true,
      });
    }

    return readNestData(
      await request<NestAccepted>('/api/v1/auth/register', {
        method: 'POST',
        data,
        skipErrorHandler: true,
      }),
    );
  }

  async function verifyEmail(data: { token: string }): Promise<NestVerified> {
    if (!isNestAuthEnabled()) {
      return request<NestVerified>('/api/auth/verify-email', {
        method: 'POST',
        data,
        skipErrorHandler: true,
      });
    }

    return readNestData(
      await request<NestVerified>('/api/v1/auth/verify-email', {
        method: 'POST',
        data,
        skipErrorHandler: true,
      }),
    );
  }

  async function resendVerification(data: { email: string }): Promise<NestAccepted> {
    if (!isNestAuthEnabled()) {
      return request<NestAccepted>('/api/auth/resend-verification', {
        method: 'POST',
        data,
        skipErrorHandler: true,
      });
    }

    return readNestData(
      await request<NestAccepted>('/api/v1/auth/resend-verification', {
        method: 'POST',
        data,
        skipErrorHandler: true,
      }),
    );
  }

  async function createCaptchaChallenge(data: { email: string }) {
    return readNestData(
      await request<{ challengeId: string; imageSvg: string; expiresIn: number }>(
        '/api/v1/auth/captcha-challenges',
        {
          method: 'POST',
          data,
          skipErrorHandler: true,
        },
      ),
    );
  }

  async function fetchAuthSessions() {
    return readNestData(
      await request<AuthSessionItem[]>('/api/v1/auth/sessions', {
        skipErrorHandler: true,
      }),
    );
  }

  async function revokeAuthSession(sessionId: string) {
    return readNestData(
      await request<{ revoked: boolean }>(`/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        skipErrorHandler: true,
      }),
    );
  }

  async function revokeOtherAuthSessions() {
    return readNestData(
      await request<{ revokedCount: number }>('/api/v1/auth/sessions/revoke-all', {
        method: 'POST',
        data: { keepCurrent: true },
        skipErrorHandler: true,
      }),
    );
  }

  async function forgotPassword(data: { email: string }) {
    return readNestData(
      await request<NestAccepted>('/api/v1/auth/forgot-password', {
        method: 'POST',
        data,
        skipErrorHandler: true,
      }),
    );
  }

  async function resetPassword(data: { token: string; newPassword: string }) {
    return readNestData(
      await request<{ passwordReset: boolean }>('/api/v1/auth/reset-password', {
        method: 'POST',
        data,
        skipErrorHandler: true,
      }),
    );
  }

  async function fetchNestAdminUsers(params: {
    current?: number;
    pageSize?: number;
    email?: string;
  }) {
    return readNestData(
      await request<NestAdminUserPage>('/api/v1/admin/users', {
        params: {
          page: params.current,
          pageSize: params.pageSize,
          email: params.email,
        },
        skipErrorHandler: true,
      }),
    );
  }

  async function fetchNestAdminUserSessions(userId: string) {
    return readNestData(
      await request<AuthSessionItem[]>(`/api/v1/admin/users/${userId}/sessions`, {
        skipErrorHandler: true,
      }),
    );
  }

  async function revokeNestAdminUserSessions(userId: string) {
    return readNestData(
      await request<{ revokedCount: number }>(
        `/api/v1/admin/users/${userId}/sessions/revoke-all`,
        {
          method: 'POST',
          skipErrorHandler: true,
        },
      ),
    );
  }

  async function changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }) {
    const result = readNestData(
      await request<{ passwordChanged: boolean }>('/api/v1/auth/change-password', {
        method: 'POST',
        data,
        skipErrorHandler: true,
      }),
    );
    clearAuthSession();
    return result;
  }

  return {
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
  };
}
