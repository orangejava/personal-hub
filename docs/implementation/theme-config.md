# 阶段 A：主题剩余 UI

> 状态：代码已落在 `theme-config`
> 最后更新：2026-10-09
> 依据：[theme-ui-performance-prd.md](../prd/post-launch/theme-ui-performance-prd.md) §3

## 1. 目标与范围

后台把已有配置补全并按组保存，前台按这些配置渲染导航、Logo、SEO 和主题开关。

不做：Loading / Skeleton、性能面板、首页改版、其余页面交互、`publicBlur`、透明顶栏、新的文件用途、`site.feature`。

## 2. 页面与入口

| 路径 | 写哪一组 |
| --- | --- |
| `/admin/system/site` | `site.general`：站点名称（最多 20 字）、关键词、Logo、favicon。Logo 和 favicon 各用单选切换文字或图片 |
| `/admin/system/theme` 第一张卡片 | `site.theme`：辅助色、强调色、允许用户切换，以及未保存值的预览 |
| 同页第二张卡片 | `site.navigation`：只改 `publicPosition` |
| AI 配置 / 品牌设置 | `ai.branding.aiEnabled` |

## 3. 接口与数据流

写接口仍是 `PUT /api/v1/admin/system-configs/:group`，带 version 和 `Idempotency-Key`。页面拿到的是解包后的对象；写失败走全局 toast，加载失败用 `ErrorState`。

公开 `GET /api/v1/public/site-config` 在原有 `logoUrl` 旁增加 `faviconUrl`，以及 `logoMode` / `logoText` / `faviconMode` / `faviconText`。`mapPublicSiteConfig` 把这些字段放进 `SystemPublicConfig`。`logoFileId`、`faviconFileId` 只留在后台组值和签名过程里，公开响应不带这两个字段。旧数据没有模式时：已经有文件 ID 按图片，否则按文字，避免已上传的 Logo 突然消失。

Logo / favicon 继续走 `ImageFileField` 和 `COVER`。保存时，新引用的文件必须是当前管理员自己的、已完成的封面图；没改动的旧文件不再检查。签名失败或文件未就绪时 URL 为 null；图片模式下前台改显示文字。文字 favicon 由前台画成 data URL，底色用站点 `colorPrimary`，不上传文件。用户端读取公开配置时，会用原始 payload 里的 `logoUrl` 再补一次 `logo`，避免打包缓存的 mapper 把签名地址丢掉。

## 4. 关键实现

- 用户端 `rootContainer` 用 Helmet 写标题、description、keywords、`rel=icon`。登录页自己的 Helmet 仍可覆盖标题。
- `colorSecondary`、`colorAccent` 跟主色走同一套 `publicSettings`。antd 种子令牌没有这两项，所以写到 `--ph-color-secondary`、`--ph-color-accent`，不另开主题状态。用户本地偏好只覆盖明暗和主色。
- 桌面且不是矮屏、也不是阅读页时，`left` / `right` 用 240px 不透明侧栏，`PublicHeaderActions` 整块在侧栏底部。手机、平板、矮屏，以及 `/content/booklets/`、`/content/:id`，仍用现有 Drawer。
- `aiEnabled === false` 只去掉以 `/ai` 开头的菜单。`allowUserSwitch === false` 只隐藏主题按钮。

## 5. 权限与异常

写配置仍要 `system:config:manage`。上传格式不对沿用现有封面图错误，不新增文件用途。把别人的文件 ID 写进 Logo 或 favicon 会返回 403，配置版本不变。公开配置拉取失败时 Helmet 保持站点名兜底，不阻塞页面。

## 6. 验证方式

服务端 `apps/server` 下 `pnpm exec vitest run test/system-config.spec.ts` 已通过。用户端、管理端 `tsc --noEmit` 已通过。

本 worktree 的管理端是 `http://localhost:8001`，用户端是 `http://localhost:8003`。`8000` 是另一条 worktree，不能拿来对这条线的 Logo。浏览器里已核对：关键词与 Logo 保存、SVG 上传被拒绝、保存前预览、1440×900 左/右侧栏、390×844 / 820×1180 / 1280×480 只有 Drawer、阅读路径改用 Drawer、关掉主题按钮、关掉 AI 菜单后直接打开 `/ai` 仍可进入、站点配置页提示文字和底部按钮间距。

还没在浏览器里走完的两项：库里没有小册数据，所以没看到真实章节目录和公共导航并排；主题配置接口失败时的 `ErrorState` 只对过代码，没有模拟请求失败。主题页加载失败不会改已保存的主题，说明见交付记录。

## 7. 已知限制与后续扩展

- Loading / Skeleton 和其余页面仍后置。
- `publicBlur` 只保存，不做成滚动毛玻璃。
- 内容卡片、阅读宽度、Hero 排版不在本阶段文件清单里，没有改。
