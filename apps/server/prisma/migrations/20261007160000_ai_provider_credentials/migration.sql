-- 目录信息与密钥分开：备案字段在厂商表，密文在凭据表。
ALTER TABLE "ai_providers" ADD COLUMN "remark" VARCHAR(500);
ALTER TABLE "ai_providers" ADD COLUMN "source_filed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ai_providers" ADD COLUMN "filing_note" VARCHAR(200);

CREATE TYPE "AiCredentialOwnerType" AS ENUM ('SYSTEM', 'USER');

CREATE TABLE "ai_provider_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_type" "AiCredentialOwnerType" NOT NULL,
    "user_id" UUID,
    "provider_id" UUID,
    "provider_type" VARCHAR(40),
    "base_url" VARCHAR(500),
    "ciphertext" TEXT NOT NULL,
    "nonce" VARCHAR(48) NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_credentials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_provider_credentials_provider_id_owner_type_idx"
ON "ai_provider_credentials"("provider_id", "owner_type");

CREATE INDEX "ai_provider_credentials_user_id_idx"
ON "ai_provider_credentials"("user_id");

-- 每个厂商至多一条系统凭据；同一用户对同一厂商或同一自定义地址至多一条。
CREATE UNIQUE INDEX "ai_provider_credentials_system_provider_key"
ON "ai_provider_credentials"("provider_id")
WHERE "owner_type" = 'SYSTEM' AND "provider_id" IS NOT NULL;

CREATE UNIQUE INDEX "ai_provider_credentials_user_provider_key"
ON "ai_provider_credentials"("user_id", "provider_id")
WHERE "owner_type" = 'USER' AND "provider_id" IS NOT NULL;

CREATE UNIQUE INDEX "ai_provider_credentials_user_base_url_key"
ON "ai_provider_credentials"("user_id", "base_url")
WHERE "owner_type" = 'USER' AND "provider_id" IS NULL AND "base_url" IS NOT NULL;

ALTER TABLE "ai_provider_credentials"
ADD CONSTRAINT "ai_provider_credentials_owner_check"
CHECK (
  ("owner_type" = 'SYSTEM' AND "user_id" IS NULL AND "provider_id" IS NOT NULL)
  OR ("owner_type" = 'USER' AND "user_id" IS NOT NULL)
);

ALTER TABLE "ai_provider_credentials"
ADD CONSTRAINT "ai_provider_credentials_provider_id_fkey"
FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_provider_credentials"
ADD CONSTRAINT "ai_provider_credentials_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
