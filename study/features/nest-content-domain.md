# Nest 内容域：可见性、枚举映射与公开读

## 场景背景

把 mock 内容中心接到 Nest 时，最容易错的不是 CRUD，而是：**库里的大写枚举、公开 SQL 可见性、Umi 已经解包成 T**。页面如果再读 `code === 0` 或把 `type=markdown` 原样传给 `forbidNonWhitelisted` 的 Query DTO，会整页 400。

## 核心概念

- **信封**：Nest 成功 `{ data }`，Umi 拦截器拆成业务对象 T。service 拿到的已经是列表/详情，不要再包一层。
- **两套枚举**：PostgreSQL / Prisma 是 `MARKDOWN`；React 卡片仍用 `ContentType.Markdown = 'markdown'`。转换只放 `packages/api-client`。
- **公开可见性在 SQL**：列表只出已发布的 PUBLIC + LOGIN；LOGIN 对访客是锁定卡片，详情 `401 AUTH_REQUIRED`；私有/草稿公开路径当 404。
- **可选登录**：`@Public()` 有合法 Bearer 就挂 `auth`，坏 Token 当匿名，这样登录用户能直接读 LOGIN 正文。

## 实现步骤

1. 先定 JSON 与可见性，再写 Prisma。`search_document` 可以建，中文检索仍用 `ILIKE`。
2. 公开 Controller 的 `featured` / `meta` 写在 `:contentId` 前面。
3. 前端 service 只打 `/api/v1/...`，失败空态，禁止回落 `/api/contents`。
4. 写接口带 `Idempotency-Key`；发布不要 `PUT { status }`。

## 常见错误

- Query 把 mock 的 `title`、`sort=latest`、`type=markdown` 直接转给 Nest（`sort` 必须是 `LATEST`/`POPULAR`；`richtext` 不能 `toUpperCase` 成 `RICHTEXT`）。
- PATCH 带上 `type` 或 `status`：DTO 没有这些字段，全局 `forbidNonWhitelisted` 会 400。
- 匿名滚动详情时狂发阅读进度：未登录会 401 刷 toast。
- 已接 Nest 的路径失败后再打 mock。
- 不要从 `@personal-hub/api-client` 引入**新**导出到正在热更新的 Umi 页：MFSU 预打包后新符号经常是 `undefined`。内容映射放在各端 `services/mapNestContent.ts`。
- 分类不是可随意写死的 slug：新建页和编辑页应读取内容元数据中的启用分类，并在创建时要求选择。历史草稿若缺分类，发布前应在页面内引导补选，而不是把后端校验错误留给用户猜。
- 编辑器全屏只应调整外层布局和尺寸。富文本编辑器若因 `minHeight` prop 变化而重新初始化，会清空内存中的未保存编辑状态；将高度通过外层 React 样式传入可避免该问题。
- **动作权限决定数据范围**：`content:read=ALL` 只代表可跨作者读取；更新、发布、删除、恢复必须分别按对应动作的 `OWN/ALL` 判定，不能复用读取权限。
- **富文本要存两种表示**：编辑器原始 JSON 只供工作区编辑，服务端必须从其中的 HTML 生成净化后的 `renderedHtml`，公开详情只能返回后者。净化后为空的富文本不能发布。
- **幂等的前后端是一组约定**：Controller 加 `RequireIdempotency` 后，前端每个对应写请求都要带新的 `Idempotency-Key`；否则重试保护会退化为客户端 400。
- **失败不能伪装成空数据**：章节索引、阅读进度等请求要么由页面画错误态，要么显式捕获并停止重试；把 401/404 转成空数组会掩盖真实权限或资源错误。

## 手动验证

1. `MOCK=none` 打开首页，应看到 seed 的精选 Markdown。
2. 内容中心搜「知识」或「Nest」，访客能命中标题/摘要。
3. 点「登录可见」卡片，应出现登录引导而不是把正文漏出来。
