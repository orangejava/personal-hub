-- 占位态改名为 PROCESSING，并记录完成时间，让等待中的同键请求能区分“仍在飞”和“可回放”。
ALTER TABLE "idempotency_records"
  ADD COLUMN "completed_at" TIMESTAMPTZ(6);

UPDATE "idempotency_records"
SET "completed_at" = "created_at"
WHERE "state" = 'COMPLETED';

ALTER TYPE "IdempotencyRecordState" RENAME VALUE 'PENDING' TO 'PROCESSING';

ALTER TABLE "idempotency_records"
  ALTER COLUMN "state" SET DEFAULT 'PROCESSING';
