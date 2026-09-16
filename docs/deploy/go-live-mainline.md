# 当前主线：首版上线部署

> 状态：🟢 当前开发主线（2026-09-15）
> 目标：Nest M0–M6 + 双端静态，用腾讯云 CVM + **COS** 发布；浏览器先走公网 IP + HTTP :80
> 填空：[prod-env-worksheet.md](./prod-env-worksheet.md) · 启动顺序：[prod-startup-order.md](./prod-startup-order.md) · 腾讯云：[tencent-cloud-prep.md](./tencent-cloud-prep.md)
> 拓扑：[nest-compose-strategy.md](./nest-compose-strategy.md) · 骨架：`compose.prod.yml`、`.env.prod.example`
> 生产命令：[production-runbook.md](./production-runbook.md) · 本地命令：[../engineering/dev-local.md](../engineering/dev-local.md)

---

## 1. 为什么现在做这个

React-first 0–5 与 Nest **M0–M6** 已在本地闭环。后台治理（M7）**本轮不做**。

本轮目标：别人能打开站点、登录、读内容、用 AI。SMTP 已接线、COS 桶已准备；
真实 SMTP/COS/AI 仍在服务器填入凭证后联测。域名放到本文最后，不挡 IP 上线。
当前目标地址为 `http://111.231.13.252`。

## 2. 本轮做 / 不做

| 做 | 不做 |
| --- | --- |
| 填 `.env.prod`，按 [prod-startup-order.md](./prod-startup-order.md) 和 [production-runbook.md](./production-runbook.md) 起 Compose **并**迁移 / seed / bootstrap | 只 `compose up` 以为结束 |
| 腾讯云 COS 私有桶 + CAM 子用户（变量仍叫 `MINIO_*`） | 生产再起 MinIO；M7 治理 |
| QQ SMTP 已接线并完成配置准备；先本地验证，再写入生产 `.env.prod` | 改邮箱、TOTP（那是新功能，不是发信配置） |
| 容器内 `bootstrap:super-admin`（禁止 `seed:local-users`） | Flutter、Next 抽离、二期编辑器 |
| 健康检查 + 登录 / 内容 / AI home 冒烟 | 支付、增删模型、LoRA |
| HTTP 下登录：通过 `COOKIE_SECURE=false` 允许公网 IP 首版使用 Cookie | 主题左/右导航、Logo 上传 |

## 3. 首版实现状态与剩余验证

1. SMTP、AI、Cookie 开关、COS endpoint 风格和 readiness 检查已接线；真实 COS、QQ SMTP、AI 仍需服务器填密钥后联测。
2. 生产 `prisma seed` 仍写入样例内容，个人首版接受；预览地址读取 `PUBLIC_APP_ORIGIN`。
3. 容器内 bootstrap / 小册导入使用 `/data/personal-hub/content-local/` 一次性源目录；长期内容落到 COS。
4. 告警与备份：首版先保证磁盘和容器能重启；完整渠道后置。

## 4. 建议验收

1. `compose up --build` 后本机 `GET /api/v1/health/live` 为 200；迁移后 `ready` 为 200。
2. `http://<公网IP>/` 首页来自 Nest。
3. bootstrap 账号能登录、改密、进 `/admin`。
4. `/ai` 的 `public/ai/home` 为 200（Fake 即可）。
5. 上传或封面走 COS 预签名，不要出现 `127.0.0.1:9`。

---

## 5. 域名、站点名、HTTPS（后置，不挡 IP 上线）

站点显示名后台已能改，和域名无关，上线后再改即可。

**有域名 ≠ 自动 HTTPS。** 也不必买付费证书。大陆 CVM 用域名对外通常要备案。细节与 SMTP/COS 申请步骤见 [tencent-cloud-prep.md](./tencent-cloud-prep.md)。

| 步骤 | 大概耗时 | 挡不挡 IP 上线 |
| --- | --- | --- |
| 后台改站点名 | 几分钟 | 否 |
| 腾讯云注册 `personal-hub` 相关域名 | 实名通过后即可解析；被占用就换后缀 | 否 |
| DNS A 到 CVM | 几分钟到数小时 | 否 |
| 大陆备案 | 常见 7–20 个工作日 | 只挡「用域名访问」 |
| 免费 DV SSL + Nginx 443 | 证书签发约几十分钟到一天 | 否；要域名 |

以后只改 `PUBLIC_APP_ORIGIN`、Nginx `server_name`/证书、COS CORS，不必重做业务模块。

---

## 6. 上线后的下一步：AI Provider 配置中心

首版上线继续使用 Fake AI 或环境变量配置的 OpenAI-compatible Provider，不在本轮引入后台密钥管理。

上线后的下一阶段计划支持：

- 系统预置 Provider；
- 后台配置 Base URL、模型和启停状态；
- API Key 加密存储，后台只写入、不回显；
- API Key 轮换、删除和连接测试；
- 用户自行添加 Provider 和自己的 API Key；
- 用户选择可用模型并记录额度策略。

实现前需要补齐密钥加密、权限、审计脱敏和运行时 Provider 刷新，不把明文 API Key 写入普通业务配置表、日志或前端。
