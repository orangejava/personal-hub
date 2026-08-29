# 内容阅读 PRD：Markdown 与掘金小册

> 状态：规划中
> 最后更新：2026-06-09
> 优先级：P0
> 目标：优先打通 Markdown 文档阅读与掘金小册阅读，这是项目第一条内容业务闭环。

---

## 1. 模块目标

首版先解决“能读”：

- 用户能在内容中心看到 Markdown 文档和掘金小册。
- 用户能打开 Markdown 文档阅读。
- 用户能打开掘金小册，按章节阅读。
- 登录用户能收藏内容。
- 登录用户能保存阅读进度。
- 阅读页能展示目录、代码高亮、复制代码、上一篇/下一篇或上一章/下一章。

暂不做：

- 复杂 Markdown 在线编辑器。
- 小册增量导入。
- 小册章节内图片自动转存。
- 多人协作。
- 支付或购买能力。

---

## 2. 用户角色

| 角色 | Markdown 阅读 | 小册阅读 | 收藏 | 阅读进度 | 上传/导入 |
|---|---:|---:|---:|---:|---:|
| 访客 | 仅 public 内容 | 仅 public 内容 | ❌ | ❌ | ❌ |
| 普通会员 | public + login 内容 | public + login 内容 | ✅ | ✅ | 待业务确认 |
| 编辑者 | 可读可管理本人内容 | 可读可导入 | ✅ | ✅ | ✅ |
| 管理员 | 全部可见 | 全部可见 | ✅ | ✅ | ✅ |

权限规则：

- `public`：所有人可读。
- `login`：登录后可读。
- `private`：作者本人和管理员可读。
- 未登录访问 `login` 内容：展示登录引导。
- 无权限访问 `private` 内容：展示 403。

---

## 3. 页面清单

| 路由 | 页面 | 权限 | 首版范围 |
|---|---|---|---|
| `/content` | 内容中心列表 | 按内容可见性过滤 | 展示 Markdown、小册卡片 |
| `/content/[id]` | Markdown 阅读页 / 小册入口页 | 按内容可见性 | 根据 `type` 分发渲染 |
| `/content/[id]/chapters/[chapterId]` | 小册章节阅读页 | 按内容可见性 | 推荐小册使用独立章节路由 |
| `/workspace/booklets` | 小册管理 | 登录 | 首版可后置，但阅读页需能承接数据 |
| `/workspace/markdown` | Markdown 创建/编辑 | `content:upload` | 首轮阅读闭环后再做 |

说明：

- 小册章节可以使用 query 参数，也可以使用独立章节路由。推荐独立路由，利于刷新、分享和恢复阅读。
- `/content/[id]` 如果是小册类型，默认跳转最近阅读章节；没有阅读记录则跳第一章。

---

## 4. 内容中心列表页

### 4.1 页面结构

```txt
┌────────────────────────────────────────────────────┐
│ 标题：内容中心                                      │
│ 描述：沉淀学习、项目和 AI 可引用的知识内容            │
├────────────────────────────────────────────────────┤
│ 筛选栏：分类 / 标签 / 类型 / 搜索 / 排序             │
├────────────────────────────────────────────────────┤
│ 内容卡片网格                                        │
│ [Markdown 卡片] [小册卡片] [Markdown 卡片]           │
├────────────────────────────────────────────────────┤
│ 加载更多 / 分页                                     │
└────────────────────────────────────────────────────┘
```

### 4.2 筛选字段

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `keyword` | string | 空 | 搜索标题、摘要、标签 |
| `categoryId` | string | 空 | 分类 ID |
| `tagIds` | string[] | 空数组 | 多标签筛选 |
| `type` | enum[] | `markdown,juejin_booklet` | 首版优先展示这两类 |
| `sortBy` | enum | `latest` | `latest` / `readCount` |
| `page` | number | 1 | 页码 |
| `pageSize` | number | 12 | 每页数量 |

### 4.3 卡片字段

| 字段 | 说明 |
|---|---|
| `id` | 内容 ID |
| `title` | 标题 |
| `type` | `markdown` / `juejin_booklet` |
| `summary` | 摘要，最多展示 3 行 |
| `cover` | 封面，无封面展示类型占位色块 |
| `category` | 分类名称 |
| `tags` | 最多展示 3 个 |
| `readCount` | 阅读数 |
| `wordCount` | 字数，仅 Markdown 可展示 |
| `chapterCount` | 章节数，仅小册展示 |
| `publishedAt` | 发布时间 |
| `isFavorited` | 当前用户是否收藏 |

### 4.4 状态

| 状态 | 展示 |
|---|---|
| loading | 卡片骨架屏 |
| empty | 插图 + “暂无内容，换个筛选条件试试” |
| error | 错误提示 + 重试按钮 |
| 未登录但查看 public 列表 | 正常展示，收藏按钮引导登录 |

---

## 5. Markdown 阅读页

### 5.1 页面结构

```txt
┌────────────────────────────────────────────────────────────┐
│ 面包屑：内容中心 > 分类 > 标题                              │
├──────────────┬──────────────────────────┬──────────────────┤
│ 左侧信息栏    │ 正文区域                  │ 右侧目录          │
│ 分类/标签     │ 标题                      │ h2/h3/h4          │
│ 阅读数        │ 作者、日期、字数           │ 当前标题高亮       │
│ 收藏按钮      │ Markdown HTML             │                  │
└──────────────┴──────────────────────────┴──────────────────┘
```

移动端：

- 左侧信息栏收起到标题下方。
- 右侧目录变为“目录”按钮，点击抽屉展示。
- 底部固定操作栏展示收藏、复制链接、回到顶部。

### 5.2 页面字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 内容 ID |
| `title` | string | 标题 |
| `summary` | string | 摘要 |
| `contentHtml` | string | 后端渲染好的 HTML |
| `toc` | array | 标题目录 |
| `category` | object | 分类 |
| `tags` | array | 标签 |
| `author` | object | 作者 |
| `publishedAt` | datetime | 发布时间 |
| `updatedAt` | datetime | 更新时间 |
| `readCount` | number | 阅读数 |
| `wordCount` | number | 字数 |
| `isFavorited` | boolean/null | 收藏状态 |
| `readingRecord` | object/null | 阅读进度 |

### 5.3 功能逻辑

#### 页面进入

1. 服务端请求 `GET /api/contents/:id`。
2. 后端检查可见性。
3. 后端返回内容详情、目录、收藏状态、阅读记录。
4. 前端渲染 HTML。
5. 如果有阅读记录，提示“已恢复上次阅读位置”，并滚动到记录位置。

#### 阅读数

- 内容详情成功返回后，后端异步增加阅读数。
- 同一用户短时间重复刷新不应无限增加，建议 Redis 做 10 分钟去重。

#### 收藏

- 未登录点击收藏：弹出登录引导。
- 已登录点击收藏：
  - 未收藏：`POST /api/favorites/:contentId`
  - 已收藏：`DELETE /api/favorites/:contentId`
- 成功后本地切换状态。
- 失败后 Toast 提示。

#### 阅读进度

保存条件：

- 登录用户。
- 页面滚动超过 300px。
- 每 10 秒或离开页面时保存一次。

请求：

```http
PUT /api/reading-records/:contentId
```

请求体：

```json
{
  "scrollPosition": 1200,
  "progress": 45.5
}
```

#### 代码块

- 服务端使用 Shiki 渲染代码高亮。
- 前端为代码块增加复制按钮。
- 复制成功显示 Toast。
- 代码块过宽时横向滚动，不撑破正文。

### 5.4 异常状态

| 场景 | 页面行为 |
|---|---|
| 内容不存在 | 404 页面 |
| 内容 archived | 普通用户 404，管理员可从后台预览 |
| login 内容未登录 | 登录引导卡片 |
| private 内容无权限 | 403 页面 |
| contentHtml 为空 | 显示“内容暂不可用” |
| toc 为空 | 隐藏右侧目录 |

---

## 6. 掘金小册阅读页

### 6.1 页面结构

```txt
┌────────────────────────────────────────────────────────────────┐
│ 顶部：小册标题 / 阅读进度 / 返回内容中心                         │
├──────────────┬────────────────┬────────────────────┬────────────┤
│ 小册列表      │ 章节目录         │ 当前章节正文          │ 章节内目录  │
│ 可切换小册    │ 第 1 章...       │ Markdown HTML        │ h2/h3/h4   │
└──────────────┴────────────────┴────────────────────┴────────────┘
```

移动端：

- 默认只展示正文。
- 小册列表和章节目录合并为“章节”抽屉。
- 章节内目录合并为“目录”抽屉。
- 底部展示上一章 / 下一章。

### 6.2 小册入口逻辑

访问：

```txt
/content/[id]
```

如果内容类型是 `juejin_booklet`：

1. 查询用户阅读记录。
2. 如果有 `chapterId`，跳转 `/content/[id]/chapters/[chapterId]`。
3. 如果没有记录，跳转第一章。
4. 如果没有章节，展示“暂无章节”。

### 6.3 章节阅读字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `booklet.id` | string | 小册内容 ID |
| `booklet.title` | string | 小册标题 |
| `booklet.summary` | string | 小册简介 |
| `booklet.cover` | string | 封面 |
| `booklet.extraMeta.originalAuthor` | string | 原作者 |
| `booklet.totalChapters` | number | 总章节数 |
| `chapters` | array | 章节列表 |
| `currentChapter.id` | string | 当前章节 ID |
| `currentChapter.title` | string | 当前章节标题 |
| `currentChapter.contentHtml` | string | 当前章节 HTML |
| `currentChapter.toc` | array | 当前章节目录 |
| `currentChapter.sort` | number | 当前章节排序 |
| `prevChapter` | object/null | 上一章 |
| `nextChapter` | object/null | 下一章 |
| `readingRecord` | object/null | 阅读记录 |

### 6.4 章节目录字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 章节 ID |
| `title` | string | 章节标题 |
| `sort` | number | 从 1 开始 |
| `wordCount` | number | 预留字段，首版可为空 |
| `readProgress` | number | 当前用户该章阅读进度，后续预留 |

### 6.5 功能逻辑

#### 切换章节

点击章节：

1. 跳转 `/content/[id]/chapters/[chapterId]`。
2. 请求章节详情。
3. 正文滚动到顶部。
4. 更新当前章节高亮。
5. 保存阅读记录中的 `chapterId`。

#### 上一章 / 下一章

- 第一章隐藏“上一章”或置灰。
- 最后一章隐藏“下一章”或显示“已读完”。
- 点击后走正常章节跳转。

#### 阅读进度

小册阅读记录保存：

```json
{
  "chapterId": "chapter_001",
  "scrollPosition": 800,
  "progress": 12.5
}
```

`progress` 计算：

```txt
progress = ((当前章节序号 - 1) + 当前章节内滚动百分比) / 总章节数 * 100
```

保存时机：

- 切换章节前。
- 每 10 秒。
- 页面隐藏或离开前。

#### 小册列表

首版可以只展示当前用户可访问的小册：

```http
GET /api/contents?type=juejin_booklet&pageSize=100
```

后续可新增专门接口：

```http
GET /api/booklets/accessible
```

---

## 7. 后端接口草案

### 7.1 内容列表

```http
GET /api/contents
```

新增/明确参数：

| 参数 | 说明 |
|---|---|
| `type` | 支持 `markdown,juejin_booklet` |
| `includeStats` | 是否返回章节数、收藏状态等 |

### 7.2 Markdown 详情

```http
GET /api/contents/:id
```

后端职责：

- 校验可见性。
- 如果是 Markdown，返回 `contentHtml` 和 `toc`。
- 如果是小册，返回小册基础信息和章节摘要，不返回所有章节正文。
- 返回当前用户收藏状态和阅读记录。

### 7.3 小册章节列表

```http
GET /api/contents/:id/chapters
```

响应：

```json
{
  "items": [
    { "id": "c1", "title": "第一章", "sort": 1 },
    { "id": "c2", "title": "第二章", "sort": 2 }
  ]
}
```

### 7.4 小册章节详情

```http
GET /api/contents/:id/chapters/:chapterId
```

响应：

```json
{
  "booklet": {
    "id": "booklet_1",
    "title": "小册标题",
    "summary": "...",
    "cover": "...",
    "extraMeta": {
      "originalAuthor": "作者名"
    }
  },
  "chapters": [
    { "id": "c1", "title": "第一章", "sort": 1 },
    { "id": "c2", "title": "第二章", "sort": 2 }
  ],
  "currentChapter": {
    "id": "c1",
    "title": "第一章",
    "sort": 1,
    "contentHtml": "<h2>...</h2>",
    "toc": [{ "level": 2, "text": "标题", "anchor": "title" }]
  },
  "prevChapter": null,
  "nextChapter": { "id": "c2", "title": "第二章", "sort": 2 },
  "readingRecord": {
    "chapterId": "c1",
    "scrollPosition": 800,
    "progress": 12.5
  }
}
```

### 7.5 阅读记录

```http
PUT /api/reading-records/:contentId
```

请求体：

```json
{
  "chapterId": "c1",
  "scrollPosition": 800,
  "progress": 12.5
}
```

校验：

- `chapterId` 必须属于当前 `contentId`。
- `progress` 范围为 `0-100`。
- `scrollPosition` 不能小于 0。

---

## 8. 数据模型影响

沿用已有表：

- `contents`
- `content_chapters`
- `favorites`
- `reading_records`
- `categories`
- `tags`

建议补充字段或约定：

| 表 | 字段 / 约定 | 说明 |
|---|---|---|
| `content_chapters` | `toc Json?` | 建议后续增加章节级目录，避免每次从 HTML 解析 |
| `content_chapters` | `wordCount Int?` | 建议后续增加章节字数 |
| `contents.extraMeta.totalChapters` | number | 小册总章节数 |
| `contents.extraMeta.originalAuthor` | string | 小册原作者 |
| `reading_records.chapterId` | string | 当前阅读章节 |

如果首版不改数据库，也可以把章节 `toc` 临时由后端从 `contentHtml` 解析后返回；但长期建议落库。

---

## 9. Markdown 渲染规则

### 9.1 后端处理

导入或保存 Markdown 时：

1. 保存原文到 `contentRaw` 或 `content_chapters.contentRaw`。
2. 使用 Markdown 渲染器转 HTML。
3. 使用 Shiki 处理代码块。
4. 使用 sanitize 白名单清理 HTML。
5. 提取 `h2/h3/h4` 生成 `toc`。
6. 保存 `contentHtml` 和 `toc`。

### 9.2 安全规则

必须过滤：

- `<script>`
- 内联事件，如 `onclick`
- 不安全 URL，如 `javascript:`
- iframe 首版默认禁用

允许：

- 标题、段落、列表、表格。
- 代码块。
- blockquote。
- 图片，但图片地址必须是 http(s) 或后端文件 URL。
- 外链，自动添加 `rel="noopener noreferrer"`。

---

## 10. 前端组件拆分建议

```txt
components/public/content/
├── ContentListPage.tsx
├── ContentCard.tsx
├── ContentFilters.tsx
├── MarkdownReader.tsx
├── BookletReader.tsx
├── BookletChapterSidebar.tsx
├── ReaderToc.tsx
├── ReaderActions.tsx
├── CodeBlockCopyButton.tsx
└── ReadingProgressRestorer.tsx
```

hooks：

```txt
hooks/
├── use-reading-progress.ts
├── use-active-heading.ts
└── use-favorite-toggle.ts
```

请求：

```txt
lib/api/
├── content.api.ts
├── favorite.api.ts
└── reading.api.ts
```

---

## 11. 验收标准

### Markdown 阅读

- 内容中心能筛选 Markdown。
- 点击 Markdown 卡片能进入阅读页。
- 标题、作者、分类、标签、发布时间、正文正常展示。
- 右侧目录能点击跳转。
- 代码块高亮正常，复制按钮可用。
- 未登录用户可读 public 内容。
- 登录用户刷新后能恢复阅读位置。
- 收藏 / 取消收藏可用。

### 掘金小册阅读

- 内容中心能筛选小册。
- 点击小册能进入上次阅读章节或第一章。
- 左侧章节列表正常展示并高亮当前章节。
- 点击章节能切换正文。
- 上一章 / 下一章可用。
- 顶部阅读进度能正确变化。
- 登录用户刷新后能恢复章节和滚动位置。
- 移动端能通过抽屉打开章节目录。

### 安全与异常

- 无权限内容不会泄露正文。
- archived 内容普通用户不可见。
- HTML 中脚本不会执行。
- 接口失败时有错误提示和重试入口。
