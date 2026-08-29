import type {
  ApiResponse,
  LoginParams,
  LoginResult,
  MenuItem,
  PermissionCode,
  User,
} from '@personal-hub/shared-types';
import type { AuthHttpRequest, NestEnvelope } from './http';
import { nestError, nestHttpStatus, toApiResponse } from './http';
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
 */
export function createAuthApi(options: CreateAuthApiOptions) {
  const { request, mapMenus } = options;

  async function login(data: LoginParams) {
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

  async function refreshAccessToken(): Promise<boolean> {
    if (!isNestAuthEnabled()) {
      return false;
    }
    try {
      const res = await request<NestEnvelope<NestLoginData>>(
        '/api/v1/auth/refresh',
        {
          method: 'POST',
          skipErrorHandler: true,
        },
      );
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

  async function logout() {
    if (!isNestAuthEnabled()) {
      return request<ApiResponse<null>>('/api/auth/logout', { method: 'POST' });
    }
    await request('/api/v1/auth/logout', {
      method: 'POST',
      skipErrorHandler: true,
    });
    return toApiResponse(null);
  }

  async function fetchCurrentUser(opts?: { skipErrorHandler?: boolean }) {
    if (!isNestAuthEnabled()) {
      return request<ApiResponse<User>>('/api/auth/current-user', {
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

    const res = await request<NestEnvelope<NestLoginData['user']>>(
      '/api/v1/auth/me',
      {
        skipErrorHandler: opts?.skipErrorHandler ?? true,
      },
    );
    const user = mapNestUser(res.data);
    setMockBridgeRole(user.role);
    return toApiResponse(user, res.requestId);
  }

  async function fetchPermissions() {
    if (!isNestAuthEnabled()) {
      return request<ApiResponse<PermissionPayload>>('/api/auth/permissions');
    }

    const res = await request<NestEnvelope<NestPermissionSnapshot>>(
      '/api/v1/auth/permissions',
      {
        skipErrorHandler: true,
      },
    );
    const adapted = adaptNestPermissions(res.data, mapMenus);
    return toApiResponse<PermissionPayload>(
      {
        permissions: adapted.permissions,
        permissionGrants: adapted.permissionGrants,
        menu: adapted.menu,
      },
      res.requestId,
    );
  }

  async function register(data: {
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

    const res = await request<NestEnvelope<NestAccepted>>(
      '/api/v1/auth/register',
      {
        method: 'POST',
        data,
        skipErrorHandler: true,
      },
    );
    return toApiResponse(res.data, res.requestId);
  }

  async function verifyEmail(data: { token: string }) {
    if (!isNestAuthEnabled()) {
      return request<ApiResponse<{ verified: boolean }>>(
        '/api/auth/verify-email',
        {
          method: 'POST',
          data,
          skipErrorHandler: true,
        },
      );
    }

    const res = await request<NestEnvelope<NestVerified>>(
      '/api/v1/auth/verify-email',
      {
        method: 'POST',
        data,
        skipErrorHandler: true,
      },
    );
    return toApiResponse(res.data, res.requestId);
  }

  async function resendVerification(data: { email: string }) {
    if (!isNestAuthEnabled()) {
      return request<ApiResponse<{ accepted: boolean }>>(
        '/api/auth/resend-verification',
        {
          method: 'POST',
          data,
          skipErrorHandler: true,
        },
      );
    }

    const res = await request<NestEnvelope<NestAccepted>>(
      '/api/v1/auth/resend-verification',
      {
        method: 'POST',
        data,
        skipErrorHandler: true,
      },
    );
    return toApiResponse(res.data, res.requestId);
  }

  async function createCaptchaChallenge(data: { email: string }) {
    const res = await request<
      NestEnvelope<{ challengeId: string; imageSvg: string; expiresIn: number }>
    >('/api/v1/auth/captcha-challenges', {
      method: 'POST',
      data,
      skipErrorHandler: true,
    });
    return toApiResponse(res.data, res.requestId);
  }

  async function fetchAuthSessions() {
    const res = await request<NestEnvelope<AuthSessionItem[]>>(
      '/api/v1/auth/sessions',
      {
        skipErrorHandler: true,
      },
    );
    return toApiResponse(res.data, res.requestId);
  }

  async function revokeAuthSession(sessionId: string) {
    const res = await request<NestEnvelope<{ revoked: boolean }>>(
      `/api/v1/auth/sessions/${sessionId}`,
      {
        method: 'DELETE',
        skipErrorHandler: true,
      },
    );
    return toApiResponse(res.data, res.requestId);
  }

  async function revokeOtherAuthSessions() {
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

  async function forgotPassword(data: { email: string }) {
    const res = await request<NestEnvelope<NestAccepted>>(
      '/api/v1/auth/forgot-password',
      {
        method: 'POST',
        data,
        skipErrorHandler: true,
      },
    );
    return toApiResponse(res.data, res.requestId);
  }

  async function resetPassword(data: {
    token: string;
    newPassword: string;
  }) {
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

  async function fetchNestAdminUsers(params: {
    current?: number;
    pageSize?: number;
    email?: string;
  }) {
    const res = await request<NestEnvelope<NestAdminUserPage>>(
      '/api/v1/admin/users',
      {
        params: {
          page: params.current,
          pageSize: params.pageSize,
          email: params.email,
        },
        skipErrorHandler: true,
      },
    );
    return toApiResponse(res.data, res.requestId);
  }

  async function fetchNestAdminUserSessions(userId: string) {
    const res = await request<NestEnvelope<AuthSessionItem[]>>(
      `/api/v1/admin/users/${userId}/sessions`,
      { skipErrorHandler: true },
    );
    return toApiResponse(res.data, res.requestId);
  }

  async function revokeNestAdminUserSessions(userId: string) {
    const res = await request<NestEnvelope<{ revokedCount: number }>>(
      `/api/v1/admin/users/${userId}/sessions/revoke-all`,
      {
        method: 'POST',
        skipErrorHandler: true,
      },
    );
    return toApiResponse(res.data, res.requestId);
  }

  async function changePassword(data: {
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
