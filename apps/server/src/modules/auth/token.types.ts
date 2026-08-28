export interface AccessTokenPayload {
  sub: string;
  sid: string;
  av: number;
  pv: number;
}

export interface CachedAuthSession {
  userId: string;
  sessionId: string;
  /** 登录邮箱快照，仅方便查 Redis，不参与鉴权 */
  email: string;
  authVersion: number;
  permissionVersion: number;
  status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'DISABLED';
  mustChangePassword: boolean;
  expiresAt: string;
}

export interface AuthUserSummary {
  id: string;
  email: string;
  nickname: string | null;
  role: string;
  status: string;
  mustChangePassword: boolean;
  emailVerifiedAt: string | null;
  avatarFileId: string | null;
  bio: string | null;
  createdAt: string;
}

export interface AuthLoginResult {
  accessToken: string;
  expiresIn: number;
  user: AuthUserSummary;
  refreshToken: string;
}

export interface AuthPermissionSnapshot {
  permissions: Array<{ code: string; dataScope: 'OWN' | 'ALL' }>;
  menus: Array<{
    id: string;
    scope: string;
    type: string;
    name: string;
    routeKey: string | null;
    externalUrl: string | null;
    sortOrder: number;
    children: AuthPermissionSnapshot['menus'];
  }>;
}
