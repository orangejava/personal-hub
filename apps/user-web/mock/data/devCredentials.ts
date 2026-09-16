/**
 * 本地开发 mock 账号（仅 dev/mock 环境使用，勿用于生产）
 * 文档：[../../../../docs/engineering/dev-credentials.md](../../../../docs/engineering/dev-credentials.md)
 */
import { UserRole } from '@personal-hub/shared-types';

export type DevAccount = {
  email: string;
  password: string;
  role: UserRole;
  roleLabel: string;
};

/** mock 登录账号表：admin 使用强随机密码，editor/member 使用固定开发密码 */
export const DEV_MOCK_ACCOUNTS: DevAccount[] = [
  {
    email: 'admin@example.com',
    password: 'yyQhItHlRe8Q9suV',
    role: UserRole.Admin,
    roleLabel: '管理员',
  },
  {
    email: 'editor@example.com',
    password: 'dev123456',
    role: UserRole.Editor,
    roleLabel: '编辑者',
  },
  {
    email: 'member@example.com',
    password: 'dev123456',
    role: UserRole.Member,
    roleLabel: '普通会员',
  },
];
