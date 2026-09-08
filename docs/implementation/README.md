# 功能开发文档归档规范

> 状态：进行中
> 最后更新：2026-09-09
> 目标：把“功能已经开发了什么、为什么这样实现、涉及哪些文件和接口”固定沉淀到统一位置，避免散落在聊天记录里。

## 已归档文档

应用专属实现说明已迁入对应 `apps/*/docs/`，本目录只保留索引规则。

- Nest 阶段 0 / Auth 切片 / 系统配置菜单 / 内容域 / 文件小册 → [apps/server/docs](../../apps/server/docs/README.md)
- 用户端阶段 0–3、5 → [apps/user-web/docs](../../apps/user-web/docs/README.md)
- 管理端阶段 4 → [apps/admin-web/docs](../../apps/admin-web/docs/README.md)
- 用户端 / 管理端拆分 → [admin-web-split.md](./admin-web-split.md)
- 内容审核与上传任务 UI → [content/content-review-and-uploads.md](./content/content-review-and-uploads.md)
- 审查修复收口（幂等/审核/上传任务） → [review-remediation.md](./review-remediation.md)

进度总览见 [`docs/completed/README.md`](../completed/README.md)。

---

## 1. 放在哪里

功能开发完成后的实现文档：

- 跨端索引与归档规则：本目录
- Nest 实现：`apps/server/docs/`
- 用户端实现：`apps/user-web/docs/`
- 管理端实现：`apps/admin-web/docs/`

跨端拆分、契约变更等仍可在本目录写短文（例如 [admin-web-split.md](./admin-web-split.md)）。单应用实现长文不要放这里。

旧路径 `docs/implementation/react-first/`、`auth/`、`foundation/` 仅保留 stub，指向 `apps/*/docs`。

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
