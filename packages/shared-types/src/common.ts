/**
 * 通用响应与分页结构
 */

/** 后端统一响应外壳，mock 与真实 API 都遵循此结构 */
export interface ApiResponse<T = unknown> {
  /** 业务状态码，0 表示成功，其余为业务错误码 */
  code: number;
  /** 提示信息，成功为 'ok'，失败为可展示文案 */
  message: string;
  /** 业务数据 */
  data: T;
  /** 链路追踪 ID，便于排障，可选 */
  requestId?: string;
}

/** 分页查询参数 */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  /** 排序字段，例如 'createdAt' */
  sort?: string;
  /** 排序方向 */
  order?: 'asc' | 'desc';
}

/** 分页返回结构 */
export interface PaginationResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
