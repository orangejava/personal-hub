-- 幂等占位需要心跳，才能区分“请求仍在飞”和“进程已死”。
ALTER TABLE "idempotency_records"
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "idempotency_records"
SET "updated_at" = COALESCE("completed_at", "created_at");

-- 小册导入任务同样用心跳判断 VALIDATING/IMPORTING 是否僵死。
ALTER TABLE "booklet_import_jobs"
  ADD COLUMN "heartbeat_at" TIMESTAMPTZ(6);

UPDATE "booklet_import_jobs"
SET "heartbeat_at" = COALESCE("started_at", "created_at")
WHERE "status" IN ('VALIDATING', 'IMPORTING');
