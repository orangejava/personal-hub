import type { MetricsOverview, MetricsRange } from '@personal-hub/shared-types';
import { request } from '@umijs/max';

/** 全站聚合。拦截器已解出业务对象，失败走全局 toast。 */
export async function fetchMetricsOverview(range: MetricsRange): Promise<MetricsOverview> {
  return request<MetricsOverview>('/api/v1/metrics/overview', {
    params: { range },
  });
}
