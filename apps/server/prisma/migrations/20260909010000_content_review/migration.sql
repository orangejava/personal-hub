-- 内容审核队列：编辑者（OWN）发布写入 PENDING；同一内容同时只允许一条待审。

CREATE TYPE "ContentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

CREATE TABLE "content_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "status" "ContentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "requested_visibility" "ContentVisibility" NOT NULL,
    "copyright_note" VARCHAR(500),
    "reject_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "content_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_reviews_status_created_at_idx" ON "content_reviews"("status", "created_at");
CREATE INDEX "content_reviews_content_id_created_at_idx" ON "content_reviews"("content_id", "created_at");
CREATE INDEX "content_reviews_requester_id_created_at_idx" ON "content_reviews"("requester_id", "created_at");
CREATE UNIQUE INDEX "content_reviews_pending_content_id_key" ON "content_reviews"("content_id") WHERE "status" = 'PENDING';

ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
