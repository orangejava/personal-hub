# Nest M3 系统配置与菜单

> 状态：3.1–3.3 已落地
> 最后更新：2026-08-31
> 契约：[系统配置与菜单 PRD](../../../../docs/prd/long-term/system-config-menu-prd.md)、[Canonical API](../../../../docs/backend/canonical-api.md)

本文件只排 **M3 System/Menu HTTP** 的刀序，不替代 Canonical。登录菜单仍走 `GET /auth/permissions`。

## 切片一览

| 刀 | 内容 | 状态 |
| --- | --- | --- |
| 3.1 | `system_configs` + 菜单四列 + 幂等表；`GET /public/site-config` | ✅ |
| 3.2 | `GET /public/navigation`；公开顶栏读 Nest，失败 fallback `publicMenu.ts` | ✅ |
| 3.3 | 后台配置 PUT、菜单 CRUD/sort/route-options、幂等中间件、菜单世代失效权限缓存 | ✅ |

## 调用链

```text
匿名首页
  → GET /api/v1/public/site-config（Redis cache:system:public-config）
  → GET /api/v1/public/navigation（cache:navigation:public）
  → 前端 mapPublicSiteConfig / mapPublicNavigation
  → 公开顶栏渲染菜单 `name`（中文展示名；不要把 localeKey 当 i18n 再翻成英文）

展示约定：[系统配置与菜单 PRD §4.3.1](../../../../docs/prd/long-term/system-config-menu-prd.md)。

后台保存配置
  → PUT /api/v1/admin/system-configs/:group + Idempotency-Key + version
  → 整组事务、审计、删公开配置缓存

后台改菜单
  → POST/PATCH/DELETE /admin/menus
  → INCR system:menu-epoch，登录权限快照 key 带世代，立刻 miss
```

## 明确不做

Logo 真文件、About Markdown 接线、左/右导航 UI、配置草稿/回滚、审计列表页、构建期扫描前端仓库。

## 验证

1. `pnpm --filter server prisma:deploy && pnpm --filter server prisma:seed`
2. `pnpm --filter server test`
3. `pnpm dev:server` 与 `pnpm dev:user`：匿名首页标题来自 Nest；`pnpm dev:admin` 改站点名后刷新用户端可见
