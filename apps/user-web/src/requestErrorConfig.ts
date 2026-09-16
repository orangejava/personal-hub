import type { RequestOptions } from '@@/plugin-request/request';
import type { ApiResponse } from '@personal-hub/shared-types';
import type { RequestConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { message, notification } from 'antd';
import {
  getAccessToken,
  getMockBridgeToken,
  isNestAuthEnabled,
} from '@personal-hub/api-client';

const NEST_ENVELOPE_KEYS = new Set(['data', 'requestId', 'error', 'success']);

/**
 * 拦截器内就地解包 / 读错误文案，不从 api-client 引入 unwrapHttpData、nestError。
 * Umi MFSU 会缓存共享包导出，新符号在热更新后经常是 undefined。
 *
 * 失败走 axios error.response，不会进上面的成功解包；BizError 只给遗留 mock `{ code !== 0 }`。
 */
function unwrapResponseData<T>(body: unknown): T {
  if (body != null && typeof body === 'object' && !Array.isArray(body) && 'code' in body) {
    const envelope = body as ApiResponse<T>;
    if (typeof envelope.code === 'number' && envelope.code !== 0) {
      const error: any = new Error(envelope.message || '请求失败');
      error.name = 'BizError';
      error.info = {
        code: envelope.code,
        message: envelope.message,
        data: envelope.data,
      };
      throw error;
    }
    if (typeof envelope.code === 'number') {
      return envelope.data as T;
    }
  }
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    const keys = Object.keys(body);
    if (keys.length > 0 && keys.every((key) => NEST_ENVELOPE_KEYS.has(key))) {
      return (body as { data: T }).data;
    }
  }
  return body as T;
}

/** 4xx 体仍是 `{ error: { message } }`；优先用后端文案，避免 axios 的 status 英文句。 */
function readNestErrorMessage(error: unknown): string | undefined {
  const data = (error as { response?: { data?: { error?: { message?: string } } } })?.response
    ?.data;
  const fromNest = data?.error?.message?.trim();
  return fromNest || undefined;
}

/**
 * 请求错误处理
 * Canonical：HTTP 2xx 由拦截器解包为业务对象 T；失败 throw。
 * Umi 4 没有 dataField；useRequest 二次拆 data 在 `@/hooks/useRequest` 覆盖。
 * skipErrorHandler 仅留给启动拉取、登录冷却等要自己画 UI 的调用。
 */
export const errorConfig: RequestConfig = {
  errorConfig: {
    errorThrower: (res) => {
      const body = res as unknown as ApiResponse;
      if (body && typeof body.code === 'number' && body.code !== 0) {
        const error: any = new Error(body.message || '请求失败');
        error.name = 'BizError';
        error.info = {
          code: body.code,
          message: body.message,
          data: body.data,
        };
        throw error;
      }
    },
    errorHandler: (error: any, opts: any) => {
      if (opts?.skipErrorHandler) throw error;

      if (error?.name === 'BizError') {
        const info = error.info as ApiResponse | undefined;
        if (info) {
          // 401 未登录：跳转登录页
          if (info.code === 401) {
            const { pathname, search, hash } = history.location;
            if (pathname !== '/user/login') {
              history.replace(
                `/user/login?redirect=${encodeURIComponent(pathname + search + hash)}`,
              );
            }
            return;
          }
          message.error(info.message);
        }
        return;
      }

      if (error?.response) {
        const status = error.response.status;
        if (status === 401) {
          history.replace('/user/login');
          return;
        }
        const nestMessage = readNestErrorMessage(error);
        if (nestMessage) {
          message.error(nestMessage);
          return;
        }
        notification.error({
          message: `请求失败 (${status})`,
          description: error.message,
        });
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        message.error('网络不可用，请检查连接后重试');
      } else if (error?.request) {
        message.error('服务器无响应，请重试');
      } else {
        message.error(error?.message || '请求异常，请重试');
      }
    },
  },

  requestInterceptors: [
    (config: RequestOptions) => {
      const headers: Record<string, string> = {
        ...((config.headers ?? {}) as Record<string, string>),
      };
      if (isNestAuthEnabled()) {
        const url = `${config.url ?? ''}`;
        const nestToken = getAccessToken();
        const mockToken = getMockBridgeToken();
        if (url.includes('/api/v1/') && nestToken) {
          headers.Authorization = `Bearer ${nestToken}`;
        } else if (!url.includes('/api/v1/') && mockToken) {
          headers.Authorization = `Bearer ${mockToken}`;
        }
      } else {
        const token = localStorage.getItem('ph-token');
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
      return {
        ...config,
        headers,
        credentials: 'include',
      };
    },
  ],

  responseInterceptors: [
    (response) => ({
      ...response,
      data: unwrapResponseData(response.data),
    }),
  ],
};
