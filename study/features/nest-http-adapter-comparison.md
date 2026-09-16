# NestJS HTTP 适配器：Fastify 与 Express 的技术比较与迁移判断

> 状态：已完成（比较资料；项目已于 2026-08-08 迁移至 Express）  
> 最后更新：2026-08-08  
> 关联：[阶段 0 实现记录](../../docs/implementation/foundation/nest-server-bootstrap.md)、[后端实现约定](../../docs/backend/conventions.md)、[依赖目录](../../docs/engineering/nest-dependency-catalog.md)

## 1. 为什么要比较 HTTP 适配器

NestJS 的 Controller、Module、DI、Guard、Pipe、Interceptor 和 Exception Filter 大多与底层 HTTP 框架无关；但启动配置、请求/响应对象、插件生态、静态资源、上传、SSE 和错误处理仍会受到 HTTP 适配器影响。

因此，不能只根据“某次 Fastify 报错”决定换 Express。应先区分：

1. 是环境、依赖、端口或项目代码的问题；
2. 是底层框架的能力限制；
3. 还是团队已有依赖和维护能力确实更适合 Express。

## 2. 技术维度对比

| 维度 | Express | Fastify | 对本项目的意义 |
| --- | --- | --- | --- |
| 核心模型 | middleware 链，生态最成熟 | hook + plugin encapsulation | 业务模块应只依赖 Nest 抽象，专用逻辑只留在 `main.ts` / infrastructure。 |
| 吞吐与开销 | 普通 CRUD 足够 | JSON API 通常有更低开销 | AI 流式、并发 API 是 Fastify 的潜在优势，但先优化 DB、缓存和队列。 |
| TypeScript | 依赖类型包，常需自行组合 | 框架与插件类型更完整 | Fastify 更强调类型，但 pnpm 下仍需严格对齐插件 peer 版本。 |
| 参数校验 | 通常配合 Zod/Joi/class-validator | 原生偏 JSON Schema | 当前 Nest 统一用 DTO + `class-validator`，不要再建立第二个 HTTP DTO 真相源。 |
| 日志 | 常接 Morgan/Pino 等中间件 | Pino 生态天然契合 | 当前使用 `nestjs-pino`，两者都能接入。 |
| Cookie/CORS/安全头 | `cookie-parser`、`cors`、`helmet` 等 | `@fastify/cookie`、`@fastify/cors`、`@fastify/helmet` | 插件不能跨生态直接替换。 |
| Swagger 静态资源 | Express 静态能力常已隐式具备 | 需要 `@fastify/static` peer 依赖 | 阶段 0 已遇到，属于已知依赖组合，不是框架故障。 |
| 第三方生态 | 最大，历史服务与 SDK 示例最多 | 较小但 API 服务常用插件完整 | 如果未来关键供应商 SDK 只提供 Express middleware，需重新评审。 |
| 团队心智模型 | 招聘覆盖广、候选人熟悉 | 要理解 hook、plugin scope 和 raw 对象边界 | 学习 Express 有就业价值，项目使用 Fastify 不冲突。 |

### 2.1 性能的正确理解

Fastify 的基准吞吐通常优于 Express，但真实服务的 P95/P99 往往先被 PostgreSQL 查询、Redis、第三方 AI、对象存储、网络和序列化大对象决定。

正确的性能决策顺序：

1. 用压测确认 HTTP 层真是瓶颈；
2. 先检查 SQL 索引、N+1 查询、缓存命中、队列与连接池；
3. 再比较同一 DTO、同一硬件、同一并发下的适配器指标；
4. 不能用营销基准代替本项目压测。

### 2.2 AI 流式与并发 API：Fastify 的优势在哪里

先澄清：Fastify 不会让 AI 厂商更快生成文本，也不会替代 Redis 限流、BullMQ、超时控制或数据库优化。AI 流式的主要耗时通常在上游模型推理和网络，而不是 HTTP 框架。

Fastify 的潜在优势在于**同一台 Node 进程需要维护大量并发 HTTP 连接时的额外开销**：

- 更低的路由、请求解析和 JSON 响应序列化开销，可以减少 CPU 花在 HTTP 框架本身的比例。
- hook 与插件封装适合把认证、请求 ID、限流、日志等横切能力放在统一生命周期，而不是在每个 AI 路由重复堆 middleware。
- Pino 与 Fastify 集成紧密，长连接、错误和断开请求更容易以结构化字段观察。

但要注意边界：

- SSE 长时间保持连接，真正要处理的是客户端断开、AbortSignal、心跳、反向代理超时、背压和每用户并发上限；两种框架都必须实现。
- Fastify 的 JSON Schema 序列化优势主要作用于 JSON API；SSE 是持续写入文本事件，不应夸大为“流式输出自动快很多”。
- Nest 的 `@Sse()` 能抽象大部分响应细节；如果改用 `reply.raw` 手写流，则会重新引入适配器耦合。

因此，Fastify 的优势是为高连接数 API 保留较低 HTTP 开销，不是声称它能解决 AI 延迟；当前项目因维护与学习边界选择 Express。

## 3. “现在迁移更便宜”是否成立

这个判断有一半正确：

- **代码成本**：当前只有 health 和横切能力，改适配器确实比 Auth、File、AI、SSE 都完成后更便宜。
- **架构成本**：迁移前的项目 PRD、依赖目录、Cookie/Security、部署和学习资料曾明确 Fastify；迁移已同步权威文档、测试和依赖，不能将这类适配器替换视为无成本操作。

### 3.1 若决定迁移 Express，必须完成的清单

1. 已更新技术栈、依赖目录与 Bootstrap PRD，撤销 Fastify 的唯一组合约束。
2. 已用 `@nestjs/platform-express` 替换 `@nestjs/platform-fastify`，并替换 Cookie、CORS、Helmet 依赖。
3. 已将 Fastify hook 改为 Express requestId middleware，删除启动层类型断言。
4. 已简化异常过滤器为 Express 单一响应分支，并移除 Swagger 静态资源 peer dependency。
5. 已重新验证 health、Swagger、错误信封与 requestId；后续 Auth 阶段补充 Cookie/CORS 的业务级验收。
6. File/AI 阶段按 Express 生态重新评估上传与流式响应方案。

只有下面任一条件成立时，才建议执行上述迁移：

- 必须使用的核心 SDK 只提供 Express middleware，且没有等价 Fastify 或框架无关实现；
- 团队维护者明确只熟悉 Express，培训 Fastify 的成本高于迁移和长期维护成本；
- 实测 Fastify 的插件/部署限制阻塞了业务交付，且无法通过隔离基础设施解决。

当前项目已满足“维护者优先采用 Express”的决策条件，并在业务模块尚未落地时完成迁移。

## 4. 本项目可复用的实现模式

```text
Express requestId middleware
  → 生成服务端 requestId + X-Request-Id
  → Nest Controller / Service / Repository
  → ResponseEnvelopeInterceptor
  → { data, requestId }

异常
  → HttpExceptionFilter
  → { error, requestId }
```

关键原则：

- Express 特有 `req/res` 和 middleware 只能存在于启动层或 infrastructure。
- Controller 不应直接调用 `reply.raw`；Service/Repository 不能知道 HTTP 框架。
- 以 `pnpm --filter server lint && typecheck && test && build` 和真实 HTTP smoke test 共同验证，而非只依赖类型检查。

## 5. 学习路线

1. **Express 基础**：middleware 顺序、路由、错误处理中间件、`req/res`、Cookie、文件上传与 Supertest。
2. **Nest 通用能力**：模块、DI、Pipe、Guard、Interceptor、Filter、DTO、OpenAPI、E2E。
3. **Fastify 差异**：hook 生命周期、plugin encapsulation、schema、Pino、`request/reply/raw` 边界。
4. **项目证据**：能够演示 Compose、Prisma migration、health/readiness、Swagger、requestId 和结构化日志。
5. **系统设计**：Auth 会话、RBAC 数据范围、Redis 限流、Outbox + BullMQ、S3 预签名上传和 AI 额度事务。

## 6. 手动验证适配器基础能力

1. 启动 Compose：`docker compose -f compose.dev.yml up -d`。
2. 执行 `pnpm --filter server prisma:deploy`，确认 migration 使用 `.env.local` 成功连接 PostgreSQL。
3. 启动 `pnpm dev:server`，验证 health、readiness 和 Swagger；检查响应体与 Header 中的 `requestId` 是否一致。
4. 只在真实业务瓶颈出现后，使用同一 API 契约和同一环境比较 Fastify/Express，而不是先迁移再找理由。
