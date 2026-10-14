-- CreateTable
CREATE TABLE "metric_rollup_state" (
    "id" INTEGER NOT NULL,
    "closed_before" TIMESTAMPTZ(6) NOT NULL,
    "hours_since" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "metric_rollup_state_pkey" PRIMARY KEY ("id")
);

-- 以下为已有性能数据的迁移回填。
INSERT INTO "metric_rollup_state" ("id", "closed_before", "hours_since")
SELECT 1,
  COALESCE(MAX(bucket_start) + INTERVAL '1 hour', TIMESTAMPTZ '1970-01-01 00:00:00+00'),
  COALESCE(date_trunc('day', MIN(bucket_start) AT TIME ZONE 'UTC') AT TIME ZONE 'UTC', TIMESTAMPTZ '1970-01-01 00:00:00+00')
FROM (
  SELECT bucket_start FROM metric_http_hours
  UNION ALL SELECT bucket_start FROM metric_vital_hours
) hours;

-- 兼容已执行上一条迁移的开发库：补齐现存小时对应的日行（包括今天）。
INSERT INTO metric_http_days (bucket_date, method, route_template, status_class, histogram, count)
SELECT bucket_date, method, route_template, status_class, jsonb_object_agg(edge, n), SUM(n)::integer
FROM (
  SELECT (bucket_start AT TIME ZONE 'UTC')::date AS bucket_date, method, route_template, status_class, edge, SUM(value::bigint) AS n
  FROM metric_http_hours, jsonb_each_text(histogram) AS buckets(edge, value)
  GROUP BY bucket_date, method, route_template, status_class, edge
) counts
GROUP BY bucket_date, method, route_template, status_class
ON CONFLICT (bucket_date, method, route_template, status_class) DO UPDATE SET histogram = EXCLUDED.histogram, count = EXCLUDED.count;
INSERT INTO metric_vital_days (bucket_date, route_template, metric, histogram, count)
SELECT bucket_date, route_template, metric, jsonb_object_agg(edge, n), SUM(n)::integer
FROM (
  SELECT (bucket_start AT TIME ZONE 'UTC')::date AS bucket_date, route_template, metric, edge, SUM(value::bigint) AS n
  FROM metric_vital_hours, jsonb_each_text(histogram) AS buckets(edge, value)
  GROUP BY bucket_date, route_template, metric, edge
) counts
GROUP BY bucket_date, route_template, metric
ON CONFLICT (bucket_date, route_template, metric) DO UPDATE SET histogram = EXCLUDED.histogram, count = EXCLUDED.count;
