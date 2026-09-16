/**
 * Mock 公共工具
 */
import type { Response } from 'express';
import type { ApiResponse } from '@personal-hub/shared-types';

/** 模拟网络延迟 */
export const waitTime = (ms = 200): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** 统一成功响应 */
export function ok<T>(res: Response, data: T, message = 'ok'): void {
  const body: ApiResponse<T> = { code: 0, message, data };
  res.send(body);
}

/** 统一失败响应 */
export function fail(
  res: Response,
  code: number,
  message: string,
  data: unknown = null,
): void {
  const body: ApiResponse = { code, message, data };
  // mock 阶段统一用业务 code 表达可预期失败，避免开发态把业务校验打印成网络异常。
  res.status(200).send(body);
}

/** 从查询参数解析分页 */
export function parsePagination(req: { query: Record<string, unknown> }) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.max(1, Number(req.query.pageSize) || 10);
  return { page, pageSize };
}
