CREATE TABLE "content_access_grants" (
    "content_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_access_grants_pkey" PRIMARY KEY ("content_id", "user_id")
);

CREATE INDEX "content_access_grants_user_id_created_at_idx"
ON "content_access_grants"("user_id", "created_at");

ALTER TABLE "content_access_grants"
ADD CONSTRAINT "content_access_grants_content_id_fkey"
FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_access_grants"
ADD CONSTRAINT "content_access_grants_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_access_grants"
ADD CONSTRAINT "content_access_grants_granted_by_fkey"
FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
