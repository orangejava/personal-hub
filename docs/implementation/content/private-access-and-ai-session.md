# 私密内容授权与 AI 首次会话修复

> 状态：已实现
> 最后更新：2026-09-26

## 1. 目标与范围

- 保留 `PUBLIC | LOGIN | PRIVATE`，让 PRIVATE 同时支持“仅自己”和“指定用户”。
- 作者与指定读者可在前台内容中心读取已发布私密内容，其他主体看不到资源元数据。
- 修复 AI 新对话首次发送时，会话占位 ID 切换为真实 ID 后错误取消或清空 SSE 回复的问题。
- 本期不向指定读者开放工作区编辑、发布、授权管理或源 ZIP 下载。

## 2. 内容访问链路

```text
工作区编辑信息
  -> GET /app/contents/:id + GET /app/contents/:id/access-grants
  -> 选择“仅自己 / 指定用户”
  -> PATCH 内容元信息
  -> PUT /app/contents/:id/access-grants（完整替换）

前台内容中心
  -> publicListWhere 在数据库查询中合并公开内容、作者私密内容、受授权私密内容
  -> publicDetailAccess 再校验发布态、版权闸、作者/ALL/授权名单
  -> 章节、收藏、阅读进度复用同一详情判定
```

授权表使用 `(content_id, user_id)` 复合主键，按规范化邮箱匹配启用账号。作者默认可见，不写入授权表；请求中出现作者邮箱时，PUT 响应通过 `ignoredEmails` 明确返回，前端按响应中的最终 `list` 回填并提示。更新为非 PRIVATE 时清空名单；版权闸为 `PRIVATE_UNTIL_LICENSED` 时拒绝添加读者。授权用户可以把符合条件的私密内容作为 AI 引用，AI 服务再次执行相同的发布态与版权闸检查。

授权替换事务先对 `contents` 主行执行 `SELECT ... FOR UPDATE`，再重新校验所有权、PRIVATE 可见性和版权闸，最后删除并重建名单。内容 PATCH 会更新同一主行并取得相同行锁，因此两个请求按数据库实际提交顺序串行：PUT 先完成时，后续公开 PATCH 会清空名单；PATCH 先完成时，后续 PUT 会读到非 PRIVATE 并返回 409。

编辑信息抽屉在每次打开或切换 `contentId` 时先重置表单，并用单调递增的加载序号丢弃旧请求响应。只有当前内容详情和授权名单都成功返回后才记录 `loadedContentId` 并允许保存；加载中、加载失败和保存中均不可提交，避免上一篇内容的数据写入当前内容。

详情与授权名单并行读取时关闭全局请求错误提示，由抽屉对本轮失败统一提示一次。两个结果分别落表单：授权接口失败不再丢弃已经成功读取的标题、分类、摘要和可见性，只禁用指定读者控件与保存；这样自定义角色或授权服务异常时仍能查看内容元信息，也不会在授权状态未知时覆盖名单。

## 3. AI 首次发送状态流

```text
pending-session
  -> ensureSession 创建真实会话
  -> streamSessionIdRef 绑定真实 ID 并发起 SSE
  -> React 收到新的 sessionId
     -> 若是占位 ID 的首次绑定：保留消息、scheduler 和请求
     -> 若是用户切换已有会话：取消旧流并加载目标会话消息
  -> 组件卸载：取消仍在运行的请求
```

根因不是后端主动关闭 `/public/ai/chat`，而是前端把“首次绑定真实 ID”误判成“切换会话”，effect cleanup 调用了 `AbortController.abort()`；只移除 abort 仍不够，因为旧逻辑还会把消息数组重置为空。

## 4. 关键文件

- `apps/server/prisma/schema.prisma`：`ContentAccessGrant` 关系与迁移模型。
- `apps/server/src/modules/content/content-visibility.ts`：公开列表和详情的统一可见性规则。
- `apps/server/src/modules/content/content.service.ts`：名单替换、版权闸、清理和审计。
- `apps/user-web/src/pages/workspace/Content/ContentMetaDrawer.tsx`：仅自己/指定用户交互。
- `apps/user-web/src/components/ai/hooks/useAiChat.ts`：区分首次会话绑定与真正切换。

## 5. 验证

1. hook 回归测试覆盖首次绑定保留回复、切换已有会话取消旧流。
2. Content HTTP 用例覆盖作者列表、授权前后详情、作者邮箱提示、其他用户、收藏过滤、撤销、版权闸，以及授权 PUT 与公开 PATCH 的受控并发顺序。
3. AI HTTP 用例覆盖匿名 Chat 显式传递可用 `modelId`，以及私密引用在授权、未授权、草稿和版权闸状态下的提示词快照边界。
4. 抽屉组件用例覆盖连续切换时旧值清理、加载失败禁止保存、授权失败时保留基础信息并只提示一次；纯函数用例覆盖按服务端最终名单回填并保留作者邮箱提示数据。

后端 HTTP 用例依赖 Docker/Testcontainers；没有容器运行时的环境只能完成类型、Lint 和测试收集，不能视为集成用例通过。
