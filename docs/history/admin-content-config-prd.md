# 后台内容与配置 PRD

> 状态：🟡 UI/字段参考已保留；API、状态机与数据模型以 Canonical 文档为唯一依据
> 最后更新：2026-08-02
> 优先级：P1
> 适用范围：React Admin 页面字段与运营交互；后端契约见 [Canonical API](../backend/canonical-api.md)、[后台治理 PRD](../prd/long-term/admin-governance-audit-prd.md)、[系统配置菜单 PRD](../prd/long-term/system-config-menu-prd.md)

---

## 1. 模块目标

后台内容与配置模块负责平台运营侧管理：

- 管理全站内容状态、精选、可见性和删除。
- 管理小册、分类、标签、文件资源。
- 配置首页区块、菜单、主题和系统参数。
- 查看操作日志，保证关键操作可追溯。

首版不做：

- 多级内容审核工作流。
- 复杂 CMS 可视化搭建器。
- 文件版本管理。
- 自动内容推荐算法。

---

## 2. 角色与权限

| 角色     | 访问后台 |                                                 内容管理 | 系统配置 | 操作日志 |
| -------- | -------: | -------------------------------------------------------: | -------: | -------: |
| 普通会员 |       ❌ |                                                       ❌ |       ❌ |       ❌ |
| 编辑者   |       ❌ | 按 `content:*` OWN 权限创作自己的内容，不访问 `/admin/*` |       ❌ |       ❌ |
| 管理员   |       ✅ |                                                       ✅ |       ✅ |       ✅ |

规则：

- `/admin/*` 仅管理员可访问。
- 前端按钮显隐只改善体验，后端必须再次校验权限。
- 删除、下线、禁用、批量操作必须二次确认。

---

## 3. 页面清单

| 路由                        | 页面           | 说明                         |
| --------------------------- | -------------- | ---------------------------- |
| `/admin/content/list`       | 文档列表       | 全量内容管理                 |
| `/admin/content/booklets`   | 小册管理       | 小册章节、源文件、删除       |
| `/admin/content/categories` | 分类管理       | 树形分类                     |
| `/admin/content/tags`       | 标签管理       | 标签列表和删除               |
| `/admin/files`              | 文件管理       | 文件检索、预览、删除         |
| `/admin/homepage`           | 首页配置       | 首页模块显隐、排序、内容推荐 |
| `/admin/menus`              | 菜单管理       | 前台、工作区、后台菜单       |
| `/admin/system/theme`       | 主题与导航配置 | 见主题 PRD                   |
| `/admin/system`             | 系统配置       | Key-Value 配置               |
| `/admin/logs`               | 操作日志       | 关键操作追踪                 |

---

## 4. 文档列表

### 4.1 表格字段

| 字段          | 说明                               |
| ------------- | ---------------------------------- |
| `cover`       | 封面缩略图                         |
| `title`       | 标题                               |
| `type`        | 内容类型                           |
| `status`      | `DRAFT` / `PUBLISHED` / `ARCHIVED` |
| `visibility`  | `PUBLIC` / `LOGIN` / `PRIVATE`     |
| `author`      | 作者                               |
| `category`    | 分类                               |
| `isFeatured`  | 是否精选                           |
| `publishedAt` | 发布时间                           |
| `updatedAt`   | 更新时间                           |
| `actions`     | 编辑、发布/下线、精选、删除        |

### 4.2 筛选字段

| 字段         | 类型   | 默认值 |
| ------------ | ------ | ------ |
| `type`       | enum   | all    |
| `status`     | enum   | all    |
| `visibility` | enum   | all    |
| `categoryId` | string | 空     |
| `authorId`   | string | 空     |
| `keyword`    | string | 空     |
| `dateRange`  | date[] | 空     |

### 4.3 操作规则

| 操作 | 规则                         |
| ---- | ---------------------------- |
| 发布 | 草稿或归档内容可发布         |
| 下线 | 已发布内容可归档             |
| 精选 | 仅已发布内容可设为精选       |
| 删除 | 二次确认，记录操作日志       |
| 编辑 | 跳转工作区编辑页或后台详情页 |

---

## 5. 小册管理

### 5.1 表格字段

| 字段             | 说明     |
| ---------------- | -------- |
| `title`          | 小册标题 |
| `originalAuthor` | 原作者   |
| `chapterCount`   | 章节数   |
| `uploader`       | 上传者   |
| `status`         | 状态     |
| `updatedAt`      | 更新时间 |

### 5.2 详情抽屉

展示：

- 封面。
- 简介。
- 章节列表。
- 源文件信息。
- 阅读入口。

操作：

- 重新生成目录。
- 下载原始导入包。
- 编辑基础信息。
- 删除小册。

---

## 6. 分类与标签

### 6.1 分类管理

字段：

| 字段       | 必填 | 说明                         |
| ---------- | ---: | ---------------------------- |
| `name`     |   ✅ | 分类名称                     |
| `slug`     |   ✅ | URL 友好标识，自动生成可编辑 |
| `parentId` |   ❌ | 父分类                       |
| `sort`     |   ❌ | 排序                         |

规则：

- 分类支持树形结构。
- 删除前检查是否有关联内容或子分类。
- 拖拽排序只影响同级顺序。

### 6.2 标签管理

字段：

| 字段           | 说明       |
| -------------- | ---------- |
| `name`         | 标签名     |
| `slug`         | 标签标识   |
| `contentCount` | 关联内容数 |
| `createdBy`    | 创建者     |

规则：

- 标签名称大小写不敏感唯一。
- 删除前提示关联内容数量。

---

## 7. 文件管理

筛选：

- MIME 类型。
- 上传者。
- 时间范围。
- 关键字。

操作：

- 图片内嵌预览。
- PDF 新窗口预览。
- 下载。
- 删除。
- 批量删除。

删除规则：

- 管理删除先做逻辑删除并异步检查引用；仍被引用的文件不得物理删除。
- 删除成功写入 `audit_logs`，并由异步任务在 7 天回收窗口后清理无引用对象。

---

## 8. 首页配置

首页配置属于 `system_configs` 的 `site.homepage` 类型化配置组，不创建独立 `/admin/homepage` 资源。

配置区块：

| 区块        | 配置                             |
| ----------- | -------------------------------- |
| Hero        | 头像、姓名、简介、CTA 文案和链接 |
| 内容推荐    | 显隐、精选内容、排序             |
| AI 工具推荐 | 显隐、工具选择、排序             |
| 技术栈展示  | 显隐、技术条目、图标             |

操作：

- 保存。
- 预览。
- 恢复默认。

保存后：

- 清理 Redis 缓存。
- 后续 Next 接入时可由配置变更事件触发 revalidate；当前 React-first 阶段不依赖该行为。

---

## 9. 菜单与系统配置

### 9.1 菜单管理

菜单类型：

- `public`
- `workspace`
- `admin`
- `ai`

字段：

| 字段          | 说明                           |
| ------------- | ------------------------------ |
| `name`        | 菜单名称                       |
| `icon`        | 图标                           |
| `routeKey`    | 受前端路由注册表约束的内部目标 |
| `isVisible`   | 是否显示                       |
| `sort`        | 排序                           |
| `permissions` | 关联权限点                     |

### 9.2 系统配置

分组：

- `site`
- `theme`
- `navigation`
- `user`
- `ai`
- `content`

规则：

- 单项配置可编辑。
- 批量保存需要事务。
- 配置值按 `valueType` 校验。

---

## 10. 操作日志

记录范围：

- 内容发布、下线、删除、精选。
- 分类、标签、菜单变更。
- 系统配置变更。
- 文件删除。
- 用户禁用、角色调整、Token 配额调整。

字段：

| 字段         | 说明           |
| ------------ | -------------- |
| `action`     | 操作类型       |
| `targetType` | 操作对象类型   |
| `targetId`   | 操作对象 ID    |
| `user`       | 操作人         |
| `ip`         | IP             |
| `result`     | success / fail |
| `detail`     | JSON 详情      |
| `createdAt`  | 操作时间       |

---

## 11. API 对照

以下仅作页面对接定位；完整 DTO、权限和错误码以 Canonical API 为准，基础路径为 `/api/v1`。

| 模块          | Canonical 接口                                                                                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 内容          | `GET /admin/contents`、`POST /admin/contents/:contentId/publish`、`POST /admin/contents/:contentId/archive`、`PATCH /admin/contents/:contentId/featured`、`POST /admin/contents/:contentId/restore`、`DELETE /admin/contents/:contentId/purge` |
| 文件          | `GET /admin/files`、`DELETE /admin/files/:fileId`、`DELETE /admin/files`                                                                                                                                                                       |
| 首页/系统配置 | `GET /admin/system-configs`、`PUT /admin/system-configs/:group`；首页写入 `site.homepage`                                                                                                                                                      |
| 菜单          | `GET/POST /admin/menus`、`PATCH/DELETE /admin/menus/:menuId`、`PATCH /admin/menus/sort`                                                                                                                                                        |
| 审计          | `GET /admin/audit-logs`、`GET /admin/audit-logs/:logId`                                                                                                                                                                                        |

---

## 12. 验收标准

- 管理员能筛选、发布、下线、精选、删除内容。
- 分类树可新增、编辑、排序、删除。
- 标签可查看关联数量并删除。
- 文件被引用时无法删除。
- 首页配置保存后前台能读取新配置。
- 系统配置按类型校验。
- 关键操作能写入操作日志。
