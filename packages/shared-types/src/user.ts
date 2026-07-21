/**
 * 用户角色枚举
 */
export enum UserRole {
  Admin = 'admin',
  Editor = 'editor',
  Member = 'member',
}

/** 角色对应的中文标签，供 UI 展示 */
export const UserRoleLabel: Record<UserRole, string> = {
  [UserRole.Admin]: '管理员',
  [UserRole.Editor]: '编辑者',
  [UserRole.Member]: '普通会员',
};
