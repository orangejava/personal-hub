-- 内容域：分类/标签/主表/正文/版本/章节/收藏/进度/去重阅读。
-- search_document 不进 Prisma schema，由应用层 raw SQL 维护。

ALTER TYPE "AuditCategory" ADD VALUE 'CONTENT';
ALTER TYPE "AuditCategory" ADD VALUE 'FILE';

CREATE TYPE "ContentType" AS ENUM ('MARKDOWN', 'RICH_TEXT', 'BOOKLET', 'PDF', 'WORD', 'LINK', 'PROJECT');
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ContentVisibility" AS ENUM ('PUBLIC', 'LOGIN', 'PRIVATE');
CREATE TYPE "ContentSourceType" AS ENUM ('MANUAL', 'UPLOAD', 'IMPORT');
CREATE TYPE "ImportSource" AS ENUM ('JUEJIN', 'LOCAL', 'MANUAL');
CREATE TYPE "ImportRestriction" AS ENUM ('NONE', 'PRIVATE_UNTIL_LICENSED');
CREATE TYPE "ContentVersionReason" AS ENUM ('PUBLISH_SNAPSHOT', 'RESTORE_SNAPSHOT', 'IMPORT_SNAPSHOT');

CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "parent_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_parent_id_sort_order_idx" ON "categories"("parent_id", "sort_order");

ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "normalized_name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tags_normalized_name_key" ON "tags"("normalized_name");
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "contents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ContentType" NOT NULL,
    "title" VARCHAR(200),
    "summary" TEXT,
    "author_id" UUID NOT NULL,
    "category_id" UUID,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ContentVisibility" NOT NULL DEFAULT 'PRIVATE',
    "source_type" "ContentSourceType" NOT NULL DEFAULT 'MANUAL',
    "import_source" "ImportSource",
    "import_restriction" "ImportRestriction" NOT NULL DEFAULT 'NONE',
    "cover_file_id" UUID,
    "primary_file_id" UUID,
    "external_url" VARCHAR(2048),
    "extra" JSONB,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "search_document" tsvector,
    "published_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contents_status_visibility_deleted_at_published_at_idx" ON "contents"("status", "visibility", "deleted_at", "published_at");
CREATE INDEX "contents_author_id_deleted_at_updated_at_idx" ON "contents"("author_id", "deleted_at", "updated_at");
CREATE INDEX "contents_category_id_status_visibility_idx" ON "contents"("category_id", "status", "visibility");
CREATE INDEX "contents_is_featured_partial_idx" ON "contents"("is_featured") WHERE "is_featured" = true AND "deleted_at" IS NULL;
CREATE INDEX "contents_search_document_gin_idx" ON "contents" USING GIN ("search_document");

ALTER TABLE "contents" ADD CONSTRAINT "contents_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contents" ADD CONSTRAINT "contents_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contents" ADD CONSTRAINT "contents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "content_bodies" (
    "content_id" UUID NOT NULL,
    "markdown_source" TEXT,
    "editor_document" JSONB,
    "rendered_html" TEXT,
    "toc" JSONB,
    "render_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "content_bodies_pkey" PRIMARY KEY ("content_id")
);

ALTER TABLE "content_bodies" ADD CONSTRAINT "content_bodies_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "content_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_id" UUID NOT NULL,
    "snapshot_reason" "ContentVersionReason" NOT NULL,
    "markdown_source" TEXT,
    "editor_document" JSONB,
    "rendered_html" TEXT,
    "toc" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_versions_content_id_created_at_idx" ON "content_versions"("content_id", "created_at");

ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "content_chapters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "chapter_order" INTEGER NOT NULL,
    "object_key" VARCHAR(512),
    "toc" JSONB,
    "word_count" INTEGER,
    "estimated_reading_seconds" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "content_chapters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_chapters_content_id_chapter_order_key" ON "content_chapters"("content_id", "chapter_order");

ALTER TABLE "content_chapters" ADD CONSTRAINT "content_chapters_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "content_tags" (
    "content_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "content_tags_pkey" PRIMARY KEY ("content_id", "tag_id")
);

ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "favorites" (
    "user_id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id", "content_id")
);

CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");

ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "reading_records" (
    "user_id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "chapter_id" UUID,
    "content_progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chapter_progress_percent" DOUBLE PRECISION,
    "last_read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_records_pkey" PRIMARY KEY ("user_id", "content_id")
);

CREATE INDEX "reading_records_user_id_last_read_at_idx" ON "reading_records"("user_id", "last_read_at");

ALTER TABLE "reading_records" ADD CONSTRAINT "reading_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reading_records" ADD CONSTRAINT "reading_records_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reading_records" ADD CONSTRAINT "reading_records_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "content_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "content_view_days" (
    "content_id" UUID NOT NULL,
    "subject_hash" VARCHAR(128) NOT NULL,
    "view_date" DATE NOT NULL,

    CONSTRAINT "content_view_days_pkey" PRIMARY KEY ("content_id", "subject_hash", "view_date")
);

ALTER TABLE "content_view_days" ADD CONSTRAINT "content_view_days_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
