# Nest 后端开发规范

## 范围与权威文档

本目录承载 Personal Hub 的 NestJS API。编码前依次阅读：

1. `docs/backend/conventions.md`
2. `docs/backend/canonical-api.md`
3. `docs/backend/canonical-data-model.md`
4. 对应 `docs/prd/long-term/` 领域 PRD

## 模块边界

- 领域模块按 `controller → service → repository → provider` 组织。
- Controller 只处理 HTTP、DTO 与权限声明；Prisma 查询只能位于所属 Repository。
- Service 负责用例、事务、数据范围和 Provider 编排。
- Redis 只能通过 `RedisService` / 后续 `CacheService` 使用，禁止自行创建客户端或拼接 Key。

## API 与安全

- 全部 API 位于 `/api/v1`，成功返回 `{ data, requestId }`，失败返回 `{ error, requestId }`。
- DTO 使用 `class-validator`；写接口、权限和归属关系由服务端校验。
- 密钥只来自环境变量；日志不得写入密码、Token、Cookie、厂商 Key 或完整 AI 内容。

## 质量

- 运行 `pnpm --filter server lint`、`typecheck`、`test`、`build` 后再交付。
- 业务数据库变更必须新增 Prisma migration；共享或生产环境禁止 `prisma db push`。
- 事务、权限判断与外部 Provider 边界等复杂逻辑必须写中文注释说明原因。
