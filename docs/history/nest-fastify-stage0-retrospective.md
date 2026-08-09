# Nest 阶段 0 Fastify 实现复盘

> 状态：📚 历史资料  
> 最后更新：2026-08-08  
> **当前项目已迁移至 NestJS + Express；本文仅记录历史排障过程，不作为后续开发依据。**

阶段 0 初始实现曾使用 Fastify。以下问题与当时的依赖组合、hook 生命周期和类型边界相关，后续业务开发不应据此选择实现方式。

## 历史问题

| 现象 | 当时根因 | 最终处置 |
| --- | --- | --- |
| Swagger 启动提示缺少 `@fastify/static` | Swagger UI 依赖 Fastify 的静态资源 peer dependency | 按兼容版本补充依赖；Express 迁移后该依赖已删除。 |
| 请求连接重置 | 将 Nest middleware 的原生 `req/res` 当作 Fastify `request/reply` 调用 | 将 requestId 放入 Fastify `onRequest` hook；迁移 Express 后改回标准 middleware。 |
| 类型检查与运行结果不一致 | pnpm 隔离依赖树中 Fastify 插件的类型身份差异 | 通过版本对齐与类型断言临时处理；迁移后已删除这些断言。 |

## 迁移结论

业务 Controller、Service、Prisma、Redis 和 HTTP 契约没有依赖 Fastify，因此迁移只影响启动层、requestId、异常 filter 与依赖清单。当前实现和后续约定以 `docs/foundation/tech-stack.md`、`docs/engineering/nest-dependency-catalog.md`、`docs/backend/` 与 `apps/server` 代码为准。
