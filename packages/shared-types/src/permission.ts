/**
 * 权限点类型定义
 *
 * 当前 React-first mock 使用的权限点。前端用于菜单与按钮显隐，真实校验
 * 由后续 NestJS Guard 完成。新增权限时必须同步更新 mock 用户和 RBAC 文档，
 * 避免类型、页面和接口契约出现三套命名。
 */

/** 权限点字符串枚举 */
export type PermissionCode =
  | 'content:read'
  | 'content:write'
  | 'content:publish'
  | 'content:delete'
  | 'booklet:read'
  | 'booklet:write'
  | 'workspace:access'
  | 'admin:access'
  | 'user:manage'
  | 'role:manage'
  | 'ai:use'
  | 'ai:manage'
  | 'system:config';

/** 菜单项结构，供权限与布局层共享 */
export interface MenuItem {
  /** 路由路径 */
  path: string;
  /** 菜单名称 */
  name: string;
  /** 图标名，沿用 Ant Design 图标约定 */
  icon?: string;
  /** 访问所需权限点 */
  permissions?: PermissionCode[];
  /** 子菜单 */
  children?: MenuItem[];
}
