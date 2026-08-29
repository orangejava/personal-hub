# PRD 文档索引

> 最后更新：2026-08-22
> 说明：本目录存放**可直接指导开发**的 PRD。文档已按 **React-first（当前）** 与 **长期全栈（未来 Next + React Admin + NestJS）** 分子目录存放。

---

## 如何选文档

| 你在做什么                            | 读哪组                                |
| ------------------------------------- | ------------------------------------- |
| 当前用户端 `apps/user-web` | **[../../apps/user-web/docs/prd](../../apps/user-web/docs/prd/)** |
| 当前管理端 `apps/admin-web` | **[../../apps/admin-web/docs/prd](../../apps/admin-web/docs/prd/)** |
| 规划未来 Next、`apps/server`、数据库  | **[long-term/](./long-term/)**        |
| 产品功能范围（不分阶段）              | [../product/](../product/) 大模块文档 |
| 部署 / 上线                           | [../deploy/](../deploy/)              |

详细索引与颗粒度标准见 [module-prd-index.md](./module-prd-index.md)。

---

## React-first（当前主线）

> 用户端 PRD：[apps/user-web/docs/prd](../../apps/user-web/docs/prd/) · 管理端：[apps/admin-web/docs/prd](../../apps/admin-web/docs/prd/) · 历史路线图：[../history/react-first-roadmap.md](../history/react-first-roadmap.md)

| 文档 | 阶段 | 状态 |
| --- | --- | --- |
| [../../apps/user-web/docs/prd/bootstrap-prd.md](../../apps/user-web/docs/prd/bootstrap-prd.md) | 工程初始化 | ✅ 已实施 |
| [../../apps/user-web/docs/prd/phase-0-3-foundation-prd.md](../../apps/user-web/docs/prd/phase-0-3-foundation-prd.md) | 阶段 0–3 | ✅ 已实施 |
| [../../apps/admin-web/docs/prd/phase-4-admin-preview-prd.md](../../apps/admin-web/docs/prd/phase-4-admin-preview-prd.md) | 阶段 4 | ✅ 已完成本轮收尾 |
| [../../apps/user-web/docs/prd/phase-5-ai-platform-prd.md](../../apps/user-web/docs/prd/phase-5-ai-platform-prd.md) | 阶段 5 | ✅ 已完成本轮收尾 |
| [react-first/phase-5-5-next-api-bridge-prd.md](./react-first/phase-5-5-next-api-bridge-prd.md) | 阶段 5.5 可选 | ⏭️ 已跳过 |

**后端下一阶段入口**：Nest M2 Auth 切片见 [apps/server/docs/implementation/auth](../../apps/server/docs/implementation/auth/README.md)。阶段 5.5 Next API Bridge 已跳过。

---

## 长期全栈（Next.js + NestJS）

> 目录：[long-term/](./long-term/) · 目标架构见 [../foundation/tech-stack.md](../foundation/tech-stack.md)

| 文档                                                                                 | 说明                                                                | 状态                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------ |
| [long-term/nest-server-bootstrap-prd.md](./long-term/nest-server-bootstrap-prd.md)   | `apps/server`、本地依赖 Compose、Prisma/Redis/Health/Swagger 脚手架 | ✅ 已完成 |
| [long-term/auth-rbac-session-prd.md](./long-term/auth-rbac-session-prd.md)           | 认证、会话、强制下线、RBAC 与数据范围                               | ✅ 已确认                      |
| [long-term/system-config-menu-prd.md](./long-term/system-config-menu-prd.md)         | 公开配置、运营菜单与路由注册表                                      | ✅ 已确认                      |
| [long-term/content-reading-domain-prd.md](./long-term/content-reading-domain-prd.md) | 内容生命周期、阅读、收藏、进度与版本快照                            | ✅ 已确认                      |
| [long-term/content-booklet-file-prd.md](./long-term/content-booklet-file-prd.md)     | COS/MinIO、小册异步导入与章节加载                                   | ✅ 已确认                      |
| [long-term/admin-governance-audit-prd.md](./long-term/admin-governance-audit-prd.md) | 最高权限治理、后台运营与审计保留                                    | ✅ 已确认                      |
| [../history/admin-content-config-prd.md](../history/admin-content-config-prd.md)     | 后台页面字段与运营交互历史参考                                      | 📚 历史资料                    |
| [long-term/ai-tools-prd.md](./long-term/ai-tools-prd.md)                             | AI 工具平台、SSE、任务、额度与资产                                  | ✅ 已确认                      |
| [long-term/nest-backend-requirements.md](./long-term/nest-backend-requirements.md)   | React 功能到 Canonical Nest 后端需求总览                            | ✅ 已确认                      |

**后置待办**：`long-term/flutter-app-prd.md`（Web 主链路稳定后）；域名与站点名；主题/导航剩余项。真实 AI 厂商适配在接入时按 `ai-tools-prd.md` 与 Canonical 文档补充，不预建重复 PRD。

---

## 维护规则

1. 用户端 PRD 放入 `apps/user-web/docs/prd/`；管理端放入 `apps/admin-web/docs/prd/`；长期 Nest/Next 放入 `long-term/`。本目录 `react-first/` 只留索引与跳过方案。
2. 实施完成后：用户端实现说明进 `apps/user-web/docs/implementation/`；管理端进 `apps/admin-web/docs/implementation/`；Nest 进 `apps/server/docs/`。全局 `docs/implementation/` 只留索引与旧路径 stub。
3. 决策变更时同步更新 [../react-first/README.md](../react-first/README.md) 与 product 文档。
