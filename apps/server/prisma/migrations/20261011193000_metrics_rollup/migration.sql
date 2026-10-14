-- 全站性能汇总。分钟计数在 Redis，这里只存小时、日和发布标记。

CREATE TABLE "metric_http_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bucket_start" TIMESTAMPTZ(6) NOT NULL,
    "method" VARCHAR(16) NOT NULL,
    "route_template" VARCHAR(200) NOT NULL,
    "status_class" VARCHAR(8) NOT NULL,
    "histogram" JSONB NOT NULL,
    "count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metric_http_hours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metric_http_hours_bucket_key" ON "metric_http_hours"("bucket_start", "method", "route_template", "status_class");
CREATE INDEX "metric_http_hours_bucket_start_idx" ON "metric_http_hours"("bucket_start");

CREATE TABLE "metric_vital_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bucket_start" TIMESTAMPTZ(6) NOT NULL,
    "route_template" VARCHAR(200) NOT NULL,
    "metric" VARCHAR(16) NOT NULL,
    "histogram" JSONB NOT NULL,
    "count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metric_vital_hours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metric_vital_hours_bucket_key" ON "metric_vital_hours"("bucket_start", "route_template", "metric");
CREATE INDEX "metric_vital_hours_bucket_start_idx" ON "metric_vital_hours"("bucket_start");

CREATE TABLE "metric_http_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bucket_date" DATE NOT NULL,
    "method" VARCHAR(16) NOT NULL,
    "route_template" VARCHAR(200) NOT NULL,
    "status_class" VARCHAR(8) NOT NULL,
    "histogram" JSONB NOT NULL,
    "count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metric_http_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metric_http_days_bucket_key" ON "metric_http_days"("bucket_date", "method", "route_template", "status_class");
CREATE INDEX "metric_http_days_bucket_date_idx" ON "metric_http_days"("bucket_date");

CREATE TABLE "metric_vital_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bucket_date" DATE NOT NULL,
    "route_template" VARCHAR(200) NOT NULL,
    "metric" VARCHAR(16) NOT NULL,
    "histogram" JSONB NOT NULL,
    "count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metric_vital_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metric_vital_days_bucket_key" ON "metric_vital_days"("bucket_date", "route_template", "metric");
CREATE INDEX "metric_vital_days_bucket_date_idx" ON "metric_vital_days"("bucket_date");

CREATE TABLE "deploy_markers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "git_sha" VARCHAR(64) NOT NULL,
    "deployed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" VARCHAR(200),
    CONSTRAINT "deploy_markers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deploy_markers_git_sha_key" ON "deploy_markers"("git_sha");
CREATE INDEX "deploy_markers_deployed_at_idx" ON "deploy_markers"("deployed_at");
