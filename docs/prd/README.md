# PRD 文档索引

> 最后更新：2026-08-08
> 说明：本目录存放**可直接指导开发**的 PRD。文档已按 **React-first（当前）** 与 **长期全栈（未来 Next + React Admin + NestJS）** 分子目录存放。

---

## 如何选文档

| 你在做什么                            | 读哪组                                |
| ------------------------------------- | ------------------------------------- |
| 当前 `apps/react-web` 开发、mock、Umi | **[react-first/](./react-first/)**    |
| 规划未来 Next、`apps/server`、数据库  | **[long-term/](./long-term/)**        |
| 产品功能范围（不分阶段）              | [../product/](../product/) 大模块文档 |
| 部署 / 上线                           | [../deploy/](../deploy/)              |

详细索引与颗粒度标准见 [module-prd-index.md](./module-prd-index.md)。

---

## React-first（当前主线）

> 目录：[react-first/](./react-first/) · 应用：`apps/react-web` · 阶段见 [../react-first/roadmap.md](../react-first/roadmap.md)

| 文档                                                                                           | 阶段            | 状态              |
| ---------------------------------------------------------------------------------------------- | --------------- | ----------------- |
| [react-first/bootstrap-prd.md](./react-first/bootstrap-prd.md)                                 | 工程初始化      | ✅ 已实施         |
| [react-first/phase-0-3-foundation-prd.md](./react-first/phase-0-3-foundation-prd.md)           | 阶段 0–3        | ✅ 已实施         |
| [react-first/phase-4-admin-preview-prd.md](./react-first/phase-4-admin-preview-prd.md)         | 阶段 4          | ✅ 已完成本轮收尾 |
| [react-first/phase-5-ai-platform-prd.md](./react-first/phase-5-ai-platform-prd.md)             | 阶段 5          | ✅ 已完成本轮收尾 |
| [react-first/ai-composer-layout-prd.md](./react-first/ai-composer-layout-prd.md)               | 阶段 5 体验增强 | 🟡 待实施         |
| [react-first/phase-5-5-next-api-bridge-prd.md](./react-first/phase-5-5-next-api-bridge-prd.md) | 阶段 5.5 可选   | 🟡 待确认         |
| [react-first/frontend-visual-spec.md](./react-first/frontend-visual-spec.md)                   | 跨阶段          | ✅ 已确定         |
| [react-first/theme-navigation-config-prd.md](./react-first/theme-navigation-config-prd.md)     | 跨阶段          | 🟡 部分实现       |
| [react-first/content-reading-prd.md](./react-first/content-reading-prd.md)                     | 阶段 2+         | ✅ 已完成         |
| [react-first/content-workspace-prd.md](./react-first/content-workspace-prd.md)                 | 阶段 3+         | ✅ 已完成         |

**后端下一阶段入口**：Nest 阶段 0 已完成 Testcontainers、readiness 故障自动化与 server CI 收口；Auth 开始前阅读 [长期 Nest Server 脚手架 PRD](./long-term/nest-server-bootstrap-prd.md)、[Auth/RBAC PRD](./long-term/auth-rbac-session-prd.md) 与 Canonical 文档；Next 抽离仍在启动对应阶段前另行补 PRD。

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

**待补充**：`long-term/flutter-app-prd.md`（Web 主链路稳定后）；真实 AI 厂商适配在接入时按 `ai-tools-prd.md` 与 Canonical 文档补充，不预建重复 PRD。

---

## 维护规则

1. React-first 新 PRD 放入 `react-first/`；Next/Nest 相关放入 `long-term/`。
2. React-first 阶段 PRD 实施完成后，在 [../implementation/react-first/](../implementation/react-first/) 补实现说明；Nest 阶段在 [../implementation/foundation/](../implementation/foundation/) 或对应领域目录补实现说明。
3. 决策变更时同步更新 [../react-first/roadmap.md](../react-first/roadmap.md) 与 product 文档。
