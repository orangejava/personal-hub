# PRD 文档索引

> 最后更新：2026-07-06
> 说明：本目录存放**可直接指导开发**的 PRD。文档已按 **React-first（当前）** 与 **长期全栈（Next.js + NestJS）** 分子目录存放。

---

## 如何选文档

| 你在做什么 | 读哪组 |
|---|---|
| 当前 `apps/react-web` 开发、mock、Umi | **[react-first/](./react-first/)** |
| 规划 `apps/next-web`、`apps/api`、数据库 | **[long-term/](./long-term/)** |
| 产品功能范围（不分阶段） | [../product/](../product/) 大模块文档 |
| 部署 / 上线 | [../deploy/](../deploy/) |

详细索引与颗粒度标准见 [module-prd-index.md](./module-prd-index.md)。

---

## React-first（当前主线）

> 目录：[react-first/](./react-first/) · 应用：`apps/react-web` · 阶段见 [../react-first/roadmap.md](../react-first/roadmap.md)

| 文档 | 阶段 | 状态 |
|---|---|---|
| [react-first/bootstrap-prd.md](./react-first/bootstrap-prd.md) | 工程初始化 | ✅ 已实施 |
| [react-first/phase-0-3-foundation-prd.md](./react-first/phase-0-3-foundation-prd.md) | 阶段 0–3 | ✅ 已实施 |
| [react-first/phase-4-admin-preview-prd.md](./react-first/phase-4-admin-preview-prd.md) | 阶段 4 | ✅ 已完成本轮收尾 |
| [react-first/phase-5-ai-platform-prd.md](./react-first/phase-5-ai-platform-prd.md) | 阶段 5 | ✅ 已完成本轮收尾 |
| [react-first/ai-composer-layout-prd.md](./react-first/ai-composer-layout-prd.md) | 阶段 5 体验增强 | 🟡 待实施 |
| [react-first/phase-5-5-next-api-bridge-prd.md](./react-first/phase-5-5-next-api-bridge-prd.md) | 阶段 5.5 可选 | 🟡 待确认 |
| [react-first/frontend-visual-spec.md](./react-first/frontend-visual-spec.md) | 跨阶段 | ✅ 已确定 |
| [react-first/theme-navigation-config-prd.md](./react-first/theme-navigation-config-prd.md) | 跨阶段 | 🟡 部分实现 |
| [react-first/content-reading-prd.md](./react-first/content-reading-prd.md) | 阶段 2+ | ✅ 已完成 |
| [react-first/content-workspace-prd.md](./react-first/content-workspace-prd.md) | 阶段 3+ | ✅ 已完成 |

**阶段 6+ PRD（待写）**：NestJS 接入、Next 抽离 — 启动对应阶段前再补到对应子目录。

---

## 长期全栈（Next.js + NestJS）

> 目录：[long-term/](./long-term/) · 目标架构见 [../foundation/tech-stack.md](../foundation/tech-stack.md)

| 文档 | 说明 | 状态 |
|---|---|---|
| [../engineering/project-bootstrap-prd.md](../engineering/project-bootstrap-prd.md) | Monorepo + Next + Nest + Prisma + Docker | ✅ 已完成 |
| [long-term/admin-content-config-prd.md](./long-term/admin-content-config-prd.md) | 后台运营字段级 PRD | ✅ 已完成 |
| [long-term/ai-tools-prd.md](./long-term/ai-tools-prd.md) | AI 工具平台 | ✅ 已完成 |

**待补充**：`long-term/auth-rbac-prd.md`、`long-term/flutter-app-prd.md`

---

## 维护规则

1. React-first 新 PRD 放入 `react-first/`；Next/Nest 相关放入 `long-term/`。
2. 阶段 PRD 实施完成后，在 [../implementation/react-first/](../implementation/react-first/) 补实现说明。
3. 决策变更时同步更新 [../react-first/roadmap.md](../react-first/roadmap.md) 与 product 文档。
