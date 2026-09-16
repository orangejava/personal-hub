-- 将仍使用旧默认值的站点主题切换为首版深色紫主题。
-- 已由管理员调整过任一默认字段的站点保留现有选择，避免发布覆盖运营配置。
UPDATE "system_configs"
SET
  "value" = jsonb_set(
    jsonb_set("value", '{colorPrimary}', '"#722ed1"'::jsonb, true),
    '{mode}', '"dark"'::jsonb,
    true
  ),
  "version" = "version" + 1,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'site.theme'
  AND "value" ->> 'colorPrimary' = '#1677ff'
  AND "value" ->> 'mode' = 'auto';
