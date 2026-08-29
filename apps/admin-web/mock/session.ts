/**
 * 从 Authorization Bearer mock-token-{role} 恢复会话角色
 */
import { UserRole } from '@personal-hub/shared-types';
import type { Request } from 'express';
import { setCurrentRole } from './data/users';

export function restoreRoleFromToken(req: Request): void {
  const raw = req.headers.authorization;
  if (!raw?.startsWith('Bearer ')) return;
  const token = raw.slice(7);
  if (!token.startsWith('mock-token-')) return;
  const role = token.replace('mock-token-', '') as UserRole;
  if (Object.values(UserRole).includes(role)) {
    setCurrentRole(role);
  }
}
