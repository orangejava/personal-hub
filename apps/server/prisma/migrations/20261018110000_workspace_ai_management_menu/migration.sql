INSERT INTO "menus" (
  "scope", "type", "name", "locale_key", "icon", "route_key", "sort_order", "visible", "enabled", "is_system", "updated_at"
)
VALUES (
  'WORKSPACE', 'DIRECTORY', 'AI 管理', 'workspace.ai', 'robot', 'workspace.ai', 25, true, true, true, CURRENT_TIMESTAMP
)
ON CONFLICT ("route_key") DO UPDATE SET
  "type" = 'DIRECTORY',
  "name" = 'AI 管理',
  "locale_key" = 'workspace.ai',
  "icon" = 'robot',
  "sort_order" = 25,
  "visible" = true,
  "enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "menus" (
  "scope", "type", "name", "locale_key", "icon", "parent_id", "route_key", "sort_order", "visible", "enabled", "is_system", "updated_at"
)
SELECT 'WORKSPACE', 'INTERNAL', '自备厂商与模型', 'workspace.aiProviders', 'setting', parent."id", 'workspace.aiProviders', 10, true, true, true, CURRENT_TIMESTAMP
FROM "menus" parent
WHERE parent."route_key" = 'workspace.ai'
ON CONFLICT ("route_key") DO UPDATE SET
  "parent_id" = EXCLUDED."parent_id",
  "name" = EXCLUDED."name",
  "locale_key" = EXCLUDED."locale_key",
  "icon" = EXCLUDED."icon",
  "sort_order" = EXCLUDED."sort_order",
  "visible" = true,
  "enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "menus" (
  "scope", "type", "name", "locale_key", "icon", "parent_id", "route_key", "sort_order", "visible", "enabled", "is_system", "updated_at"
)
SELECT 'WORKSPACE', 'INTERNAL', 'AI 额度与奖励', 'workspace.aiQuota', 'wallet', parent."id", 'workspace.aiQuota', 20, true, true, true, CURRENT_TIMESTAMP
FROM "menus" parent
WHERE parent."route_key" = 'workspace.ai'
ON CONFLICT ("route_key") DO UPDATE SET
  "parent_id" = EXCLUDED."parent_id",
  "name" = EXCLUDED."name",
  "locale_key" = EXCLUDED."locale_key",
  "icon" = EXCLUDED."icon",
  "sort_order" = EXCLUDED."sort_order",
  "visible" = true,
  "enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;

UPDATE "menus" history
SET "parent_id" = parent."id"
FROM "menus" parent
WHERE history."route_key" = 'workspace.aiHistory'
  AND parent."route_key" = 'workspace.ai';

INSERT INTO "menu_permissions" ("menu_id", "permission_id")
SELECT menu."id", permission."id"
FROM "menus" menu
JOIN "permissions" permission ON permission."code" = 'ai:use'
WHERE menu."route_key" IN ('workspace.ai', 'workspace.aiHistory', 'workspace.aiProviders', 'workspace.aiQuota')
ON CONFLICT DO NOTHING;
