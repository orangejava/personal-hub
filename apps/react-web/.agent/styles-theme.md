# 样式与主题规范

> 适用：`src/styles/`、`src/global.less`、主题配置

## 分层文件
| 文件 | 职责 |
|---|---|
| `tokens.less` | 布局尺寸、主色占位、小册布局变量 |
| `globals.less` | reset、body、链接、滚动条 |
| `layout.less` | 页面布局、工作区 ProLayout 修正 |
| `public-theme.less` | **公开前台语义色**（亮/暗 `.ph-public-dark`） |
| `typography.less` | Markdown 阅读排版（绑定主题变量） |
| `booklet-reader.less` | 小册四栏布局 |
| `motion.less` | 动画变量 |
| `utilities.less` | 工具类 |

## 公开区主题变量（`public-theme.less`）

| 变量 | 用途 |
|---|---|
| `--ph-bg-layout` | 页面背景 |
| `--ph-bg-container` | 卡片/顶栏/侧栏头 |
| `--ph-bg-spotlight` | 次级面板、代码块外围 |
| `--ph-text-primary` | 标题、正文 |
| `--ph-text-secondary` | 摘要、说明 |
| `--ph-text-tertiary` | 元信息、弱化文字 |
| `--ph-border-color` | 分割线 |
| `--ph-hero-gradient` | 首页 Hero 背景 |
| `--ph-code-bg` | 行内/围栏代码背景 |
| `--ph-color-primary` | 主色（由 `PublicLayout` 同步） |

暗色：在 `.ph-public-dark` 下覆写上述变量，**不要**在组件里写 `isDark ? '#fff' : '#000'`。

## 工作区主题

- `initialState.settings` + Pro `SettingDrawer`
- 与 `publicSettings` 完全独立

## Markdown 渲染插件栈

| 能力 | 方案 |
|---|---|
| GFM | `remark-gfm` |
| 围栏代码高亮 | `highlight.js` + 自定义 `code` 组件（勿在 code 内再包一层 `pre`） |
| 外链图片 | URL 规范化 + `/api/dev/proxy-image` 代理图床 |
| 可选扩展 | `rehype-raw`（HTML 混排）、`rehype-sanitize`（消毒） |

## 规则

- 公开页新增样式优先加语义 class 到 `public-theme.less`。
- 动画克制，160~240ms。
