# Nest 类型化系统配置与 HTTP 幂等

## 场景背景

要把 mock 里的站点名、主题、首页 Hero 和导航接到 Nest，且后台保存不能因网络重试写两次。

## 核心概念

- **注册表 + JSONB**：`system_configs` 每组一行，value 必须过 Zod；公开接口只组装白名单。
- **预留有名字的字段**（`logoFileId: null`），不要 `remark1` 空列。
- **Idempotency-Key**：同一用户 + 方法 + 路径 + Key 重试返回首次结果；换了正文则 409。

## 调用链

公开 GET 走 Redis 短缓存；PUT 整组事务后删缓存。改菜单时 `INCR system:menu-epoch`，权限快照 cache key 带世代。

## 常见错误

- GET 不需要幂等表；不要给公开接口强制 Idempotency-Key。
- 直接改库不会清 Redis，测试里禁用菜单应走 PATCH。
- 不要为迁就 `code === 0` 再包 `toApiResponse`。拦截器解包为 T；Umi 4 的 `useRequest` 还要再取 `.data`，页面必须用 `@/hooks/useRequest`。
- `audit_logs.target_id` 是 UUID，配置组名只能放 `detail`，不能当 targetId。
- 已有 Nest 的路径失败后禁止再打 `/api/system/config/public` 这类已关闭 mock。
