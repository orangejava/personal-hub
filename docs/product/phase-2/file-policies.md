# 二期想法：文件策略后台可配

> 状态：想法；一期已预留 `file.policies` 配置组与 `resolveFilePolicy()`
> 最后更新：2026-09-08

## 一期

- `purpose` 仍是 Prisma 枚举（`AVATAR` / `COVER` / `CONTENT_FILE` / `BOOKLET_SOURCE` / `TEMPORARY_IMPORT` / `AI_ASSET`）。
- 每个 purpose 的 MIME 白名单与大小上限在代码默认矩阵；`complete` 时再 merge `system_configs` 的 `file.policies`（若已 seed）。
- 代码 denylist 始终生效（可执行文件、HTML、不安全 SVG）；后台配了也不放行。
- **没有**单独的「文件策略」后台页。高权限理论上可通过已有配置 PUT 改 JSON，但产品不把它当运营入口。

## 二期

- 系统配置中心增加「文件策略」页：按 purpose 勾选 MIME、改大小（不超过代码天花板）。
- 仅 `super_admin`（或单独权限），与小册 PRD「阈值不开放普通后台乱改」一致。
- **不**允许后台发明新 purpose。新通道仍要发版。
