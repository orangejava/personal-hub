import type { User } from '@personal-hub/shared-types';
import { mapNestRole } from './session';

export interface NestAuthUser {
  id: string;
  email: string;
  nickname: string | null;
  role: string;
  status: string;
  mustChangePassword?: boolean;
  avatarFileId?: string | null;
  createdAt: string;
}

/**
 * 把 Canonical Nest 用户摘要转成当前 React 仍在使用的 User。
 * 权限点由 `/auth/permissions` 写入，这里先留空以免用角色表冒充服务端结果。
 */
export function mapNestUser(user: NestAuthUser): User {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname || user.email.split('@')[0],
    avatar: undefined,
    role: mapNestRole(user.role),
    permissions: [],
    status: user.status === 'ACTIVE' ? 'active' : 'disabled',
    mustChangePassword: user.mustChangePassword === true,
    createdAt: user.createdAt,
  };
}
