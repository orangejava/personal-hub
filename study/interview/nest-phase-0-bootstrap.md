# Nest 阶段 0：面试题与参考回答

> 状态：已完成  
> 最后更新：2026-08-08  
> 实现依据：[Nest Server 阶段 0 脚手架](../../docs/implementation/foundation/nest-server-bootstrap.md)

## Q1：为什么项目使用 NestJS + Express？

**是什么**：NestJS 负责模块、依赖注入、Guard、Pipe、Interceptor 和测试结构；Express 是 Nest 当前的 HTTP 适配器。

**本仓实现**：`apps/server` 用 Express middleware 处理 Cookie、安全头、CORS 和 requestId，Controller、Service、Prisma、Redis 不依赖 Express 对象。

**取舍**：当前没有 HTTP 层高并发瓶颈，优先采用成熟 middleware 生态与更低的维护成本；出现真实瓶颈后再依据压测优化。

**面试一句**：Nest 管工程结构，Express 仅承担 HTTP 接入，业务层保持对适配器无感。

## Q2：如何让一次请求在响应和日志中可追踪？

**是什么**：服务端创建全局唯一 `requestId`，将同一值贯穿请求上下文、响应头、响应体与日志。

**本仓实现**：`assignRequestId` middleware 生成 UUID，写入 `req.requestId` 与 `X-Request-Id`；响应 interceptor 和异常 filter 读取该值并写入统一信封。

**取舍**：不接受客户端自带 ID，避免伪造或与服务端关联链冲突。

**面试一句**：客户端拿到 requestId 后，可以用它定位同一条 Pino 日志与错误响应。

## Q3：为什么 Prisma migration 要显式加载 `.env.local`？

**是什么**：Nest 运行时配置与 Prisma CLI 是两个独立进程，配置加载不会自动共享。

**本仓实现**：Prisma 脚本通过 `dotenv-cli -e .env.local -- prisma ...` 启动，确保 migration 和应用使用相同的数据库连接配置。

**取舍**：显式加载可以避免变量缺失或意外连接到错误环境。

**面试一句**：应用能读取环境变量，不代表 ORM CLI 也会读取同一个文件。

## Q4：为什么错误不能使用 `200 + code` 表示？

**是什么**：HTTP 状态码表达协议层成功或失败，浏览器、代理、监控和重试器都依赖它。

**本仓实现**：成功响应为 `{ data, requestId }`；异常 filter 保留真实 4xx/5xx，并返回 `{ error, requestId }`。

**取舍**：业务错误码在 `error.code` 中补充机器可读语义，不替代 HTTP 状态码。

**面试一句**：HTTP 状态码负责传输语义，业务错误码负责细分业务原因。

## Q5：怎样降低 HTTP 适配器迁移的风险？

**是什么**：将 HTTP 框架差异限制在启动层与 middleware，保持领域代码只依赖 Nest 抽象。

**本仓实现**：迁移仅替换 `main.ts`、requestId 类型/middleware、异常 filter 和依赖；健康检查、Prisma、Redis、响应契约保持不变。

**取舍**：以相同的 health、Swagger、错误信封、CORS 与 Cookie 验收路径验证迁移结果。

**面试一句**：适配器可替换的前提是 Controller 和业务层不直接操作底层 request/reply 对象。
