# 上线后优化 PRD

> 状态：当前开发主线
> 最后更新：2026-09-23
> 关系：首版已上线后，本目录承接可直接开工的跨端优化 PRD。历史 React-first 阶段 PRD 仍在 `apps/*/docs/prd/` 与 `docs/prd/react-first/`；长期后端契约仍在 `docs/prd/long-term/`。

## 放置边界

本目录放「已经确定要作为下一批 worktree 开发」且跨多个应用或需要统一验收的 PRD。

不放：

- 服务器上线命令、域名、备案、HTTPS、备份：放 `docs/deploy/`
- 单个应用内部的小修小补：放对应 `apps/<name>/docs/prd/`
- 已落地实现说明：放 `apps/<name>/docs/implementation/` 或 `apps/server/docs/implementation/`
- 远期想法：放 `docs/product/phase-2/`

## 当前 Worktree

| 文档 | Worktree | 内容 | 计划评分 |
| --- | --- | --- | --- |
| [ai-admin-operations-prd.md](./ai-admin-operations-prd.md) | AI 后台 | Provider、模型、用户自备 Key、用量、额度、倍率、发放和签到 | 9 / 10 |
| [theme-ui-performance-prd.md](./theme-ui-performance-prd.md) | 主题、性能与 UI | 主题剩余 UI、加载速度、Loading、公开页与交互优化 | 8.5 / 10 |

## 开发顺序

两条 worktree 可以并行。

1. AI 后台：先做配置中心，再做用量额度，最后做发放与签到。
2. 主题、性能与 UI：先做主题配置闭环，再做加载速度和 Loading，最后做页面交互优化。

## 共同验收原则

- 不破坏首版已上线能力：登录、内容阅读、小册阅读、AI 基础能力、后台入口。
- 涉及 Nest / API / Prisma / `api-client` 时，同步更新接口、类型、调用方和测试。
- 涉及前端页面、样式或交互时，完成后必须做浏览器验收。
- 实现完成后，补充实现说明；若形成可复用学习点，再补 `study/features/`。
