-- AlterEnum
ALTER TABLE "permissions" DROP CONSTRAINT "permissions_code_catalog_check";
ALTER TABLE "permissions"
  ADD CONSTRAINT "permissions_code_catalog_check"
  CHECK ("code" IN (
    'content:create', 'content:read', 'content:update', 'content:publish',
    'content:delete', 'content:restore', 'content:featured', 'content:purge',
    'booklet:import', 'category:manage', 'tag:manage', 'file:read',
    'file:delete', 'user:read', 'user:status:update', 'user:role:assign',
    'user:session:read', 'user:session:revoke', 'role:read', 'role:manage',
    'role:permission:manage', 'system:config:manage', 'menu:manage',
    'audit:read', 'dashboard:read', 'ai:use', 'ai:quota:adjust', 'ai:provider:manage',
    'ai:model:manage', 'ai:tool:manage', 'ai:template:manage',
    'ai:entitlement:manage'
  ));

CREATE TYPE "AiOwnerType" AS ENUM ('USER', 'ANONYMOUS');
CREATE TYPE "AiModality" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'MULTIMODAL');
CREATE TYPE "AiToolCode" AS ENUM ('CHAT', 'TEXT', 'IMAGE', 'VIDEO');
CREATE TYPE "AiToolStatus" AS ENUM ('ENABLED', 'DISABLED', 'COMING_SOON');
CREATE TYPE "AiToolGroup" AS ENUM ('HOME', 'CREATE', 'ASSETS', 'PROFILE', 'COMMERCE', 'HELP', 'OPEN');
CREATE TYPE "AiConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AiTitleSource" AS ENUM ('AUTO', 'USER');
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "AiMessageStatus" AS ENUM ('STREAMING', 'DONE', 'STOPPED', 'FAILED', 'BLOCKED');
CREATE TYPE "AiFinishReason" AS ENUM ('STOP', 'LENGTH', 'CONTENT_FILTER', 'CANCELLED', 'ERROR');
CREATE TYPE "AiStoppedBy" AS ENUM ('USER', 'SYSTEM_TIMEOUT');
CREATE TYPE "AiFeedback" AS ENUM ('DISLIKE');
CREATE TYPE "AiReservationStatus" AS ENUM ('PENDING', 'SETTLED', 'RELEASED', 'EXPIRED');
CREATE TYPE "AiGenerationJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');
CREATE TYPE "AiAssetType" AS ENUM ('IMAGE', 'VIDEO', 'TEXT', 'CONVERSATION', 'ATTACHMENT');
CREATE TYPE "AiAssetSource" AS ENUM ('GENERATED', 'UPLOADED', 'CONTENT_REFERENCE');
CREATE TYPE "AiAssetStatus" AS ENUM ('DRAFT', 'SAVED', 'TRASHED');
CREATE TYPE "AiTemplateStatus" AS ENUM ('ENABLED', 'DISABLED');

ALTER TABLE "ai_entitlements"
  ADD COLUMN "plan_code" VARCHAR(80),
  ADD COLUMN "max_concurrent" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "rpm" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "rpd" INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN "guest_rpm" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "guest_rpd" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "daily_token_cap" BIGINT,
  ADD COLUMN "allowed_model_ids" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "allowed_tool_codes" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "ai_providers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(40) NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "base_url" VARCHAR(500),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "auth_env_key" VARCHAR(80),
  "timeout_ms" INTEGER NOT NULL DEFAULT 60000,
  "extra_headers" JSONB,
  "health_status" VARCHAR(40),
  "last_error_code" VARCHAR(80),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_providers_code_key" ON "ai_providers"("code");

CREATE TABLE "ai_models" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_id" UUID NOT NULL,
  "model_key" VARCHAR(120) NOT NULL,
  "display_name" VARCHAR(120) NOT NULL,
  "tool_types" "AiToolCode"[],
  "modality" "AiModality" NOT NULL DEFAULT 'TEXT',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "user_visible" BOOLEAN NOT NULL DEFAULT true,
  "guest_allowed" BOOLEAN NOT NULL DEFAULT false,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "context_window_tokens" INTEGER NOT NULL DEFAULT 8192,
  "max_output_tokens" INTEGER NOT NULL DEFAULT 2048,
  "supports_streaming" BOOLEAN NOT NULL DEFAULT true,
  "supports_vision" BOOLEAN NOT NULL DEFAULT false,
  "supports_tools" BOOLEAN NOT NULL DEFAULT false,
  "supports_reasoning" BOOLEAN NOT NULL DEFAULT false,
  "input_price_per_1k" INTEGER NOT NULL DEFAULT 1,
  "output_price_per_1k" INTEGER NOT NULL DEFAULT 2,
  "fixed_platform_cost" INTEGER,
  "max_reserve_amount" INTEGER NOT NULL DEFAULT 2000,
  "deprecated_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_models_provider_id_model_key_key" ON "ai_models"("provider_id", "model_key");
CREATE INDEX "ai_models_enabled_user_visible_idx" ON "ai_models"("enabled", "user_visible");
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ai_tools" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" "AiToolCode" NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(300) NOT NULL,
  "icon" VARCHAR(40) NOT NULL,
  "status" "AiToolStatus" NOT NULL DEFAULT 'ENABLED',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "requires_login" BOOLEAN NOT NULL DEFAULT false,
  "guest_trial_enabled" BOOLEAN NOT NULL DEFAULT false,
  "group_name" "AiToolGroup" NOT NULL DEFAULT 'CREATE',
  "default_model_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_tools_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_tools_code_key" ON "ai_tools"("code");
CREATE INDEX "ai_tools_sort_order_idx" ON "ai_tools"("sort_order");
ALTER TABLE "ai_tools" ADD CONSTRAINT "ai_tools_default_model_id_fkey" FOREIGN KEY ("default_model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ai_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "tool_type" "AiToolCode" NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(300),
  "prompt" TEXT NOT NULL,
  "params" JSONB,
  "text_scenario" VARCHAR(40),
  "status" "AiTemplateStatus" NOT NULL DEFAULT 'ENABLED',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "model_id" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_templates_owner_id_deleted_at_created_at_idx" ON "ai_templates"("owner_id", "deleted_at", "created_at");
CREATE INDEX "ai_templates_is_system_tool_type_status_idx" ON "ai_templates"("is_system", "tool_type", "status");
ALTER TABLE "ai_templates" ADD CONSTRAINT "ai_templates_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_templates" ADD CONSTRAINT "ai_templates_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ai_anonymous_subjects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "claimed_user_id" UUID,
  "claimed_at" TIMESTAMPTZ(6),
  "last_ip_hash" VARCHAR(128),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_anonymous_subjects_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_anonymous_subjects_expires_at_idx" ON "ai_anonymous_subjects"("expires_at");
CREATE INDEX "ai_anonymous_subjects_claimed_user_id_idx" ON "ai_anonymous_subjects"("claimed_user_id");
ALTER TABLE "ai_anonymous_subjects" ADD CONSTRAINT "ai_anonymous_subjects_claimed_user_id_fkey" FOREIGN KEY ("claimed_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ai_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_type" "AiOwnerType" NOT NULL,
  "owner_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "title_source" "AiTitleSource" NOT NULL DEFAULT 'AUTO',
  "status" "AiConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "pinned_at" TIMESTAMPTZ(6),
  "folder_id" UUID,
  "model_id" UUID NOT NULL,
  "system_prompt" TEXT,
  "temperature" DECIMAL(3,2),
  "top_p" DECIMAL(3,2),
  "max_output_tokens" INTEGER,
  "context_limit" INTEGER NOT NULL DEFAULT 20,
  "enable_knowledge_reference" BOOLEAN NOT NULL DEFAULT true,
  "locale" VARCHAR(16),
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "total_input_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_output_tokens" INTEGER NOT NULL DEFAULT 0,
  "last_message_at" TIMESTAMPTZ(6),
  "last_message_preview" VARCHAR(200),
  "active_message_id" UUID,
  "deleted_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_conversations_owner_type_owner_id_deleted_at_last_message_at_idx" ON "ai_conversations"("owner_type", "owner_id", "deleted_at", "last_message_at");
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ai_quota_reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "account_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "AiReservationStatus" NOT NULL DEFAULT 'PENDING',
  "reserved_amount" BIGINT NOT NULL,
  "settled_amount" BIGINT NOT NULL DEFAULT 0,
  "message_id" UUID,
  "job_id" UUID,
  "request_id" UUID,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_quota_reservations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_quota_reservations_status_expires_at_idx" ON "ai_quota_reservations"("status", "expires_at");
CREATE INDEX "ai_quota_reservations_user_id_created_at_idx" ON "ai_quota_reservations"("user_id", "created_at");
ALTER TABLE "ai_quota_reservations" ADD CONSTRAINT "ai_quota_reservations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ai_quota_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_quota_reservations" ADD CONSTRAINT "ai_quota_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ai_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "role" "AiMessageRole" NOT NULL,
  "status" "AiMessageStatus" NOT NULL DEFAULT 'DONE',
  "parent_message_id" UUID,
  "variant_group_id" UUID,
  "is_current_variant" BOOLEAN NOT NULL DEFAULT true,
  "model_id" UUID,
  "model_key_snapshot" VARCHAR(120),
  "content" TEXT NOT NULL DEFAULT '',
  "content_parts" JSONB,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "finish_reason" "AiFinishReason",
  "error_code" VARCHAR(80),
  "blocked_category" VARCHAR(80),
  "feedback" "AiFeedback",
  "feedback_at" TIMESTAMPTZ(6),
  "stop_requested_at" TIMESTAMPTZ(6),
  "stopped_by" "AiStoppedBy",
  "reservation_id" UUID,
  "request_id" UUID,
  "idempotency_key" VARCHAR(128),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_messages_conversation_id_created_at_id_idx" ON "ai_messages"("conversation_id", "created_at", "id");
CREATE INDEX "ai_messages_variant_group_id_idx" ON "ai_messages"("variant_group_id");
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "ai_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "ai_quota_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ai_message_references" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "content_id" UUID,
  "title_snapshot" VARCHAR(200) NOT NULL,
  "excerpt_snapshot" VARCHAR(2000) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_message_references_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_message_references_message_id_idx" ON "ai_message_references"("message_id");
ALTER TABLE "ai_message_references" ADD CONSTRAINT "ai_message_references_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ai_usage_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "owner_type" "AiOwnerType" NOT NULL,
  "owner_id" UUID NOT NULL,
  "tool_type" "AiToolCode" NOT NULL,
  "model_id" UUID,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "platform_cost" INTEGER NOT NULL DEFAULT 0,
  "provider_cost" INTEGER,
  "message_id" UUID,
  "job_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_usage_records_user_id_created_at_idx" ON "ai_usage_records"("user_id", "created_at");
CREATE INDEX "ai_usage_records_owner_type_owner_id_created_at_idx" ON "ai_usage_records"("owner_type", "owner_id", "created_at");
ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ai_generation_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "tool_type" "AiToolCode" NOT NULL,
  "status" "AiGenerationJobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "model_id" UUID NOT NULL,
  "model_key_snapshot" VARCHAR(120) NOT NULL,
  "prompt" TEXT NOT NULL,
  "negative_prompt" TEXT,
  "params" JSONB,
  "seed" INTEGER,
  "parent_job_id" UUID,
  "result_file_ids" JSONB NOT NULL DEFAULT '[]',
  "error_code" VARCHAR(80),
  "error_summary" VARCHAR(300),
  "idempotency_key" VARCHAR(128) NOT NULL,
  "reservation_id" UUID,
  "started_at" TIMESTAMPTZ(6),
  "finished_at" TIMESTAMPTZ(6),
  "cancel_requested_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_generation_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_generation_jobs_user_id_idempotency_key_key" ON "ai_generation_jobs"("user_id", "idempotency_key");
CREATE INDEX "ai_generation_jobs_user_id_created_at_idx" ON "ai_generation_jobs"("user_id", "created_at");
CREATE INDEX "ai_generation_jobs_status_created_at_idx" ON "ai_generation_jobs"("status", "created_at");
ALTER TABLE "ai_generation_jobs" ADD CONSTRAINT "ai_generation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_generation_jobs" ADD CONSTRAINT "ai_generation_jobs_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_generation_jobs" ADD CONSTRAINT "ai_generation_jobs_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "ai_quota_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ai_asset_folders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "parent_id" UUID,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_asset_folders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_asset_folders_owner_id_deleted_at_created_at_idx" ON "ai_asset_folders"("owner_id", "deleted_at", "created_at");
ALTER TABLE "ai_asset_folders" ADD CONSTRAINT "ai_asset_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ai_asset_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ai_assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "file_id" UUID,
  "folder_id" UUID,
  "type" "AiAssetType" NOT NULL,
  "source" "AiAssetSource" NOT NULL DEFAULT 'GENERATED',
  "status" "AiAssetStatus" NOT NULL DEFAULT 'SAVED',
  "title" VARCHAR(160) NOT NULL,
  "prompt" TEXT,
  "model_id" UUID,
  "width" INTEGER,
  "height" INTEGER,
  "duration_ms" INTEGER,
  "seed" INTEGER,
  "params" JSONB,
  "source_job_id" UUID,
  "favorite_at" TIMESTAMPTZ(6),
  "last_used_at" TIMESTAMPTZ(6),
  "trashed_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_assets_owner_id_deleted_at_created_at_idx" ON "ai_assets"("owner_id", "deleted_at", "created_at");
CREATE INDEX "ai_assets_folder_id_idx" ON "ai_assets"("folder_id");
ALTER TABLE "ai_assets" ADD CONSTRAINT "ai_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_assets" ADD CONSTRAINT "ai_assets_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_assets" ADD CONSTRAINT "ai_assets_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "ai_asset_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_assets" ADD CONSTRAINT "ai_assets_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_assets" ADD CONSTRAINT "ai_assets_source_job_id_fkey" FOREIGN KEY ("source_job_id") REFERENCES "ai_generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
