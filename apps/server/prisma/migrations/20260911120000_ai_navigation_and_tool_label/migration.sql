CREATE TYPE "AiNavStatus" AS ENUM ('ENABLED', 'DISABLED', 'COMING_SOON');
CREATE TYPE "AiNavGroup" AS ENUM ('HOME', 'CREATE', 'ASSETS', 'PROFILE', 'COMMERCE', 'HELP', 'OPEN');

ALTER TABLE "ai_tools" ADD COLUMN "token_cost_label" VARCHAR(40) NOT NULL DEFAULT '';

CREATE TABLE "ai_navigation_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "icon" VARCHAR(40) NOT NULL,
    "group_name" "AiNavGroup" NOT NULL DEFAULT 'CREATE',
    "route_key" VARCHAR(80) NOT NULL,
    "path" VARCHAR(160) NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "status" "AiNavStatus" NOT NULL DEFAULT 'ENABLED',
    "requires_login" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "parent_id" UUID,
    "description" VARCHAR(300) NOT NULL DEFAULT '',
    "tool_code" "AiToolCode",
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_navigation_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_navigation_items_code_key" ON "ai_navigation_items"("code");
CREATE INDEX "ai_navigation_items_sort_order_idx" ON "ai_navigation_items"("sort_order");
CREATE INDEX "ai_navigation_items_parent_id_idx" ON "ai_navigation_items"("parent_id");

ALTER TABLE "ai_navigation_items"
  ADD CONSTRAINT "ai_navigation_items_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "ai_navigation_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
