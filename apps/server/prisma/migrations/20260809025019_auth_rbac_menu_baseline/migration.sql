-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('MEMBER', 'EDITOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('OWN', 'ALL');

-- CreateEnum
CREATE TYPE "MenuScope" AS ENUM ('PUBLIC', 'WORKSPACE', 'ADMIN', 'AI');

-- CreateEnum
CREATE TYPE "MenuType" AS ENUM ('DIRECTORY', 'INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('AUTH', 'RBAC', 'SECURITY', 'QUOTA', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiQuotaTransactionType" AS ENUM ('GRANT', 'RESERVE', 'SETTLE', 'RELEASE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email_normalized" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "role_id" UUID NOT NULL,
    "auth_version" INTEGER NOT NULL DEFAULT 1,
    "permission_version" INTEGER NOT NULL DEFAULT 1,
    "email_verified_at" TIMESTAMPTZ(6),
    "email_changed_at" TIMESTAMPTZ(6),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "nickname" VARCHAR(80),
    "avatar_file_id" UUID,
    "bio" VARCHAR(500),
    "links" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" "RoleCode" NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_protected" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(80) NOT NULL,
    "group" VARCHAR(80) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "data_scope" "DataScope" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_name" VARCHAR(160),
    "user_agent" VARCHAR(512),
    "ip_hash" VARCHAR(128),
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" VARCHAR(120),
    "auth_version" INTEGER NOT NULL,
    "permission_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "rotated_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_token_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_change_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "new_email_normalized" VARCHAR(320) NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "totp_factors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "enabled_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "totp_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "totp_recovery_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factor_id" UUID NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "totp_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" "MenuScope" NOT NULL,
    "type" "MenuType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "parent_id" UUID,
    "route_key" VARCHAR(160),
    "external_url" VARCHAR(2048),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_permissions" (
    "menu_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "menu_permissions_pkey" PRIMARY KEY ("menu_id","permission_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" "AuditCategory" NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "actor_id" UUID,
    "target_type" VARCHAR(80),
    "target_id" UUID,
    "request_id" UUID,
    "ip_hash" VARCHAR(128),
    "result" "AuditResult" NOT NULL DEFAULT 'SUCCEEDED',
    "detail" JSONB,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_entitlements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "verification_grant_amount" BIGINT NOT NULL DEFAULT 10000,
    "rules" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_quota_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "available_amount" BIGINT NOT NULL DEFAULT 0,
    "reserved_amount" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_quota_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_quota_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "type" "AiQuotaTransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "available_balance_after" BIGINT NOT NULL,
    "reserved_balance_after" BIGINT NOT NULL,
    "source" VARCHAR(80) NOT NULL,
    "idempotency_key" VARCHAR(128),
    "request_id" UUID,
    "detail" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_quota_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE INDEX "users_role_id_status_idx" ON "users"("role_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_expires_at_idx" ON "auth_sessions"("user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_token_id_key" ON "refresh_tokens"("replaced_by_token_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_revoked_at_expires_at_idx" ON "refresh_tokens"("session_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_consumed_at_expires_at_idx" ON "email_verification_tokens"("user_id", "consumed_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_consumed_at_expires_at_idx" ON "password_reset_tokens"("user_id", "consumed_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_change_requests_token_hash_key" ON "email_change_requests"("token_hash");

-- CreateIndex
CREATE INDEX "email_change_requests_user_id_consumed_at_expires_at_idx" ON "email_change_requests"("user_id", "consumed_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "totp_factors_user_id_key" ON "totp_factors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "totp_recovery_codes_code_hash_key" ON "totp_recovery_codes"("code_hash");

-- CreateIndex
CREATE INDEX "totp_recovery_codes_factor_id_consumed_at_idx" ON "totp_recovery_codes"("factor_id", "consumed_at");

-- CreateIndex
CREATE UNIQUE INDEX "menus_route_key_key" ON "menus"("route_key");

-- CreateIndex
CREATE INDEX "menus_scope_parent_id_sort_order_idx" ON "menus"("scope", "parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "audit_logs_category_created_at_idx" ON "audit_logs"("category", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_entitlements_role_id_key" ON "ai_entitlements"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_quota_accounts_user_id_key" ON "ai_quota_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_quota_transactions_idempotency_key_key" ON "ai_quota_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "ai_quota_transactions_account_id_created_at_idx" ON "ai_quota_transactions"("account_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey" FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_change_requests" ADD CONSTRAINT "email_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_factors" ADD CONSTRAINT "totp_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_recovery_codes" ADD CONSTRAINT "totp_recovery_codes_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "totp_factors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_permissions" ADD CONSTRAINT "menu_permissions_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_permissions" ADD CONSTRAINT "menu_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_entitlements" ADD CONSTRAINT "ai_entitlements_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_quota_accounts" ADD CONSTRAINT "ai_quota_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_quota_transactions" ADD CONSTRAINT "ai_quota_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ai_quota_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 邮箱在物理列中只保存小写规范化值，唯一索引因此同时提供大小写不敏感唯一性。
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_normalized_lowercase_check"
  CHECK ("email_normalized" = lower("email_normalized"));

ALTER TABLE "email_change_requests"
  ADD CONSTRAINT "email_change_requests_new_email_normalized_lowercase_check"
  CHECK ("new_email_normalized" = lower("new_email_normalized"));

-- 权限码是 M1 的受控目录，不允许管理界面或脚本写入未设计的自由字符串。
ALTER TABLE "permissions"
  ADD CONSTRAINT "permissions_code_catalog_check"
  CHECK ("code" IN (
    'content:create', 'content:read', 'content:update', 'content:publish',
    'content:delete', 'content:restore', 'content:featured', 'content:purge',
    'booklet:import', 'category:manage', 'tag:manage', 'file:read',
    'file:delete', 'user:read', 'user:status:update', 'user:role:assign',
    'user:session:read', 'user:session:revoke', 'role:read', 'role:manage',
    'role:permission:manage', 'system:config:manage', 'menu:manage',
    'audit:read', 'dashboard:read', 'ai:quota:adjust', 'ai:provider:manage',
    'ai:model:manage', 'ai:tool:manage', 'ai:template:manage',
    'ai:entitlement:manage'
  ));

ALTER TABLE "ai_quota_accounts"
  ADD CONSTRAINT "ai_quota_accounts_balances_nonnegative_check"
  CHECK ("available_amount" >= 0 AND "reserved_amount" >= 0);

ALTER TABLE "ai_quota_transactions"
  ADD CONSTRAINT "ai_quota_transactions_balances_nonnegative_check"
  CHECK ("available_balance_after" >= 0 AND "reserved_balance_after" >= 0);
