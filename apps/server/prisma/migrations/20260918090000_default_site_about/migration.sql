-- 只为仍为空的关于我配置补充首版联系方式；已有自定义正文不覆盖。
UPDATE "system_configs"
SET
  "value" = jsonb_set(
    "value",
    '{markdown}',
    to_jsonb($about$
# 关于我

一个正在搭建个人知识中台的开发者，把阅读、写作与 AI 工具沉淀到一个站点。

## 联系

- Email：oralemon@163.com
- GitHub：[orangejava/personal-hub](https://github.com/orangejava/personal-hub)
$about$::text),
    true
  ),
  "version" = "version" + 1,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'site.about'
  AND COALESCE(BTRIM("value" ->> 'markdown'), '') = '';
