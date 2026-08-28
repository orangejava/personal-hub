import type { RequestOptions } from '@@/plugin-request/request';
import type { ApiResponse } from '@personal-hub/shared-types';
import type { RequestConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { message, notification } from 'antd';
import {
  getAccessToken,
  getMockBridgeToken,
  isNestAuthEnabled,
} from '@/auth/session';

/**
 * 请求错误处理
 * 与后端统一响应 ApiResponse<T> 对齐：code !== 0 视为业务错误
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

  responseInterceptors: [],
};
