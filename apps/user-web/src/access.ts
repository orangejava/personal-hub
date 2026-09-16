/**
 * 权限判断
 * 基于 initialState.currentUser 的 permissions 数组生成访问函数
 */
import type { PermissionCode } from '@personal-hub/shared-types';
import type { InitialState } from '@/types/app';

export default function access(initialState: InitialState | undefined) {
  const permissions: PermissionCode[] =
    initialState?.currentUser?.permissions ?? [];
  const role = initialState?.currentUser?.role;

  /** 是否拥有某个权限点 */
  const can = (code: PermissionCode) => permissions.includes(code);

  return {
    canAdmin: role === 'admin' || can('admin:access'),
    // 工作区对所有已登录角色开放；动作权限仍由各页 access / PermissionGate 约束。
    canWorkspace:
      can('workspace:access') ||
      role === 'admin' ||
      role === 'editor' ||
      role === 'member',
    canWrite: can('content:write'),
    canPublish: can('content:publish'),
    canUseAi: can('ai:use'),
    /** 通用权限点判断，供 PermissionGate 使用 */
    can,
  };
}
