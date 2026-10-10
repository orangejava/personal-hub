import { toApiRouteTemplate } from '@/utils/perf/routeTemplate';
import { pushApiSample } from '@/utils/perf/store';

interface PerfTimingConfig {
  method?: string;
  url?: string;
  phPerfId?: string;
}

interface PendingApi {
  method: string;
  url: string;
  startedAt: number;
}

const pending = new Map<string, PendingApi>();
let sequence = 0;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * 在请求发出前记下开始时间。
 * 计时字段只留在请求配置上，不放进 headers，避免发到服务端。
 */
export function beginApiTiming<T extends PerfTimingConfig>(config: T): T & { phPerfId: string } {
  sequence += 1;
  const phPerfId = `p${sequence}`;
  pending.set(phPerfId, {
    method: (config.method || 'GET').toUpperCase(),
    url: config.url || '',
    startedAt: now(),
  });
  if (pending.size > 500) {
    const oldest = pending.keys().next().value;
    if (oldest) pending.delete(oldest);
  }
  return { ...config, phPerfId };
}

/**
 * 记录最终成败。成功解包后的业务对象不算失败。
 * 同一请求只记一次，响应拦截器和错误处理重复调用时后者无效。
 */
export function finishApiTiming(
  config: PerfTimingConfig | undefined,
  outcome: { ok: boolean },
): void {
  const id = config?.phPerfId;
  if (!id) return;
  const started = pending.get(id);
  if (!started) return;
  pending.delete(id);
  pushApiSample({
    method: started.method,
    route: toApiRouteTemplate(started.url),
    duration: Math.max(0, now() - started.startedAt),
    ok: outcome.ok,
    at: Date.now(),
  });
}
