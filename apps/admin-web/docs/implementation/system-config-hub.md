# 系统配置中心

> 状态：已落地
> 最后更新：2026-09-08

## 1. 目标与范围

把后台「系统配置」做成按公开页面拆开的入口中心：站点、首页、内容中心、关于我、项目。侧栏分组改名为「系统管理」，内容管理下不再挂首页配置。主题配置和 AI 管理保持并列，不收进中心。

## 2. 页面与入口

| 路径 | 页面 | 侧栏 |
| --- | --- | --- |
| `/admin/system` | 五张入口卡片 | 系统配置（`admin.system.config`） |
| `/admin/system/site` | 站点名/描述 | 否 |
| `/admin/system/homepage` | 原首页配置表单 | 否（`admin.homepage` 菜单 `visible: false`） |
| `/admin/system/content` | 卡片样式 / 阅读宽度 / 面包屑 / Hero 排版 | 否 |
| `/admin/system/about` | 关于我 Markdown | 否 |
| `/admin/system/projects` | 项目页标题与简介 | 否 |
| `/admin/homepage` | 重定向到首页配置子页 | — |
| `/admin/system/theme` | 主题配置 | 是 |

本地已有库必须再跑一次 baseline seed，才会把「系统」改成「系统管理」、并把旧的内容管理「首页配置」藏起来。

## 3. 接口与数据流

仍走 M3：`GET/PUT /api/v1/admin/system-configs/:group` + `Idempotency-Key` + version。公开前台 `GET /api/v1/public/site-config` 已组装 `about` / `layout`；`mapPublicSiteConfig` 现在会带上这两块，页面读 `initialState.systemConfig`。

`site.layout` 增加 `projectsTitle`、`projectsIntro`。旧 JSON 缺字段时 `parseGroupValue` 用默认值补齐。

## 4. 权限

写配置仍是 `system:config:manage`。核心恢复 key 仍是 `admin.system.config`（中心入口）。

## 5. 验证

1. 后台侧栏：内容管理无首页配置；系统管理下有系统配置与主题配置。
2. 打开系统配置，五张卡片进入子页，保存后刷新公开对应页可见。
3. 访问 `/admin/homepage` 落到 `/admin/system/homepage`。
