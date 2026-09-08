-- 幂等记录先声明唯一键，再持久化响应，避免并发首请求同时穿透业务层。
CREATE TYPE "IdempotencyRecordState" AS ENUM ('PENDING', 'COMPLETED');

ALTER TABLE "idempotency_records"
  ADD COLUMN "state" "IdempotencyRecordState" NOT NULL DEFAULT 'COMPLETED',
  ALTER COLUMN "response_status" DROP NOT NULL,
  ALTER COLUMN "response_body" DROP NOT NULL;

-- 既有记录均已含完整响应；新记录由拦截器以 PENDING 创建。
ALTER TABLE "idempotency_records"
  ALTER COLUMN "state" SET DEFAULT 'PENDING';
