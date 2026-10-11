# 域名、HTTPS 与 Nginx 压缩缓存

> 状态：gzip 与带哈希静态资源的长期缓存已写进 `deploy/nginx/default.conf`。HTTPS、证书和 80 跳 443 仍后置
> 最后更新：2026-10-11
> 前提：域名已实名，ICP 备案已通过（2026-09）
> 关系：接 [go-live-mainline.md](./go-live-mainline.md) §5 与 [tencent-cloud-prep.md](./tencent-cloud-prep.md) §1。性能基线见 [performance-dashboard-prd.md](../prd/post-launch/performance-dashboard-prd.md) §3。

证书和私钥不进仓库。域名和公网 IP 不是密钥，只出现在 `CORS_ORIGIN` 名单里。下文其余位置仍用 `<域名>` 代替。

## 1. 为什么压缩可以先做

- gzip 和带哈希文件的长期缓存已经写在 `deploy/nginx/default.conf`，仍只监听 80
- HTTPS、证书、80 跳 443、`COOKIE_SECURE` 仍后置。HTTP/2 要等证书
- 发版时重建 Nginx 镜像。`CORS_ORIGIN` 在 `.env.prod`，要重建 server 容器才会生效

## 2. 顺序

1. **记录优化前基线**：改动前，对线上 `http://<公网IP>/` 的首页、内容中心、小册阅读、AI 对话各跑一次 Lighthouse（移动端和桌面端各一次），并用浏览器网络面板记下 `umi.js` 的实际传输大小和 `Content-Encoding`。结果写进性能面板 PRD §3。
2. **DNS**：`<域名>` 和 `www.<域名>` 的 A 记录指向服务器公网 IP。
3. **安全组**：放行 443；80 保留，用来跳转到 HTTPS。
4. **证书**：推荐 Let's Encrypt + 自动续期。证书和私钥放在服务器 `/opt/personal-hub/certs/`，不进仓库。
5. **Nginx**（`deploy/nginx/default.conf`）：
   - gzip、带哈希静态资源一年缓存、`index.html` 的 `no-cache` 已写在当前配置里，仍只监听 80。`/api/v1/` 关闭压缩
   - HTTPS 时再加：80 全部 301 到 `https://<域名>`，443 开启 `ssl` 和 `http2`，`www` 跳主域名
   - HSTS 先设 `max-age=86400`，确认稳定一周后再加长
6. **Compose**（`compose.prod.yml`）：Nginx 增加 `443:443` 端口映射，以只读方式挂载证书目录。
7. **`.env.prod`**：
   - `PUBLIC_APP_ORIGIN=https://<域名>`
   - `COOKIE_SECURE=true`
   - `PUBLIC_APP_ORIGIN` 在前端构建时写进静态文件，所以改完必须重新构建 Nginx 镜像，不能只重启
8. **COS CORS**：允许的 Origin 改为 `https://<域名>`；切换稳定后删掉旧的 `http://<公网IP>`。
9. **邮件**：邮件里的验证和重置链接来自 `PUBLIC_APP_ORIGIN`，重启后自动变成域名；如果要用 `noreply@<域名>` 发信，再做发信域名验证（见 tencent-cloud-prep §2）。
10. **记录优化后数据**：按第 1 步同样的四个页面、桌面和手机再测一次。结果接在 `/status`「生产环境 Lighthouse」现有表后面，并补进性能面板 PRD §3。

## 3. 验收

- `http://<域名>`、`http://<公网IP>`、`https://www.<域名>` 都跳到 `https://<域名>`
- 浏览器地址栏显示安全锁，证书有效期正确
- 网络面板里 `umi.js` 的响应头有 `Content-Encoding: gzip`，传输大小明显小于发版前的约 1.84 MB
- 第二次打开页面时，带哈希的 JS / CSS 显示「来自缓存」
- 登录、刷新后保持登录、退出正常（验证 `COOKIE_SECURE=true`）
- 注册验证邮件、忘记密码邮件里的链接是 `https://<域名>/...`
- 上传封面和小册文件正常（验证 COS CORS）
- AI 对话的流式输出正常，没有被缓冲成一次性返回（验证 SSE 没被压缩或缓冲）
- 管理端 `/admin/` 能打开并登录

## 4. 回滚

- Nginx 配置出问题：回退 `default.conf` 与 `compose.prod.yml`，重建 Nginx 镜像
- 登录异常：先把 `COOKIE_SECURE` 改回 `false` 并继续用 HTTP 访问，排查后再切回
- 具体命令见 [production-runbook.md](./production-runbook.md)

## 5. 待确认

- [ ] 正式域名（只在服务器 `.env.prod` 和 Nginx 配置里填写，仓库里保留 `<域名>` 占位或用环境变量模板）
- [ ] 证书来源：推荐 Let's Encrypt（90 天、服务器自动续期）；腾讯云免费 DV 同为 90 天且须手动重新申请、下载和部署，不适合长期生产站点
- [ ] 是否需要 `www` 子域
