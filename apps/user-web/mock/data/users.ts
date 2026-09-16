/**
 * Mock 用户数据：admin / editor / member 三角色
 */
import { DEV_MOCK_ACCOUNTS } from './devCredentials';
import { UserRole, type PermissionCode, type User } from '@personal-hub/shared-types';

const basePermissions: Record<UserRole, PermissionCode[]> = {
  [UserRole.Admin]: [
    'content:read',
    'content:write',
    'content:publish',
    'content:delete',
    'booklet:read',
    'booklet:write',
    'workspace:access',
    'admin:access',
    'user:manage',
    'role:manage',
    'ai:use',
    'ai:manage',
    'system:config',
  ],
  [UserRole.Editor]: [
    'content:read',
    'content:write',
    'content:publish',
    'booklet:read',
    'booklet:write',
    'workspace:access',
    'ai:use',
  ],
  [UserRole.Member]: ['content:read', 'booklet:read', 'ai:use'],
};

const profiles: Record<UserRole, Omit<User, 'permissions'>> = {
  [UserRole.Admin]: {
    id: 'u-admin',
    email: 'admin@example.com',
    nickname: '管理员',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Admin',
    role: UserRole.Admin,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
  },
  [UserRole.Editor]: {
    id: 'u-editor',
    email: 'editor@example.com',
    nickname: '编辑者',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Editor',
    role: UserRole.Editor,
    status: 'active',
    createdAt: '2026-02-01T00:00:00Z',
  },
  [UserRole.Member]: {
    id: 'u-member',
    email: 'member@example.com',
    nickname: '普通会员',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Member',
    role: UserRole.Member,
    status: 'active',
    createdAt: '2026-03-01T00:00:00Z',
  },
};

/** 账号密码表（与 mock/data/devCredentials.ts 同步） */
export const accounts: { email: string; password: string; role: UserRole }[] =
  DEV_MOCK_ACCOUNTS.map((a) => ({
    email: a.email,
    password: a.password,
    role: a.role,
  }));

/** 根据角色构造完整用户 */
export function buildUser(role: UserRole): User {
  return { ...profiles[role], permissions: basePermissions[role] };
}

/** 当前会话角色，内存态，供 mock 接口共享 */
let currentRole: UserRole | null = null;

export function setCurrentRole(role: UserRole | null): void {
  currentRole = role;
}

export function getCurrentUser(): User | null {
  return currentRole ? buildUser(currentRole) : null;
}
