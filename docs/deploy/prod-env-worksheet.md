# 生产环境变量填空表

> 状态：🟢 给你填，不要提交填好的值
> 最后更新：2026-09-15
> 机器可读模板：[../../.env.prod.example](../../.env.prod.example)
> 启动顺序：[prod-startup-order.md](./prod-startup-order.md)
> 服务器操作：[production-runbook.md](./production-runbook.md)
> 腾讯云准备（域名 / HTTPS / SMTP / COS）：[tencent-cloud-prep.md](./tencent-cloud-prep.md)

**怎么用**

1. 复制仓库根 `.env.prod.example` 为服务器项目目录中的 `.env.prod`。
2. 把本表填好的值抄进去。**不要把填好的本文件或** `.env.prod` **提交 Git、贴到聊天。**
3. 标了「现在就能用」的项：`compose.prod.yml` 已经会读。
4. 标了「先备着」的项：启动命令或真实 AI 会在上线时显式使用；没有对应信息时保持占位，不要猜填。

生成随机密码（本机执行，不要用生日/重复密码）：

```bash
openssl rand -hex 32
```

---

## A. 现在就能用（Compose 已读，不填起不来）

| 变量                 | 你要填什么                                                                                  | 我的值（只写在本地/服务器）                                                          |
| -------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `PUBLIC_APP_ORIGIN`  | 首版无域名：`http://<公网IPv4>`，不要末尾 `/`。有域名且已上 HTTPS 后再改 `https://你的域名` | `http://<公网IPv4>`                                                                  |
| `CORS_ORIGIN`        | 生产同站留空即可                                                                            | （留空）                                                                             |
| `COOKIE_SECURE`      | 当前公网 IP + HTTP 必须为 `false`；切换 HTTPS 后改为 `true`                                 | `false`                                                                              |
| `POSTGRES_DB`        | 一般不用改                                                                                  | `personal_hub`                                                                       |
| `POSTGRES_USER`      | 一般不用改                                                                                  | `personal_hub`                                                                       |
| `POSTGRES_PASSWORD`  | 用 `openssl rand -hex 32` 生成；至少 16 位。hex 不含 URL 保留字符，可直接写入连接串         |                                                                                      |
| `DATABASE_URL`       | 密码必须和上一行相同；主机名保持 `postgres`（Compose 服务名）                               | `postgresql://personal_hub:<同上 hex 密码>@postgres:5432/personal_hub?schema=public` |
| `REDIS_PASSWORD`     | 再用 `openssl rand -hex 32` 生成一条不同的值                                                |                                                                                      |
| `REDIS_URL`          | 密码和上一行相同                                                                            | `redis://:<同上 hex 密码>@redis:6379`                                                |
| `REDIS_KEY_PREFIX`   | 一般不用改                                                                                  | `ph:prod`                                                                            |
| `JWT_ACCESS_SECRET`  | `openssl rand -hex 32`，至少 32 字符                                                        |                                                                                      |
| `JWT_REFRESH_SECRET` | **再生成一条**，不要和 Access 相同                                                          |                                                                                      |

### 对象存储（你已有腾讯云 COS）

当前 Nest 变量名仍是 `MINIO_*`，值填 **COS**。桶怎么建见 [tencent-cloud-prep.md](./tencent-cloud-prep.md) §3。

| 变量               | 你要填什么                                                                    | 我的值                                         |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| `MINIO_ENDPOINT`   | 从桶地址 `*.cos.ap-shanghai.myqcloud.com` 拆出的地域基础 endpoint             | `https://cos.ap-shanghai.myqcloud.com`         |
| `MINIO_ACCESS_KEY` | CAM 子用户 **SecretId**（不要用主账号；不要写入仓库）                         | （不要填写在此文件，直接写服务器 `.env.prod`） |
| `MINIO_SECRET_KEY` | 同一子用户 **SecretKey**                                                      |                                                |
| `MINIO_BUCKET`     | 控制台里的完整桶名，通常是 `桶名-APPID`，例如 `personal-hub-prod-125xxxxxxxx` | `<你的桶全名>`                                 |

> 当前代码会根据 endpoint 自动选择风格：腾讯 COS 使用虚拟主机风格和地域签名，
> 本地 MinIO 使用 path style。首次上线仍必须按 [production-runbook.md](./production-runbook.md)
> 执行真实上传、下载和删除验证。

### 邮件（通用 SMTP）

现网 `MailService` 已支持通用 SMTP。QQ 邮箱推荐使用 465 + SSL；账号密码只写本地 `.env.local` 或服务器 `.env.prod`，不要写本文件。

| 变量            | 首版建议                                          | 我的值                                |
| --------------- | ------------------------------------------------- | ------------------------------------- |
| `SMTP_HOST`     | QQ 邮箱填 `smtp.qq.com`                           | `smtp.qq.com`                         |
| `SMTP_PORT`     | 推荐 `465`                                        | `465`                                 |
| `SMTP_USER`     | 完整 QQ 邮箱地址                                  | `<你的完整 QQ 邮箱地址>`              |
| `SMTP_PASSWORD` | QQ 邮箱 16 位授权码，不是登录密码；不要写入本文件 | （不要填写）                          |
| `SMTP_SECURE`   | 465 填 `true`；587 使用 STARTTLS 时填 `false`     | `true`                                |
| `MAIL_FROM`     | 必须与 QQ 邮箱地址一致                            | `Personal Hub <你的完整 QQ 邮箱地址>` |

---

## B. 先备着（申请完就写上）

### 生产所有者（bootstrap，禁止 `seed:local-users`）

| 变量                        | 你要填什么                                     | 我的值             |
| --------------------------- | ---------------------------------------------- | ------------------ |
| `SUPER_ADMIN_EMAIL`         | 你自己收得到的邮箱，不要用 `owner@example.com` | `<你的管理员邮箱>` |
| `SUPER_ADMIN_TEMP_PASSWORD` | 强密码，登录后会强制改密                       |                    |

### 真实 SMTP（当前采用 QQ 邮箱）

申请步骤见 [tencent-cloud-prep.md](./tencent-cloud-prep.md) §2。

| 项                 | 说明                                                               | 我的值                   |
| ------------------ | ------------------------------------------------------------------ | ------------------------ |
| SMTP 主机          | `smtp.qq.com`                                                      | `smtp.qq.com`            |
| SMTP 端口          | `465`（SSL）                                                       | `465`                    |
| SMTP 用户名        | 完整 QQ 邮箱地址                                                   | `<你的完整 QQ 邮箱地址>` |
| SMTP 密码 / 授权码 | **16 位授权码**，不是 QQ 登录密码；只写 `.env.local` / `.env.prod` | （不要填写）             |
| 是否 SSL           | `true`（465）                                                      | `true`                   |
| 发件人 `MAIL_FROM` | 与 QQ 邮箱地址一致                                                 | `<你的完整 QQ 邮箱地址>` |

### AI 文本（首版可直接接真实 AI）

Compose 已将下面变量注入 `server` 和 `server-worker`。默认仍使用内置演示；确认厂商兼容
OpenAI Chat Completions SSE 后，填写全部变量并取消 `.env.prod.example` 中对应注释。修改后还要按
`production-runbook.md` §7.4 重建容器并执行 `sync-ai-catalog.ts`，这样用户端/后台目录才会显示真实文本模型：

| 变量                   | 说明                                 | 我的值                       |
| ---------------------- | ------------------------------------ | ---------------------------- |
| `AI_TEXT_PROVIDER`     | `fake` 或 `openai_compatible`        | `fake`（未填完整 AI 配置时） |
| `AI_OPENAI_BASE_URL`   | 兼容协议根地址，通常以 `/v1` 结尾    |                              |
| `AI_OPENAI_API_KEY`    | 厂商 API Key，只写服务器 `.env.prod` |                              |
| `AI_OPENAI_MODEL`      | 厂商模型名                           |                              |
| `AI_OPENAI_TIMEOUT_MS` | 请求超时毫秒数，默认 `60000`         | `60000`                      |

AI 厂商名称、Base URL、API Key 和模型名目前尚未提供；缺任何一项都不能进行真实 AI 联测。

---

## C. 暂时不用填（有域名、上 HTTPS 后再改）

| 项                     | 现在                          | 以后                |
| ---------------------- | ----------------------------- | ------------------- |
| `PUBLIC_APP_ORIGIN`    | `http://<公网IP>`             | `https://你的域名`  |
| Nginx `443` / 证书路径 | 没有                          | 证书申请成功后写入  |
| Cookie `Secure`        | 由 `COOKIE_SECURE=false` 控制 | HTTPS 后改为 `true` |

域名、证书、备案的准备清单在 [tencent-cloud-prep.md](./tencent-cloud-prep.md) §1，也写在 [go-live-mainline.md](./go-live-mainline.md) 最后一节。
