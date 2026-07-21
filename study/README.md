# 学习与系统设计目录

> 这个目录不写“需求文档”，而是写开发过程中需要反复参考的学习材料、设计方法、复盘笔记。
>
> **分区提示**：当前 Web 开发走 React-first（`apps/react-web`），Next.js/NestJS 手册供阶段 6–7 与长期全栈使用。

---

## 当前文档

- [features/README.md](./features/README.md)：功能级学习文档归档规范与入口。
- [features/umi-mock-and-dataflow.md](./features/umi-mock-and-dataflow.md)：Umi Max mock 分层、`useRequest` 自动解包 `ApiResponse.data` 的机制与踩坑。
- [features/markdown-booklet-reading.md](./features/markdown-booklet-reading.md)：Markdown 渲染 + 目录提取 + 多类型内容分发 + 本地小册同步脚本。
- [features/react-first-phase-0-3.md](./features/react-first-phase-0-3.md)：React-first 阶段 0–3 合并复盘（权限、主题分离、菜单 i18n、文档预览选型）。
- [features/react-experience-system.md](./features/react-experience-system.md)：阶段 4.5 体验系统（动效、骨架屏、结果态、操作反馈）。
- [features/ai-composer-layout.md](./features/ai-composer-layout.md)：AI 三页统一布局、可配置输入框、配置弹窗和多类型消息渲染。
- [frontend-to-fullstack-learning-path.md](./frontend-to-fullstack-learning-path.md)：面向 Vue 3 / React 前端开发者的全栈转型路径。
- [local-environment-setup-handbook.md](./local-environment-setup-handbook.md)：本地开发环境准备手册，包含 Docker、PostgreSQL、Redis、GUI/CLI 工具建议。
- [nextjs-learning-handbook.md](./nextjs-learning-handbook.md)：Next.js 学习手册，重点是 App Router、RSC、SSR、ISR、路由组织。
- [nestjs-learning-handbook.md](./nestjs-learning-handbook.md)：NestJS 学习手册，重点是模块、Controller、Service、Guard、Swagger。
- [prisma-postgres-learning-handbook.md](./prisma-postgres-learning-handbook.md)：Prisma 与 PostgreSQL 学习手册，重点是建模、迁移、关系、索引、分页。
- [monorepo-docker-learning-handbook.md](./monorepo-docker-learning-handbook.md)：pnpm workspace、Turborepo、Docker Compose 学习手册。
- [technology-learning-map.md](./technology-learning-map.md)：技术学习地图，适合先扫全局。
- [system-design-thinking.md](./system-design-thinking.md)：如果重新设计一个系统，应该从哪些维度思考。

---

## 这个目录后续适合增加什么

- 某次关键技术选型的复盘
- 某个难点功能的拆解笔记
- 一次部署/排障后的经验总结
- 某个模块的阅读源码笔记

---

## 建议阅读顺序

### 当前：React-first 开发

1. [features/react-first-phase-0-3.md](./features/react-first-phase-0-3.md) — 阶段 0–3 复盘。
2. [features/markdown-booklet-reading.md](./features/markdown-booklet-reading.md) — Markdown、小册、目录、同步脚本。
3. [features/umi-mock-and-dataflow.md](./features/umi-mock-and-dataflow.md) — mock 与 `useRequest` 数据流。

PRD 与路线图见 [../docs/prd/README.md](../docs/prd/README.md)、[../docs/react-first/roadmap.md](../docs/react-first/roadmap.md)。

### 后续：长期全栈

1. 先读 [frontend-to-fullstack-learning-path.md](./frontend-to-fullstack-learning-path.md)，建立整体心智模型。
2. 开始工程骨架前，读 [local-environment-setup-handbook.md](./local-environment-setup-handbook.md) 和 [monorepo-docker-learning-handbook.md](./monorepo-docker-learning-handbook.md)。
3. 开始 `apps/next-web` 时，读 [nextjs-learning-handbook.md](./nextjs-learning-handbook.md)。
4. 开始 `apps/api` 时，读 [nestjs-learning-handbook.md](./nestjs-learning-handbook.md)。
5. 开始数据库建模时，读 [prisma-postgres-learning-handbook.md](./prisma-postgres-learning-handbook.md)。
6. 需要拔高系统视角时，再读 [system-design-thinking.md](./system-design-thinking.md)。

## 使用建议

1. `docs/` 放“项目要做什么、按什么顺序做、工程上怎么落”。
2. `study/` 根目录放“为什么这样做、每个技术怎么学、常见坑怎么避开”的通用手册。
3. 新增单个功能的学习沉淀时，优先放到 `study/features/`，不要和通用手册混放。
4. 新增学习笔记时，尽量一篇只解决一个主题，例如“JWT 登录链路”或“Prisma 多对多关系”。
