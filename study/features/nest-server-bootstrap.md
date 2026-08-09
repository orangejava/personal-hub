# NestJS 阶段 0：如何搭建可演进的后端底座

## 场景

在开始用户、内容或 AI 等业务前，先建立一致的应用入口、配置校验、连接生命周期、错误格式和健康检查。这样领域模块不会各自创建 Redis/Prisma 客户端或发明不同的错误响应。

## 核心概念

- **启动时校验**：Zod 在服务监听端口前校验环境变量，避免错误配置在运行中才暴露。
- **全局横切能力**：requestId、响应包装和异常过滤器放在入口链路，业务 Controller 只需返回业务数据。
- **liveness / readiness**：前者判断进程是否活着，后者判断是否能安全接收流量；数据库或 Redis 不可用时只让 readiness 失败。
- **基础设施封装**：Prisma 与 Redis 客户端各有一个注入服务，统一连接、关闭和后续使用规则。

## 实现顺序

1. 创建独立 Node TypeScript 配置，不能继承 React 的 DOM/JSX 配置。
2. 以 `ConfigModule + Zod` 建立环境变量边界，再接入日志与 HTTP 全局能力。
3. 实现 Prisma/Redis 生命周期和健康端点。
4. 用 Compose 运行依赖，Nest 保留宿主机热更新。
5. 通过类型检查、测试、SWC 构建和故障演练确认底座可用。

## 常见错误

- 把客户端传入的 `X-Request-Id` 当作可信审计关联 ID。
- 用 `200 + code` 表示失败，导致 HTTP 客户端与代理无法正确处理错误。
- 只实现 `/health`，却在数据库失联时仍接受业务流量。
- 在 Controller 中直接 new PrismaClient 或 Redis，造成连接池失控。
- 将本地 MinIO 或 Mailpit 配置误用于生产。

## 手动验证

1. 启动 Compose 后访问 `/api/v1/health/ready`，确认响应为 `{ data, requestId }`。
2. 停止 Redis，确认 `/api/v1/health/live` 仍正常、`/api/v1/health/ready` 返回 `503` 和 `INFRASTRUCTURE_UNAVAILABLE`。
3. 恢复 Redis 后重新检查 readiness，并打开 `/api/docs` 查看 Health 分组。
