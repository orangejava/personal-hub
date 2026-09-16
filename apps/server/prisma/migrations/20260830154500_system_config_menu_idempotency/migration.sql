-- M3：运营配置表、菜单展示字段、HTTP 幂等记录。
ALTER TABLE "menus" ADD COLUMN "locale_key" VARCHAR(160);
ALTER TABLE "menus" ADD COLUMN "icon" VARCHAR(80);
ALTER TABLE "menus" ADD COLUMN "open_in_new_tab" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "menus" ADD COLUMN "remark" VARCHAR(500);

CREATE TABLE "system_configs" (
    "key" VARCHAR(80) NOT NULL,
    "group" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "system_configs_group_idx" ON "system_configs"("group");

ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject_type" VARCHAR(40) NOT NULL,
    "subject_id_or_hash" VARCHAR(128) NOT NULL,
    "http_method" VARCHAR(16) NOT NULL,
    "path_hash" VARCHAR(64) NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "request_fingerprint" VARCHAR(64) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_records_subject_key" ON "idempotency_records"("subject_type", "subject_id_or_hash", "http_method", "path_hash", "idempotency_key");
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");
