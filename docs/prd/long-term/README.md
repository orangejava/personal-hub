# 长期全栈 PRD

> 目标：未来 Next 公开前台/工作区 + React 管理台 + `apps/server`（NestJS）+ PostgreSQL + Redis
> **当前日常开发仍以 React-first 为准**；本节描述技术栈无关的最终产品与后端契约。Nest 编码时以本目录、`docs/backend/canonical-*.md` 与 `docs/backend/conventions.md` 为唯一事实来源；产品文档负责功能/UI 说明，不单独定义 DTO、密码算法、会话或权限实现。
> 上级索引：[../README.md](../README.md)

---

## 工程与底座

| 文档                                                                                         | 说明                                                                | 状态                   |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- |
| [nest-server-bootstrap-prd.md](./nest-server-bootstrap-prd.md)                               | `apps/server`、本地依赖 Compose、Prisma/Redis/Health/Swagger 脚手架 | ✅ 已完成 |
| [../../engineering/nest-dependency-catalog.md](../../engineering/nest-dependency-catalog.md) | Nest 核心依赖、组合边界与版本锁定流程                               | ✅ 已确定              |

## 业务 PRD

| 文档                                                             | 说明                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| [auth-rbac-session-prd.md](./auth-rbac-session-prd.md)           | 认证、会话、RBAC；M2 刀序见 [切片划分](../../implementation/auth/README.md) |
| [system-config-menu-prd.md](./system-config-menu-prd.md)         | 公开系统配置、运营菜单、路由注册表与权限可见性                   | ✅ 已确认 |
| [content-reading-domain-prd.md](./content-reading-domain-prd.md) | 内容生命周期、可见性、阅读、收藏、进度、软删除与版本快照         | ✅ 已确认 |
| [content-booklet-file-prd.md](./content-booklet-file-prd.md)     | COS/MinIO、ZIP 异步导入、章节按需读取与存量小册 CLI 迁移         | ✅ 已确认 |
| [admin-governance-audit-prd.md](./admin-governance-audit-prd.md) | super_admin、后台高风险治理、会话处置与分级审计保留              | ✅ 已确认 |
| [ai-tools-prd.md](./ai-tools-prd.md)                             | AI Chat、生成、额度、资产与 MockVideoProvider                    | ✅ 已确认 |
| [nest-backend-requirements.md](./nest-backend-requirements.md)   | React 功能到 Canonical Nest 后端需求总览与阶段实施前契约检查清单 | ✅ 已确认 |

## 待补充

| 文档                 | 触发时机         |
| -------------------- | ---------------- |
| `flutter-app-prd.md` | Web 主链路稳定后（已后置） |

## 相关长期文档

- 技术栈：[../../foundation/tech-stack.md](../../foundation/tech-stack.md)
- 架构：[../../foundation/architecture.md](../../foundation/architecture.md)
- 部署：[../../deploy/README.md](../../deploy/README.md)
- 后端 API：[../../backend/canonical-api.md](../../backend/canonical-api.md)
- 数据模型：[../../backend/canonical-data-model.md](../../backend/canonical-data-model.md)
