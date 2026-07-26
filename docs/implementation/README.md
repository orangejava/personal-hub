# 功能开发文档归档规范

> 状态：进行中
> 最后更新：2026-06-27
> 目标：把“功能已经开发了什么、为什么这样实现、涉及哪些文件和接口”固定沉淀到统一位置，避免散落在聊天记录里。

## 已归档文档

- `react-first/phase-0-structure.md` — 阶段 0 工程骨架
- `react-first/phase-1-foundation.md` — 阶段 1 基础底座
- `react-first/phase-2-public-reading.md` — 阶段 2 公开前台与内容阅读
- `react-first/phase-3-workspace.md` — 阶段 3 工作区与内容生产
- `react-first/phase-0-3.md` — 阶段 0–3 合并说明与补强记录
- `react-first/phase-4-review-fixes.md` — 阶段 4 审阅后的工程修复、类型补齐与后续计划
- `react-first/phase-4-5-planning.md` — 阶段 4 收尾、阶段 4.5 体验底座、阶段 5 AI 平台规划与菜单分组调整
- `react-first/phase-4-closeout.md` — 阶段 4 后台收尾实现与阶段 4.5 体验底座落地记录
- `react-first/phase-4-5-experience-deepening.md` — 阶段 4.5 动效、骨架屏、结果态和操作反馈深化
- `react-first/phase-5-ai-shell.md` — 阶段 5 AI 工作台基础壳层、Ant Design X 本地封装与 mock 契约
- `react-first/ai-composer-layout.md` — AI 三页统一布局、可配置输入框和多类型消息渲染
- `content/booklet-reader-ux.md` — 小册/Markdown 阅读：图片预览、大纲、回顶、主题与进度偏好

进度总览见 [`docs/completed/README.md`](../completed/README.md)。

---

## 1. 放在哪里

功能开发完成后的实现文档，统一放在 `docs/implementation/` 下。

推荐按模块分目录：

- `docs/implementation/foundation/`：工程骨架、基础设施、共享能力
- `docs/implementation/content/`：内容阅读、内容编辑、导入流程
- `docs/implementation/workspace/`：工作区页面、状态、交互
- `docs/implementation/admin/`：后台管理、配置中心、日志
- `docs/implementation/ai/`：AI 对话、文本生成、图片生成、用量
- `docs/implementation/auth/`：登录、鉴权、RBAC
- `docs/implementation/deploy/`：部署落地记录（若有）；权威步骤仍以 `docs/deploy/` 为准

如果某个功能同时跨多个模块，优先放在“主要业务归属模块”目录中，不重复存两份。

---

## 2. 文档适合记录什么

适合放进实现文档的内容：

- 本次功能的目标范围与非目标
- 页面入口、接口入口、核心调用链
- 状态流、数据流、权限流
- 重要文件职责和目录结构
- 联调约定、异常处理、边界条件
- 验证步骤、已知限制、后续扩展点

不建议把纯 PRD 内容原样复制过来；实现文档重点回答“最终怎么落地了”。

---

## 3. 命名建议

推荐文件名：

- `功能名.md`
- 或 `模块-功能名.md`

示例：

- `docs/implementation/content/markdown-reader.md`
- `docs/implementation/content/booklet-import.md`
- `docs/implementation/admin/theme-config.md`

---

## 4. 推荐模板

```md
# 功能名

## 1. 目标与范围

## 2. 页面与入口

## 3. 接口与数据流

## 4. 关键实现

## 5. 权限与异常

## 6. 验证方式

## 7. 已知限制与后续扩展
```

---

## 5. 维护要求

- 新增实现文档后，同步更新本文件或模块目录下的索引。
- 如果功能导致接口、数据库、权限、配置约定发生变化，同步更新 `docs/backend/`、`docs/product/`、`docs/prd/` 对应文档。
- 如果该功能存在值得复用的技术思路，再额外在 `study/features/` 下补学习文档。
