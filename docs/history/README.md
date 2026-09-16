# 历史决策资料

> 状态：仅供方案演进与已实施阶段追溯，**不得作为当前开发依据**。
> 当前后端实现入口：[Nest Server 脚手架 PRD](../../apps/server/docs/prd/nest-server-bootstrap-prd.md)、[Canonical API](../backend/canonical-api.md)、[Canonical 数据模型](../backend/canonical-data-model.md)、[后端实现约定](../../apps/server/docs/conventions.md)。

---

## 收录规则

本目录保存曾经参与决策、但已被新实施路线或 Canonical 契约替代的完整文档。保留它们是为了理解项目为什么发生路线调整；新功能开发不得从本目录复制接口、数据模型、目录结构或部署命令。

## 文档索引

| 文档                                                           | 原用途                     | 当前替代依据                                        |
| -------------------------------------------------------------- | -------------------------- | --------------------------------------------------- |
| [nest-backend-architecture.md](./nest-backend-architecture.md) | Nest 早期架构与技术取舍    | Nest Server 脚手架 PRD、Canonical 后端文档          |
| [nest-fastify-stage0-retrospective.md](./nest-fastify-stage0-retrospective.md) | Fastify 阶段 0 排障与迁移背景 | Express 技术栈、依赖目录、阶段 0 实现记录 |
| [development-plan.md](./development-plan.md)                   | React-first 阶段执行手册   | React-first 路线图；Nest 开发顺序以长期 PRD 为准    |
| [react-first-strategy.md](./react-first-strategy.md)           | 为何先做 React 全站        | 现应用边界见 `docs/react-first/README.md`           |
| [react-first-architecture.md](./react-first-architecture.md)   | 当时的单应用 Monorepo 边界 | 现为 `user-web` + `admin-web`                      |
| [react-first-roadmap.md](./react-first-roadmap.md)             | 阶段 0–5 路线图            | 已完成；后续按 Nest 领域开刀                        |
| [mvp-roadmap.md](./mvp-roadmap.md)                             | MVP 阶段排期               | 已完成台账与当前长期 PRD                            |
| [admin-content-config-prd.md](./admin-content-config-prd.md)   | 后台 UI 字段和运营交互参考 | Canonical API、数据模型、后台治理与系统配置菜单 PRD |
