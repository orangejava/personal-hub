import { UserRole } from '@personal-hub/shared-types';

/**
 * Access Token 只放内存。页面刷新后靠 Refresh Cookie 换新令牌，避免 localStorage 被 XSS 读走。
 */
let accessToken: string | null = null;

/**
 * Nest 登录后，尚未迁移的 mock 接口仍认 `mock-token-{role}`。
 * 权限和菜单已改走 Nest；内容/后台 CRUD 仍用这层桥接。
 */
let mockBridgeRole: UserRole | null = null;

export function isNestAuthEnabled(): boolean {
  return process.env.UMI_APP_NEST_AUTH !== '0';
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getMockBridgeToken(): string | null {
  return mockBridgeRole ? `mock-token-${mockBridgeRole}` : null;
}

export function setMockBridgeRole(role: UserRole | null): void {
  mockBridgeRole = role;
}

export function clearAuthSession(): void {
  accessToken = null;
  mockBridgeRole = null;
  try {
    localStorage.removeItem('ph-token');
  } catch {
    // 隐私模式或服务端渲染时可能不可用
  }
}

export function mapNestRole(role: string): UserRole {
  if (role === 'EDITOR') return UserRole.Editor;
  if (role === 'MEMBER') return UserRole.Member;
  return UserRole.Admin;
}
