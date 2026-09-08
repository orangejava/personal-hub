# 后台系统配置中心

## 场景背景

公开前台有多页需要运营文案和布局开关，但后台若把每一页都挂到侧栏，菜单会膨胀。按页面拆配置、用一张入口卡片收口，是后台「配置中心」的常见做法。

## 核心概念

- **配置组**：Nest `system_configs` 按 group 原子更新（`site.general`、`site.homepage`、`site.about`、`site.layout`）。
- **菜单只控制展示**：子页可以有 `routeKey`，但 seed 里 `visible: false`，侧栏不出现。
- **公开组装**：`assemblePublicSiteConfig` 只拼 `is_public` 组；前端 `mapPublicSiteConfig` 必须把后端已外露的字段映射出来，否则页面仍读不到。
- **Umi 全局解包**：页面拿到的是业务 T，写接口失败走全局 toast 的 `error.message`。

## 实现步骤

1. 先定哪些进中心、哪些保持并列（本项目：AI 管理 / 主题配置不进中心）。
2. 扩展 schema 与默认值，保证旧 JSON 能 merge。
3. 改 seed：分组名、隐藏旧菜单、不要把子页写成可见侧栏项。
4. 两端 `routeRegistry` 对齐路径；旧 URL 做 redirect。
5. 后台入口卡片 + 各子页表单；公开页读 `systemConfig`。

## 常见错误

- seed `update` 里写死 `visible: true`，隐藏菜单下次 seed 又冒出来。
- 后端公开接口已经返回 `about`/`layout`，mapper 丢掉后前台永远是硬编码。
- 把关着 `form` / `message` 的保存函数抽到 utils。
- 子页 PUT 只提交部分字段却覆盖整组，把另一页的字段抹掉。本项目项目文案和内容布局共用 `site.layout`，必须先读再 merge。

## 手动验证

后台打开 `/admin/system` → 改关于我 Markdown → 刷新用户端 `/about`。再改项目标题 → 刷新 `/projects`。
