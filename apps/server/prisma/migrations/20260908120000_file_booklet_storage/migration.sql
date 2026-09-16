-- 文件资产、预签名上传、小册导入任务、CLI 迁移记录、Outbox。

CREATE TYPE "FilePurpose" AS ENUM ('AVATAR', 'COVER', 'CONTENT_FILE', 'BOOKLET_SOURCE', 'TEMPORARY_IMPORT', 'AI_ASSET');
CREATE TYPE "FileAssetStatus" AS ENUM ('UPLOADING', 'PENDING_VALIDATION', 'READY', 'FAILED', 'DELETED');
CREATE TYPE "FileScanStatus" AS ENUM ('NONE', 'PENDING', 'CLEAN', 'BLOCKED');
CREATE TYPE "StorageProviderKind" AS ENUM ('MINIO', 'COS');
CREATE TYPE "UploadMode" AS ENUM ('SINGLE', 'MULTIPART');
CREATE TYPE "BookletImportStatus" AS ENUM ('QUEUED', 'VALIDATING', 'IMPORTING', 'SUCCEEDED', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELED');

CREATE TABLE "file_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uploader_id" UUID NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "storage_provider" "StorageProviderKind" NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" CHAR(64),
    "purpose" "FilePurpose" NOT NULL,
    "status" "FileAssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "scan_status" "FileScanStatus" NOT NULL DEFAULT 'NONE',
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_assets_object_key_key" ON "file_assets"("object_key");
CREATE INDEX "file_assets_uploader_id_created_at_idx" ON "file_assets"("uploader_id", "created_at");
CREATE INDEX "file_assets_purpose_status_deleted_at_idx" ON "file_assets"("purpose", "status", "deleted_at");

ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "upload_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uploader_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "upload_mode" "UploadMode" NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "multipart_upload_id" VARCHAR(255),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "upload_sessions_uploader_id_idempotency_key_key" ON "upload_sessions"("uploader_id", "idempotency_key");
CREATE INDEX "upload_sessions_file_id_idx" ON "upload_sessions"("file_id");

ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "booklet_import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requester_id" UUID NOT NULL,
    "source_file_id" UUID NOT NULL,
    "content_id" UUID,
    "status" "BookletImportStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total_chapters" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB,
    "failed_items" JSONB,
    "error_code" VARCHAR(80),
    "error_message" VARCHAR(500),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booklet_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booklet_import_jobs_requester_id_idempotency_key_key" ON "booklet_import_jobs"("requester_id", "idempotency_key");
CREATE INDEX "booklet_import_jobs_status_created_at_idx" ON "booklet_import_jobs"("status", "created_at");

ALTER TABLE "booklet_import_jobs" ADD CONSTRAINT "booklet_import_jobs_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booklet_import_jobs" ADD CONSTRAINT "booklet_import_jobs_source_file_id_fkey" FOREIGN KEY ("source_file_id") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booklet_import_jobs" ADD CONSTRAINT "booklet_import_jobs_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "migration_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operator_id" UUID NOT NULL,
    "source_path" VARCHAR(1024) NOT NULL,
    "source_digest" VARCHAR(128) NOT NULL,
    "dry_run" BOOLEAN NOT NULL DEFAULT true,
    "summary" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "migration_runs_source_digest_idx" ON "migration_runs"("source_digest");
ALTER TABLE "migration_runs" ADD CONSTRAINT "migration_runs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(6),
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_events_dispatched_at_occurred_at_idx" ON "outbox_events"("dispatched_at", "occurred_at");

ALTER TABLE "contents" ADD CONSTRAINT "contents_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contents" ADD CONSTRAINT "contents_primary_file_id_fkey" FOREIGN KEY ("primary_file_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
