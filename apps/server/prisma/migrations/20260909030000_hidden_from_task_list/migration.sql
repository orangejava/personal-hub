-- 上传任务列表可单独隐藏条目，不删 file_assets / contents。

ALTER TABLE "file_assets" ADD COLUMN "hidden_from_task_list" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "booklet_import_jobs" ADD COLUMN "hidden_from_task_list" BOOLEAN NOT NULL DEFAULT false;
