# 主题与导航配置 PRD

> 状态：🟡 首版已够用；剩余项已后置，不阻塞上线
> 最后更新：2026-09-13
> 优先级：P2（后置）
> 适用范围：公开前台、登录后工作区、运营端后台、系统配置接口

---

## 0. 已落地 vs 后置

**已够用**：

- 公开区顶部导航 + `PublicThemeDrawer` 明暗/主色切换
- 工作区 / 后台沿用 Pro `SettingDrawer`
- 匿名首页读 Nest `GET /api/v1/public/site-config`、`GET /api/v1/public/navigation`；站点显示名后台可改
- 后台 `/admin/system/theme` 可改主色、圆角、默认模式（部分仍是前端本地，未全部写回配置组）

**后置（不阻塞首版上线；域名也不在本 PRD）**：

- 公开区按配置切换左/右导航布局
- 后台主题表单补齐：Logo/favicon 上传、辅助色/强调色、导航位置、功能开关、预览区
- 主题 token 全部从 `system_configs` 读写并刷新前台
- 域名 / HTTPS：见 [../../../../docs/deploy/go-live-mainline.md](../../../../docs/deploy/go-live-mainline.md) §3，首版用公网 IP

---

## 1. 模块目标

项目需要从一开始就支持可配置的视觉与布局能力，避免后续页面写死主题和导航结构。

首版目标：

- 支持主题色配置。
- 支持明暗主题模式配置。
- 支持公开前台导航栏显示位置：上、左、右。
- 支持工作区和运营端保留自己的默认布局，同时预留可配置项。
- 支持从后端系统配置读取公开配置。
- 支持运营端后续通过表单修改配置。

---

## 2. 角色与权限

| 角色 | 能力 |
|---|---|
| 访客 | 读取公开配置并看到对应主题/导航 |
| 登录用户 | 同访客，工作区读取工作区布局配置 |
| 管理员 | 在后台修改主题、导航、站点信息 |

---

## 3. 配置分组

### 3.1 站点基础配置

| Key | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `site.name` | string | `个人知识中台` | 站点名称 |
| `site.description` | string | 空 | SEO 描述 |
| `site.keywords` | string | 空 | SEO 关键词，英文逗号分隔 |
| `site.logo_url` | string | 空 | Logo 图片地址 |
| `site.favicon_url` | string | 空 | favicon 地址 |
| `site.owner_name` | string | 空 | 站长姓名 |
| `site.avatar_url` | string | 空 | 头像 |
| `site.github_url` | string | 空 | GitHub 链接 |
| `site.email` | string | 空 | 联系邮箱 |

### 3.2 主题配置

| Key | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `theme.primary_color` | string | `#2563EB` | 主色，按钮、链接、强调色 |
| `theme.secondary_color` | string | `#14B8A6` | 辅助色 |
| `theme.accent_color` | string | `#F97316` | 强调色，提醒、徽标 |
| `theme.background_color` | string | `#FFFFFF` | 默认背景 |
| `theme.text_color` | string | `#111827` | 默认文字 |
| `theme.radius` | string | `0.75rem` | 全局圆角 |
| `theme.mode` | enum | `system` | `light` / `dark` / `system` |
| `theme.allow_user_switch` | boolean | `true` | 是否允许用户手动切换明暗主题 |

### 3.3 导航配置

| Key | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `navigation.public_position` | enum | `top` | 前台导航位置：`top` / `left` / `right` |
| `navigation.public_sticky` | boolean | `true` | 前台导航是否吸顶或固定 |
| `navigation.public_blur` | boolean | `true` | 顶部导航滚动后是否毛玻璃 |
| `navigation.public_show_logo` | boolean | `true` | 是否展示 Logo |
| `navigation.public_show_auth_entry` | boolean | `true` | 是否展示登录/头像入口 |
| `navigation.workspace_collapsible` | boolean | `true` | 工作区侧边栏是否可收起 |
| `navigation.admin_collapsible` | boolean | `true` | 运营端侧边栏是否可收起 |

### 3.4 未来预留配置

| Key | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `layout.home_hero_style` | enum | `split` | 首页 Hero 风格：`split` / `center` / `minimal` |
| `layout.content_card_style` | enum | `cover` | 内容卡片风格：`cover` / `compact` |
| `layout.content_reader_width` | enum | `comfortable` | 阅读宽度：`narrow` / `comfortable` / `wide` |
| `layout.show_breadcrumb` | boolean | `true` | 是否展示面包屑 |
| `feature.enable_ai_entry` | boolean | `true` | 是否展示 AI 工具入口 |
| `feature.enable_projects` | boolean | `true` | 是否展示项目/作品入口 |
| `feature.enable_theme_switcher` | boolean | `true` | 是否展示主题切换器 |

---

## 4. 前端配置模型

后端返回 Key-Value，但前端不直接在页面中使用散乱 key，需要转换为结构化对象。

```ts
export type NavigationPosition = "top" | "left" | "right";

export interface AppPublicConfig {
  site: {
    name: string;
    description?: string;
    logoUrl?: string;
    ownerName?: string;
    avatarUrl?: string;
    githubUrl?: string;
    email?: string;
  };
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    radius: string;
    mode: "light" | "dark" | "system";
    allowUserSwitch: boolean;
  };
  navigation: {
    publicPosition: NavigationPosition;
    publicSticky: boolean;
    publicBlur: boolean;
    publicShowLogo: boolean;
    publicShowAuthEntry: boolean;
    workspaceCollapsible: boolean;
    adminCollapsible: boolean;
  };
  layout: {
    homeHeroStyle: "split" | "center" | "minimal";
    contentCardStyle: "cover" | "compact";
    contentReaderWidth: "narrow" | "comfortable" | "wide";
    showBreadcrumb: boolean;
  };
  feature: {
    enableAiEntry: boolean;
    enableProjects: boolean;
    enableThemeSwitcher: boolean;
  };
}
```

---

## 5. 页面布局逻辑

### 5.1 前台导航位置

#### `top`

适合默认方案：

```txt
┌───────────────────────────────┐
│ Logo  首页 内容 AI 项目 关于 账户 │
├───────────────────────────────┤
│ 页面内容                        │
└───────────────────────────────┘
```

行为：

- PC 顶部横向导航。
- 移动端变汉堡菜单。
- 可配置 sticky 和 blur。

#### `left`

适合更像知识库的方案：

```txt
┌───────┬───────────────────────┐
│ Logo  │ 页面内容               │
│ 首页  │                       │
│ 内容  │                       │
│ AI    │                       │
│ 项目  │                       │
└───────┴───────────────────────┘
```

行为：

- PC 左侧固定导航。
- 移动端仍使用底部或抽屉菜单。
- 阅读页要避免左侧导航和章节目录冲突。

#### `right`

适合个性化展示方案：

```txt
┌───────────────────────┬───────┐
│ 页面内容               │ Logo  │
│                       │ 首页  │
│                       │ 内容  │
│                       │ AI    │
└───────────────────────┴───────┘
```

行为：

- PC 右侧固定导航。
- 移动端仍使用汉堡或抽屉。
- 右侧目录页面需要优先保证阅读体验，不建议小屏使用。

### 5.2 阅读页特殊规则

Markdown 和掘金小册阅读页本身需要目录栏，所以导航配置要有优先级：

- 移动端：全局导航始终收起为顶部按钮或抽屉。
- Markdown 阅读页：右侧目录优先，左/右导航应自动折叠或降级。
- 掘金小册阅读页：小册列表、章节目录、文章目录优先，公共导航只保留最小入口。

---

## 6. 运营端配置页面

建议新增：

```txt
/admin/system/theme
```

页面分区：

| 区块 | 字段 |
|---|---|
| 站点信息 | 站点名、描述、Logo、favicon、站长姓名、头像 |
| 主题颜色 | 主色、辅助色、强调色、背景色、文字色、圆角 |
| 导航布局 | 前台导航位置、是否固定、是否毛玻璃、是否展示 Logo |
| 功能开关 | AI 入口、项目入口、主题切换器 |
| 预览区 | 展示一张模拟首页卡片和导航预览 |

按钮：

- `保存配置`
- `恢复默认`
- `预览效果`

校验规则：

- 颜色必须为合法 HEX。
- 圆角必须是 CSS 长度值，如 `0.75rem`、`12px`。
- 导航位置只能是 `top` / `left` / `right`。
- Logo、头像、favicon 可为空；如果填写，必须是合法 URL 或文件资源 URL。

---

## 7. API 草案

### 7.1 获取公开配置

```http
GET /api/system/config/public
```

响应重点：

```json
{
  "site": {
    "name": "个人知识中台",
    "description": "..."
  },
  "theme": {
    "primaryColor": "#2563EB",
    "mode": "system"
  },
  "navigation": {
    "publicPosition": "top"
  }
}
```

### 7.2 管理员获取配置

```http
GET /api/admin/system/config?group=theme
```

### 7.3 管理员批量保存配置

```http
PUT /api/admin/system/config/batch
```

请求体：

```json
{
  "items": [
    { "key": "theme.primary_color", "value": "#2563EB", "valueType": "string" },
    { "key": "navigation.public_position", "value": "top", "valueType": "string" }
  ]
}
```

---

## 8. 数据模型影响

沿用 `system_configs` 表：

| 字段 | 用途 |
|---|---|
| `key` | 配置键，如 `theme.primary_color` |
| `value` | 字符串存储，按 `valueType` 解析 |
| `valueType` | string / number / boolean / json |
| `group` | site / theme / navigation / layout / feature |
| `label` | 后台展示名称 |
| `updatedBy` | 最后修改人 |

建议增加种子配置：

- `site.*`
- `theme.*`
- `navigation.*`
- `layout.*`
- `feature.*`

---

## 9. 状态与异常

| 状态 | 前端行为 |
|---|---|
| 配置加载中 | 使用默认主题和默认顶部导航，避免白屏 |
| 配置加载失败 | 使用本地默认配置，控制台输出错误，页面显示不受影响 |
| 配置值非法 | 后端保存时拒绝；前端读取时使用默认值兜底 |
| 管理员无权限 | 跳转 403 |
| 保存失败 | Toast 提示失败原因，保留表单内容 |

---

## 10. 验收标准

- 前台能根据 `navigation.public_position` 切换顶部、左侧、右侧导航。
- 修改 `theme.primary_color` 后，按钮、链接、强调元素颜色能变化。
- 配置接口失败时页面仍可正常打开。
- 后台可看到主题配置表单。
- 后台保存配置后，刷新前台能看到新配置。
- Markdown / 掘金小册阅读页不会因为导航位置变化挤压正文核心阅读区域。
