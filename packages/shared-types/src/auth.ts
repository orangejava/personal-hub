import { UserRole } from './user';
import { PermissionCode } from './permission';

/**
 * 认证与当前用户相关类型
 */

/** 登录请求参数 */
export interface LoginParams {
  email: string;
  password: string;
  challengeId?: string;
  captchaAnswer?: string;
}

/** 登录返回数据 */
export interface LoginResult {
  token: string;
  user: User;
}

/** 用户基本信息 */
export interface User {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
  role: UserRole;
  /** 当前用户拥有的权限点列表 */
  permissions: PermissionCode[];
  /** 账号是否启用 */
  status: 'active' | 'disabled';
  /** 临时密码首次登录后必须先改密 */
  mustChangePassword?: boolean;
  createdAt: string;
}

/** 当前登录态，存入 Umi @@initialState */
export interface AuthState {
  user: User | null;
  token: string | null;
}
