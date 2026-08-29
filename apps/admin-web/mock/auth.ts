/**
 * 认证与用户 mock 接口
 */
import type { Request, Response } from 'express';
import { UserRole } from '@personal-hub/shared-types';
import { accounts, buildUser, setCurrentRole, getCurrentUser } from './data/users';
import { buildMenu } from './data/menus';
import { restoreRoleFromToken } from './session';
import { ok, fail, waitTime } from './utils';

export default {
  'POST /api/auth/login': async (req: Request, res: Response) => {
    await waitTime();
    const { email, password } = req.body || {};
    const account = accounts.find((a) => a.email === email && a.password === password);
    if (!account) {
      fail(res, 401, '账号或密码错误');
      return;
    }
    setCurrentRole(account.role);
    const user = buildUser(account.role);
    ok(res, { token: `mock-token-${account.role}`, user });
  },

  'POST /api/auth/logout': (_req: Request, res: Response) => {
    setCurrentRole(null);
    ok(res, null);
  },

  'GET /api/auth/current-user': (req: Request, res: Response) => {
    restoreRoleFromToken(req);
    const user = getCurrentUser();
    if (!user) {
      fail(res, 401, '未登录');
      return;
    }
    ok(res, user);
  },

  'GET /api/auth/permissions': (req: Request, res: Response) => {
    restoreRoleFromToken(req);
    const user = getCurrentUser();
    ok(res, { permissions: user?.permissions ?? [], menu: buildMenu(user?.role ?? null) });
  },

  'POST /api/auth/register': async (_req: Request, res: Response) => {
    await waitTime();
    ok(res, { accepted: true });
  },

  'POST /api/auth/verify-email': async (_req: Request, res: Response) => {
    await waitTime();
    fail(res, 400, 'Mock 模式不支持邮箱验证，请关闭 UMI_APP_NEST_AUTH=0');
  },

  'POST /api/auth/resend-verification': async (_req: Request, res: Response) => {
    await waitTime();
    ok(res, { accepted: true });
  },

  /** 调试用：快速切换角色 */
  'POST /api/auth/switch-role': (req: Request, res: Response) => {
    const { role } = req.body || {};
    if (!Object.values(UserRole).includes(role)) {
      fail(res, 400, '非法角色');
      return;
    }
    setCurrentRole(role);
    ok(res, buildUser(role));
  },
};
