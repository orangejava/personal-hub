# 后端代码细则

只检查本次 diff 里的 `apps/server`（含 `prisma` 和 `apps/server/test`）。没改到的模块不要用本清单返工。

契约和请求信封以 `.agents/skills/fullstack-impact/SKILL.md` 为准。Prisma 关系、时间和索引以仓库的 schema 约定为准。

## 接口

- 新的失败路径抛的是普通 `Error` 或空 500，没有 `DomainHttpException(status, 'CODE', '给人看的中文')`，记为 P1。页面要能从 `error.message` 读到这句中文。
- 成功响应再包一层 `{ code, success, message, data }`，记为 P1。保持 HTTP 2xx 加 `{ data }`。
- 新增的写接口（POST、PUT、PATCH、DELETE）没有 `@RequireIdempotency()`，也没有说明为什么不需要，记为 P1。
- 只在 UI 上隐藏按钮，controller 没有 `@RequirePermission`，或有权限码但没有 `DataScope`，记为 P0。
- 列表新增了过滤却一次返回全表，或 `page` / `pageSize` 没有上限，记为 P1。

## 数据

- 余额、额度、库存这类数字先读再在进程里加减，然后单独 `update`，记为 P0。要在同一个事务里用条件更新，失败则整笔拒绝，不写一半账。
- 幂等键冲突时又插入一条业务记录，记为 P0。重复请求回放已有结果。
- 迁移 SQL 是手改或把两条分支的 migration 拼在一起，记为 P0。后合并的一方重新生成迁移。
- 新模型只有一边 `@relation`，或缺少本次查询用到的 `@@index`，记为 P1。
- 配置 JSON 里写入 API Key、令牌、密码，记为 P0。密钥进单独凭据或环境变量，不进 `system_configs`。

## 密钥和文件

- 日志、审计 `detail`、幂等响应、异常消息里出现密钥、`Authorization`、刷新令牌，记为 P0。
- 管理端要「已配置」时，响应仍返回明文、掩码或密文，记为 P0。只返回是否已配置。
- 新上传用途没有走 `file-policy.ts` 里已有的 MIME 和大小，或接受 `image/svg+xml`、`.ico` 却没有同步改拒绝列表和嗅探，记为 P1。
- 公开接口把 `fileId` 原样给匿名访问者，而同类资源已经改成短期签名 URL，记为 P1。

## 与现有行为的衔接

- 改了 Provider 调用方式，却在没有新凭据时不再读 `authEnvKey` 指向的环境变量，记为 P1。现有部署不能在第一次后台保存前失效。
- 登录、刷新令牌、注册赠额的路径被新的发放逻辑包住，发放失败会导致登录失败，记为 P0。发放失败只记日志。
- `refresh` 里调用了只应在登录成功后发生的赠送，记为 P0。
- Fake Provider 或测试里开始请求外网，记为 P1。

## 测试

- 新的拒绝分支（余额不足、幂等冲突、无权限、非法 MIME）没有断言状态码和错误码，记为 P1。
- 只断言了成功路径，没有断言数据库行数没有增加，记为 P1。
