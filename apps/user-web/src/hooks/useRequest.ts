import { useRequest as useUmiRequest } from '@umijs/max';

type UseBizRequestOptions<T> = {
  manual?: boolean;
  ready?: boolean;
  refreshDeps?: unknown[];
  refreshOnWindowFocus?: boolean;
  onSuccess?: (data: T, params?: unknown[]) => void;
  onError?: (error: Error) => void;
};

/**
 * Umi 4 的 useRequest 硬编码 `formatResult: r => r.data`。
 * 全局拦截器已经把 Nest / mock 解成业务对象 T；若不覆盖，页面拿到的 data 会是 undefined。
 */
export function useRequest<T>(
  service: (...args: any[]) => Promise<T>,
  options?: UseBizRequestOptions<T>,
) {
  return useUmiRequest(service as never, {
    ...(options as object),
    formatResult: (result: T) => result,
  } as never) as unknown as {
    data?: T;
    loading: boolean;
    error?: Error;
    run: (...args: any[]) => Promise<T>;
    refresh: () => Promise<T>;
    mutate: (data?: T | ((old?: T) => T)) => void;
  };
}
