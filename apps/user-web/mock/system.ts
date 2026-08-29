/**
 * 系统配置 mock 接口
 */
import type { Request, Response } from 'express';
import { systemConfig } from './data/system-config';
import { ok } from './utils';

export default {
  'GET /api/system/config/public': (_req: Request, res: Response) => {
    ok(res, systemConfig);
  },
  'GET /api/system/theme': (_req: Request, res: Response) => {
    ok(res, systemConfig.theme);
  },
};
