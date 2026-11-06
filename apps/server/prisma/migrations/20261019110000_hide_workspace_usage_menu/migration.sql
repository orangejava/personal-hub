-- 我的用量已并入 AI 额度与奖励；保留旧 route_key 供历史链接重定向，但不再出现在工作区菜单。
UPDATE "menus"
SET "visible" = false,
    "enabled" = false,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "route_key" = 'workspace.usage';
