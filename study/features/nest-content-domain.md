# Nest 内容域：可见性、枚举映射与公开读

## 场景背景

把 mock 内容中心接到 Nest 时，最容易错的不是 CRUD，而是：**库里的大写枚举、公开 SQL 可见性、Umi 已经解包成 T**。页面如果再读 `code === 0` 或把 `type=markdown` 原样传给 `forbidNonWhitelisted` 的 Query DTO，会整页 400。

## 核心概念

- **信封**：Nest 成功 `{ data }`，Umi 拦截器拆成业务对象 T。service 拿到的已经是列表/详情，不要再包一层。
- **两套枚举**：PostgreSQL / Prisma 是 `MARKDOWN`；React 卡片仍用 `ContentType.Markdown = 'markdown'`。转换只放 `packages/api-client`。
- **公开可见性在 SQL**：匿名列表只出已发布 PUBLIC；登录用户再加 LOGIN、自己已发布的 PRIVATE、授权给自己的 PRIVATE。详情对未授权私密内容返回 404。
- **可选登录**：`@Public()` 有合法 Bearer 就挂 `auth`，坏 Token 当匿名，这样登录用户能直接读 LOGIN 正文。

## 实现步骤

1. 先定 JSON 与可见性，再写 Prisma。`search_document` 可以建，中文检索仍用 `ILIKE`。
2. 公开 Controller 的 `featured` / `meta` 写在 `:contentId` 前面。
3. 前端 service 只打 `/api/v1/...`，失败空态，禁止回落 `/api/contents`。
4. 写接口带 `Idempotency-Key`；发布不要 `PUT { status }`。
5. “指定用户可见”用独立授权关系，不增加 `SHARED` 枚举。列表查询用 relation filter，详情、章节、收藏、进度和 AI 引用复用同一业务判定。

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
- **授权不是角色**：`content_access_grants` 只允许走前台阅读链路，不能让读者进入作者工作区，也不能隐式获得编辑、发布或源文件下载能力。
- **版权闸优先于分享**：`PRIVATE_UNTIL_LICENSED` 未清除时，即使作者选择了指定用户也必须在服务端拒绝，不能只禁用前端控件。
- **可见性切换要清历史授权**：PRIVATE 改成 PUBLIC/LOGIN 时在同一事务删除名单，避免以后切回 PRIVATE 后旧读者意外恢复权限。
- **跨接口并发要锁同一业务主行**：授权 PUT 在事务外检查 PRIVATE 仍会与可见性 PATCH 产生检查后使用竞态。应在授权事务内对 `contents` 行执行 `SELECT ... FOR UPDATE`，锁后重新校验可见性与版权闸；这样 PATCH 的 `UPDATE contents` 和授权替换共享同一把数据库行锁，最终状态按提交顺序收敛。
- **异步抽屉要绑定资源版本**：`forceRender` 会让表单在关闭后继续存活。切换资源时应先清表单，以加载序号丢弃过期响应，并在 `loadedContentId` 与当前 ID 一致前禁用提交；只用 `cancelled` 标志不能防止新资源加载期间提交旧值。

## 手动验证

1. `MOCK=none` 打开首页，应看到 seed 的精选 Markdown。
2. 内容中心搜「知识」或「Nest」，访客能命中标题/摘要。
3. 点「登录可见」卡片，应出现登录引导而不是把正文漏出来。
4. 发布一篇 PRIVATE 内容：作者列表可见、普通会员 404；添加会员邮箱后该会员可读和收藏，撤销后详情与收藏列表立即失效。
