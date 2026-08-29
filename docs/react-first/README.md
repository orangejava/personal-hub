# React-first 实施路线总入口

> 状态：阶段 0-5 已完成；Web 已拆为用户端 `apps/user-web` 与管理端 `apps/admin-web`
> 最后更新：2026-08-28
> 路线决策长文已迁入 `docs/history/`，不再作为当前开发依据。

## 当前应用边界

| 应用 | 端口 | 职责 |
| --- | --- | --- |
| `apps/user-web` | 8000 | 公开前台、工作区、AI、登录 |
| `apps/admin-web` | 8001 | `/admin` 后台 |
| `apps/server` | 3001 | Nest `/api/v1` |

## 文档去哪读

| 内容 | 位置 |
| --- | --- |
| 用户端结构 / 阶段 0–3、5 | [apps/user-web/docs](../../apps/user-web/docs/README.md) |
| 管理端阶段 4 | [apps/admin-web/docs](../../apps/admin-web/docs/README.md) |
| 历史路线决策 | [strategy](../history/react-first-strategy.md) · [architecture](../history/react-first-architecture.md) · [roadmap](../history/react-first-roadmap.md) |
| 跳过的 Next API Bridge PRD | [phase-5-5](../prd/react-first/phase-5-5-next-api-bridge-prd.md) |
