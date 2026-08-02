# 文档内容与创作工具体系

> 状态：🟢 产品与 UI 说明；数据、状态与接口以 [Canonical 数据模型](../backend/canonical-data-model.md)、[Canonical API](../backend/canonical-api.md) 和长期内容 PRD 为准
> 最后更新：2026-08-02

---

## 语义边界调整

当前 React-first 页面将“小册 / PDF / Markdown / 富文本 / Word”展示为创作入口；未来 Nest 统一以 Canonical 内容域落地。它仍拆成两层：

### 第一层：文档内容域

负责：

- 阅读
- 查看
- 检索
- 收藏
- 进度恢复
- 发布与可见性控制

可以理解成“文档资源库”。

### 第二层：创作与处理工具域

负责：

- 上传
- 编辑
- 协作
- 导出 / 下载
- 专项管理

可以理解成“工作区中的文档工具箱”。

> 这样拆分以后，`content` 更偏“资源与阅读”，`tool` 更偏“操作与生产”，语义会比之前清楚很多。

---

## 文档统一模型

所有可阅读、可查看的文档资源共用一套主模型，不为每种格式完全拆出独立主表；但允许为特定文档类型补充子表或专属元数据。

### 核心字段

| 字段        | 类型     | 说明                                                       |
| ----------- | -------- | ---------------------------------------------------------- |
| id          | UUID     | 唯一标识                                                   |
| title       | string   | 草稿可为空或临时标题；发布必须为 1～200 字                 |
| type        | enum     | 见下方枚举                                                 |
| summary     | text     | 摘要，不填时系统自动截取 contentRaw 前 200 字              |
| contentRaw  | text     | Markdown 原文；富文本改存编辑器 JSON                       |
| contentHtml | text     | 服务端净化后的派生产物，前端不直接写入                     |
| toc         | JSONB    | 目录结构（`[{level, text, anchor}]`）                      |
| sourceType  | enum     | upload（用户上传）/ import（系统导入）/ manual（手动创建） |
| categoryId  | UUID     | 草稿可为空；发布必须为有效、启用分类                       |
| cover       | UUID     | `coverFileId`，关联 FileAsset，不信任前端 URL              |
| fileId      | UUID     | `primaryFileId`，关联 READY FileAsset                      |
| externalUrl | string   | 外部链接地址（link 类型）                                  |
| extraMeta   | JSONB    | 类型专属扩展数据（项目卡片、小册元数据、Word 元数据等）    |
| visibility  | enum     | `PUBLIC` / `LOGIN` / `PRIVATE`，独立于状态                 |
| status      | enum     | `DRAFT` / `PUBLISHED` / `ARCHIVED`                         |
| isFeatured  | boolean  | 是否精选（首页推荐优先展示）                               |
| readCount   | int      | 累计阅读次数                                               |
| wordCount   | int      | 字数（Markdown / 富文本类型计算）                          |
| authorId    | UUID     | 创建者用户 ID                                              |
| publishedAt | datetime | 发布时间（status 变为 published 时记录）                   |
| createdAt   | datetime | —                                                          |
| updatedAt   | datetime | —                                                          |

### type 枚举

| 值                 | 说明                                     |
| ------------------ | ---------------------------------------- |
| `MARKDOWN`         | Markdown 笔记                            |
| `RICH_TEXT`        | 富文本编辑器 JSON                        |
| `BOOKLET`          | 小册（导入来源另以 `importSource` 表达） |
| `PDF` / `WORD`     | 关联主文件的文件型内容                   |
| `LINK` / `PROJECT` | 经校验的 HTTPS 外链                      |

### 扩展展示元数据（按类型）

以下仅描述 UI 展示所需的可扩展信息；Canonical 主字段、正文和章节存储以数据模型为准，不将其作为可直接写入的通用 `extraMeta` 契约。

```json
// project 类型
{
  "githubUrl": "https://github.com/xxx/repo",
  "previewUrl": "https://demo.example.com",
  "techStack": ["React", "NestJS", "PostgreSQL"]
}

// BOOKLET 导入展示元数据
{
  "originalAuthor": "作者名",
  "totalChapters": 24,
  "importedAt": "2026-05-01",
  "sourceFormat": "zip"
}

// word 类型
{
  "fileExtension": "docx",
  "pageCount": 12,
  "lastExportedAt": "2026-06-01T12:00:00Z"
}
```

---

## 文档阅读与工具能力的对应关系

| 文档类型     | 阅读 / 查看 | 上传                     | 编辑             | 下载 / 导出       | 协作 | 说明                           |
| ------------ | ----------- | ------------------------ | ---------------- | ----------------- | ---- | ------------------------------ |
| BOOKLET 小册 | ✅          | 经 `booklet:import` 授权 | 导入后元信息维护 | 按版权/可见性校验 | ❌   | 有独立小册管理区               |
| PDF          | ✅          | ✅                       | ❌（首版不内建） | ✅                | ❌   | 保留阅读，编辑交给外部成熟工具 |
| Word         | ✅          | ✅                       | 后续能力         | ✅                | 后续 | 以 `.docx` 为主                |
| Markdown     | ✅          | ✅                       | ✅               | ✅                | 后续 | 编辑后支持预览                 |
| 富文本       | ✅          | ✅                       | ✅               | ✅                | ✅   | 基于 Textbus                   |
| 外部链接     | ✅          | 手动录入                 | ❌               | 跳外链            | ❌   | 仅做资源卡片                   |

> 这里的“编辑能力”属于工作区工具域，不代表所有阅读页都承担编辑职责。

---

## 内容分类管理

- **结构**：树形，支持无限层级（实践中建议最多 3 级）
- **管理方式**：由管理员在后台手动创建和维护，不支持用户自建分类
- **字段**：名称、Slug（URL 友好标识）、父分类（可选）、排序权重
- **删除约束**：分类下有内容时不可删除，需先将内容移入其他分类

---

## 内容标签管理

- **结构**：平铺标签，多对多关联
- **创建权限**：`editor` 角色及以上可在创建/编辑内容时新建标签，直接生效
- **删除权限**：仅 `admin` 可在后台删除标签
- **重名处理**：标签名唯一（大小写不敏感），重复提交时复用已有标签

---

## 章节子表（掘金小册 / 分章内容）

`content_chapters` 表：

| 字段        | 类型     | 说明                       |
| ----------- | -------- | -------------------------- |
| id          | UUID     | —                          |
| contentId   | UUID     | 关联主表 `contents.id`     |
| title       | string   | 章节标题                   |
| contentRaw  | text     | 章节 Markdown 原文         |
| contentHtml | text     | 渲染后 HTML                |
| toc         | JSONB    | 章节标题目录（`h2/h3/h4`） |
| wordCount   | int      | 章节字数，首版可为空       |
| sort        | int      | 排序序号（从 1 开始）      |
| createdAt   | datetime | —                          |
| updatedAt   | datetime | —                          |

**章节目录展示方式（阅读页）**：

- 最左侧栏：当前用户可访问的全部小册列表
- 左侧栏：当前选中小册的章节列表
- 中间主区：当前章节正文
- 右侧栏：当前章节标题目录（`h2/h3/h4`）
- 当前章节高亮，可点击直接跳转
- 顶部进度条：`第 X / 共 Y 章`
- 章节间底部导航：[← 上一章] [下一章 →]
- 登录用户的阅读位置（当前章节 + 滚动位置）持久化保存

详细 PRD 见 [content-reading-prd.md](../prd/react-first/content-reading-prd.md)。

---

## 小册导入与版权边界

> 现有工作区小册管理页面保留为 React mock/UI 入口；真实导入、下载和可见性必须由 Nest 服务端执行。

### 目录规范

导入器期望的目录结构：

```
booklet-dir/
├── meta.json          ← 小册元数据
├── chapter-01-xxx.md  ← 章节文件（文件名前缀数字决定排序）
├── chapter-02-xxx.md
└── ...
```

`meta.json` 格式：

```json
{
  "title": "小册标题",
  "author": "原作者名",
  "summary": "小册简介",
  "cover": "cover.jpg",
  "categorySlug": "frontend"
}
```

### 导入流程

1. 用户先经上传会话上传 ZIP，完成后得到临时 `FileAsset`。
2. 仅拥有 `booklet:import` 且满足 `OWN/ALL` 的主体可创建异步导入任务；创建和重试均必须使用幂等键。
3. Worker 在隔离目录校验 ZIP 并解析可选 `meta.json`、Markdown 章节；前端轮询任务，不在 HTTP 请求中同步解压。
4. 成功后创建 `BOOKLET`、章节索引和对象存储正文，默认 **`DRAFT + PRIVATE + private_until_licensed`**。
5. 导入作者与管理员可在结果页查看进度、成功数、受限告警与失败原因；章节阅读按单章加载。

### 小册管理区能力

工作区单独提供「小册管理」页面，至少包含：

- 小册列表
- 上传小册
- 下载小册源文件
- 查看导入状态
- 打开阅读
- 编辑小册元信息
- 删除小册

### 权限与版权说明

- 仅登录不是导入授权；必须校验 Canonical `booklet:import` 动作权限及 `OWN/ALL` 范围。
- 导入小册即使被发布，仍仅作者/管理员可阅读、下载和管理。
- 只有管理员执行携带授权说明的“解除导入限制”操作并写审计后，才可改为 `LOGIN` 或 `PUBLIC`；前端显隐不能替代该规则。

### 首版安全限制

- 仅支持 Markdown 章节 ZIP；`meta.json` 可选，缺失时补全元数据而非拒绝合法章节。
- ZIP 最大 50 MB、解压总量最大 500 MB、最多 1,000 章、单章最大 2 MB。
- 拒绝路径穿越、符号链接、未知文件、非法编码和 ZIP bomb；Markdown 渲染前净化 HTML。
- 章节列表不返回正文，正文只能通过单章接口按需读取；原始 ZIP 也遵从内容可见性校验。

---

## PDF 文档策略

PDF 在当前项目里的定位是：

- 保留查看 / 阅读能力
- 保留上传与下载能力
- 首版不内建 PDF 富编辑器

原因：

- PDF 编辑器实现成本高
- 交互复杂
- 与本项目主线“知识管理 + 文档创作 + AI 工具”相比，不是首版最高优先级

因此首版建议：

- 平台内负责上传、预览、阅读、下载
- 编辑交给外部成熟 PDF 工具
- 平台内可预留“使用外部工具编辑后重新上传版本”的工作流

---

## Word 文档策略

Word 在当前项目中的定位不是纯附件，而是可打开、可编辑、可导出的文档类型。

首版目标：

- 上传 `.docx`
- 打开文档
- 编辑文档
- 保存文档
- 下载文档

建议实现方向：

- 主存储仍走文件型文档
- 阅读时可转预览结构
- 编辑时使用独立 Word 编辑器界面
- 保存后回写文档内容与版本信息

---

## Markdown 文档策略

Markdown 保留“阅读 / 查看 / 预览”能力，同时强化“编辑”能力。

首版目标：

- Markdown 阅读页
- Markdown 编辑器
- 预览按钮
- 保存草稿
- 发布后进入内容中心阅读

说明：

- 阅读页属于文档内容域
- 编辑器属于工具域
- 不把编辑器直接塞进公开阅读页里

---

## 富文本文档策略

富文本不再只定位为“文章展示格式”，而是定位为“可编辑、可保存、可协作的富文本文档”。

首版目标：

- 富文本阅读
- 富文本编辑
- 保存富文本
- 文档详情查看
- 预留多人协作能力

框架选择：

- 富文本编辑器从原先的 Tiptap 调整为 **Textbus**

原因：

- 更贴近“文档编辑与协作”场景
- 比“博客文章编辑器”更符合你当前的产品方向

### 协作说明

- 首版先完成单人编辑与保存
- 多人协作作为增强功能设计，但在数据结构和接口上预留版本信息、操作日志、协作会话入口

---

## 文件与存储关系

- PDF / Word 类内容：`contents.fileId` 关联 `file_assets` 表
- 封面图：上传至文件系统，`contents.cover` 存访问 URL
- **文件访问统一经后端代理输出**，不暴露本地磁盘路径
- 存储路径格式（本地）：`/uploads/{year}/{month}/{uuid}.{ext}`

---

## 搜索能力

| 阶段 | 方案                              | 搜索字段                                          |
| ---- | --------------------------------- | ------------------------------------------------- |
| 首版 | PostgreSQL 全文搜索（`tsvector`） | title / summary / tags / contentRaw（前 5000 字） |
| 后续 | Meilisearch 独立搜索引擎          | 全字段索引，支持中文分词、高亮、facet 过滤        |

---

## 阅读进度与历史

- 阅读历史：用户打开内容详情页即记录（非登录用户不记录）
- 进度保存：首版仅掘金小册和 PDF 类型
  - 小册：保存当前章节 ID + 章节内滚动偏移量（px）
  - PDF：保存当前页码
- 下次打开时自动恢复位置（toast 提示"已恢复上次阅读位置"）
