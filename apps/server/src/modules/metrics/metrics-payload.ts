import pages from '@personal-hub/shared-types/metrics-pages.json';
import { z } from 'zod';
import {
  CLS_BUCKETS,
  DURATION_BUCKETS,
  VITAL_METRICS,
  bucketFor,
  type VitalMetric,
} from './metrics-histogram';

/** JSON 可直接被 Nest 的 CommonJS 产物和前端构建器加载。 */
export const REPORTABLE_PAGE_TEMPLATES = new Set(pages.map((page) => page.template));

const routeSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^\/[A-Za-z0-9/_:.-]*$/, '路由模板只能包含路径和占位符')
  .refine((route) => REPORTABLE_PAGE_TEMPLATES.has(route), '未知的页面模板');

const sampleSchema = z.object({
  metric: z.enum(VITAL_METRICS),
  value: z.number().finite().nonnegative(),
});

const bodySchema = z.object({
  route: routeSchema,
  samples: z.array(sampleSchema).min(1).max(VITAL_METRICS.length),
});

export interface VitalSampleInput {
  route: string;
  metric: VitalMetric;
  edge: number;
}

/**
 * 只收路由模板和五项指标。完整 URL、查询串和用户标识直接拒绝。
 */
export function parseVitalPayload(raw: unknown): VitalSampleInput[] {
  const body = bodySchema.parse(raw);
  const seen = new Set<string>();
  const samples: VitalSampleInput[] = [];
  for (const sample of body.samples) {
    if (seen.has(sample.metric)) continue;
    seen.add(sample.metric);
    if (sample.metric === 'CLS') {
      if (sample.value > 10) throw new Error('CLS 超出范围');
      samples.push({
        route: body.route,
        metric: sample.metric,
        edge: bucketFor(sample.value, CLS_BUCKETS),
      });
      continue;
    }
    if (sample.value > 120_000) throw new Error('耗时超出范围');
    samples.push({
      route: body.route,
      metric: sample.metric,
      edge: bucketFor(sample.value, DURATION_BUCKETS),
    });
  }
  return samples;
}
