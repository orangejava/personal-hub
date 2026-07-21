# 项目架构图与链路说明

> 目标：把“系统有哪些部分、它们如何协作、请求是怎么走的”讲清楚，方便从前端视角转向全栈视角。
> 最后更新：2026-06-27

---

## 1. 先用一句话理解整体架构

这个项目不是“一个前端站点”，而是一套完整系统：

- 当前阶段 `apps/react-web` 先用 React / Umi / Ant Design Pro 负责首版公开前台、登录后工作区、后台管理台
- 后续 `apps/next-web` 承担首页、内容中心、阅读页、项目页、关于我等适合 SEO 的页面
- 后续 `apps/api` 负责认证、内容、AI、管理能力
- `PostgreSQL` 负责核心业务数据
- `Redis` 负责缓存、限流、会话辅助
- `Local Storage / MinIO` 负责文件
- `AI 厂商` 负责模型推理能力

---

## 2. 系统上下文图

```mermaid
flowchart LR
    Visitor["访客 / 注册用户"] --> ReactWeb["apps/react-web<br/>React + Umi"]
    Admin["管理员"] --> ReactWeb
    Visitor --> NextWeb["apps/next-web<br/>Next.js 15（后续）"]
    Mobile["Flutter App"] --> Api["apps/api<br/>NestJS + Fastify"]
    ReactWeb --> Api
    NextWeb --> Api
    Api --> Db[("PostgreSQL 16")]
    Api --> Redis[("Redis 7")]
    Api --> Storage["Local Storage / MinIO"]
    Api --> AI["阿里云百炼 / OpenAI / 其他模型厂商"]
    ReactWeb --> Shared["packages/shared-types<br/>共享类型 / Zod Schema"]
    NextWeb --> Shared
    Api --> Shared
```

React-first 阶段后端未完成前，`apps/react-web` 先通过 Umi mock / 本地 service 模拟 API，mock 结构要尽量贴近后续 NestJS API。

---

## 3. 工程结构图

```mermaid
flowchart TD
    Root["personal-hub"]
    Root --> Apps["apps/"]
    Root --> Packages["packages/"]
    Root --> Docs["docs/"]
    Root --> Study["study/"]
    Root --> Infra["docker / ci / scripts"]

    Apps --> ReactWeb["react-web<br/>React + Umi + Ant Design Pro"]
    Apps --> NextWeb["next-web<br/>Next.js（后续）"]
    Apps --> Api["api<br/>NestJS（后续）"]
    Apps --> Mobile["mobile<br/>Flutter（后置）"]

    Packages --> SharedTypes["shared-types<br/>共享类型 / Schema"]
```

---

## 4. Web 端信息架构

```mermaid
flowchart TD
    ReactWeb["apps/react-web"]
    ReactWeb --> Public["公开前台（首版）"]
    ReactWeb --> Workspace["登录后工作区"]
    ReactWeb --> Admin["后台管理台"]
    NextWeb["apps/next-web（后续）"] --> PublicNext["公开前台 SEO 页面"]

    Public --> Home["/"]
    Public --> Content["/content"]
    Public --> About["/about"]
    Public --> Projects["/projects"]
    Public --> AIHub["/ai"]

    Workspace --> Dashboard["/workspace"]
    Workspace --> MyContent["/workspace/content"]
    Workspace --> Favorites["/workspace/favorites"]
    Workspace --> AIHistory["/workspace/ai-history"]
    Workspace --> Usage["/workspace/usage"]

    Admin --> Users["/admin/users"]
    Admin --> Roles["/admin/roles"]
    Admin --> Contents["/admin/contents"]
    Admin --> Models["/admin/ai/models"]
    Admin --> Config["/admin/system/config"]
```

说明：

- React-first 首版先完整跑通功能和交互
- 后续公开前台优先考虑 SEO、SSR、ISR，逐步迁移到 Next.js
- 工作区优先考虑交互效率和登录态
- 后台优先考虑表格、表单、权限和配置效率

---

## 5. API 模块关系图

```mermaid
flowchart TD
    App["AppModule"]
    App --> Auth["AuthModule"]
    App --> User["UserModule"]
    App --> Role["RoleModule"]
    App --> Permission["PermissionModule"]
    App --> Content["ContentModule"]
    App --> Category["CategoryModule"]
    App --> Tag["TagModule"]
    App --> Favorite["FavoriteModule"]
    App --> Reading["ReadingModule"]
    App --> File["FileModule"]
    App --> AI["AiModule"]
    App --> AISession["AiSessionModule"]
    App --> AIUsage["AiUsageModule"]
    App --> System["SystemModule"]
    App --> Homepage["HomepageModule"]
    App --> Admin["AdminModule"]
    App --> Log["LogModule"]
    App --> Prisma["PrismaModule"]

    Auth --> Prisma
    User --> Prisma
    Role --> Prisma
    Permission --> Prisma
    Content --> Prisma
    Category --> Prisma
    Tag --> Prisma
    Favorite --> Prisma
    Reading --> Prisma
    AI --> Prisma
    AISession --> Prisma
    AIUsage --> Prisma
    Admin --> Prisma
```

说明：

- `PrismaModule` 是大多数业务模块的底层数据访问依赖
- `AuthModule` 是权限体系入口
- `AiModule` 负责对外模型代理，不直接暴露厂商 Key 给前端

---

## 6. 请求链路图：普通内容页面

```mermaid
sequenceDiagram
    participant U as 用户
    participant W as Next.js 页面
    participant A as NestJS API
    participant D as PostgreSQL

    U->>W: 访问 /content/[slug]
    W->>A: 请求内容详情
    A->>D: 查询内容、分类、标签
    D-->>A: 返回数据
    A-->>W: 返回标准响应
    W-->>U: 渲染内容页（SSR / ISR）
```

这条链路的学习重点：

- 前端不再只是“浏览器里请求接口”，而是 Next.js 服务端也参与渲染
- 内容页优先用 Server Component，因为 SEO 和首屏更重要

---

## 7. 请求链路图：登录认证

```mermaid
sequenceDiagram
    participant U as 用户
    participant W as Web
    participant A as API
    participant D as PostgreSQL

    U->>W: 提交邮箱和密码
    W->>A: POST /auth/login
    A->>D: 查询用户、角色、权限
    D-->>A: 返回用户数据
    A-->>W: Access Token + Refresh Token
    W-->>U: 进入工作区
```

说明：

- Access Token 负责短时访问
- Refresh Token 负责续期
- 真正的权限校验在后端 Guard，不在前端按钮显隐

---

## 8. 请求链路图：AI 对话

```mermaid
sequenceDiagram
    participant U as 用户
    participant W as Web Chat 页面
    participant A as NestJS AI 代理层
    participant P as 模型厂商 API
    participant D as PostgreSQL
    participant R as Redis

    U->>W: 发送消息
    W->>A: 发起 AI 对话请求
    A->>R: 检查限流 / 临时上下文
    A->>P: 调用模型接口
    P-->>A: 流式返回片段
    A-->>W: SSE 流式输出
    A->>D: 保存会话 / 消息 / 用量
    W-->>U: 逐步显示回复
```

这条链路的价值：

- 你会第一次真正接触“流式响应”
- 你会知道为什么 AI 系统需要会话表、消息表、用量表分离

---

## 9. 内容发布链路

```mermaid
flowchart LR
    Editor["编辑者 / 管理员"] --> Workspace["工作区创建内容"]
    Workspace --> Api["POST /contents"]
    Api --> Db[("PostgreSQL")]
    Api --> Storage["文件存储"]
    Api --> Revalidate["触发页面 revalidate"]
    Revalidate --> Public["前台内容页刷新缓存"]
```

说明：

- 内容系统不是“只写数据库”，还涉及发布状态、文件、缓存刷新
- 这也是你从前端转向全栈时要重点建立的新意识

---

## 10. 数据域划分图

```mermaid
flowchart TD
    Auth["认证与权限域"]
    Content["内容域"]
    AI["AI 域"]
    System["系统配置域"]
    Analytics["统计与日志域"]

    Auth --> AuthTables["users / roles / permissions / refresh_tokens"]
    Content --> ContentTables["contents / categories / tags / chapters / favorites / reading_records / files"]
    AI --> AITables["ai_sessions / ai_messages / ai_usage_logs / token_transactions / ai_models / ai_providers"]
    System --> SystemTables["system_configs / homepage_blocks / menus"]
    Analytics --> AnalyticsTables["operation_logs / usage_stats"]
```

---

## 11. 部署拓扑图

```mermaid
flowchart TD
    Internet["Internet"]
    Internet --> Nginx["Nginx / HTTPS"]
    Nginx --> Web["Next.js Container"]
    Nginx --> Api["NestJS Container"]
    Api --> Db[("PostgreSQL")]
    Api --> Redis[("Redis")]
    Api --> Uploads["Uploads / MinIO"]
```

---

## 12. 作为前端开发者，你要重点理解哪些架构变化

### 从 React SPA 到 Next.js

- 不再只有浏览器端渲染
- 页面可以在服务端取数和渲染
- 组件要区分 Server Component 和 Client Component

### 从“调别人接口”到“自己设计接口”

- 你要开始关心 DTO、数据库字段、分页协议、错误码
- 你写的前端页面会反过来约束后端接口设计

### 从“一个前端项目”到“一个系统”

- 要考虑部署
- 要考虑鉴权
- 要考虑缓存
- 要考虑日志
- 要考虑回滚

---

## 13. 你后面画图时可以优先画哪几类图

如果以后你自己设计系统，优先从这几类图开始：

1. 系统上下文图：谁在用系统，系统依赖谁
2. 工程结构图：仓库里有哪些项目和共享包
3. 请求链路图：某个关键功能从前端到数据库怎么走
4. 数据域划分图：有哪些核心业务对象
5. 部署拓扑图：上线后服务放在哪里

> 画图不是为了“好看”，而是为了让你不再只盯着页面和接口，而是能看到整个系统。
