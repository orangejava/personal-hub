# 桌面端 App 技术选型对比

> 状态：想法与选型对比，**不是当前开发依据**
> 最后更新：2026-09-30
> 当前只在 `/projects` 作品矩阵里以「规划中」展示；后续技术方向已选 **Tauri 2**，见 [home-showcase-prd.md](../../../apps/user-web/docs/prd/home-showcase-prd.md)

## 1. 前提

- 桌面端和 Flutter App 一样，共用同一套 Nest API
- 优先覆盖内容阅读和 AI 对话
- 最省事的路线是复用现有 `apps/user-web` 的 React 界面，再加桌面能力（托盘、快捷键、本地文件、离线缓存）

## 2. 三个候选

除了 Electron 和 Tauri，Flutter 本身也支持 Windows / macOS / Linux 桌面，因为项目已经规划了 Flutter App，所以一起比较。

| 维度 | Electron | Tauri 2 | Flutter Desktop |
| --- | --- | --- | --- |
| 界面怎么来 | 复用 `user-web` 的 React 代码 | 复用 `user-web` 的 React 代码 | 复用 Flutter App 的界面，与 Web 界面不同 |
| 渲染引擎 | 自带 Chromium，各系统表现一致 | 用系统自带的 WebView：Windows 是 WebView2（Chromium），macOS 是 WKWebView（Safari 内核），Linux 是 WebKitGTK | Flutter 自绘引擎，各系统一致 |
| 本地能力层语言 | Node.js / TypeScript | Rust（前端仍是 TypeScript） | Dart |
| 安装包体积（量级） | 约 80–150 MB | 约 3–15 MB | 约 20–40 MB |
| 空闲内存（量级） | 约 150–300 MB | 约 30–80 MB | 约 50–120 MB |
| 安全模型 | 需要自己关 Node 集成、开上下文隔离、写预加载白名单 | 默认最小权限，按「能力」声明允许调用的系统接口 | 原生应用，无网页注入面 |
| 自动更新与打包 | electron-builder / Electron Forge，成熟 | 官方 updater 插件和打包工具，成熟度在追赶 | 需要自己拼 MSIX / DMG / AppImage 方案 |
| 生态和案例 | 最大：VS Code、Slack、Cursor | 增长快，大型案例相对少 | 桌面端生态较小 |
| 学习成本（对你） | 最低，全部是 TypeScript | 中等：简单功能靠官方插件，写自定义本地能力要学 Rust | 取决于 Flutter App 是否先做 |
| 面试展示价值 | 常规 | 较高：体积小、Rust、安全模型都是话题 | 较高：一套 Flutter 代码覆盖移动和桌面 |

## 3. 和本项目相关的风险

- **Tauri 的渲染差异**：macOS 和 Linux 不是 Chromium。项目里用到的 CSS 滚动驱动动画在 Safari 26 以上才支持；Linux 的 WebKitGTK 版本通常更旧，PDF 预览（pdfjs）、antd 的部分样式、首页动效需要单独回归
- **Electron 的体积**：和本项目「优化加载速度」的主线形成对比，但桌面安装一次后不影响网页性能
- **Flutter Desktop 的重复开发**：界面和 Web 端是两套，内容阅读、Markdown 渲染、AI 对话流式输出都要在 Dart 里再做一遍；只有在 Flutter App 已经做完时才划算

## 4. 建议

- **想尽快有桌面端、只包一层现有网页**：选 Electron。风险最小，全部复用 TypeScript
- **想兼顾体积和学习价值**：选 Tauri 2。先只用官方插件（窗口、托盘、通知、更新），不写自定义 Rust；Linux 版本放到最后，先做 Windows 和 macOS
- **Flutter App 先上线**：再评估 Flutter Desktop，用一套 Dart 代码同时覆盖移动和桌面

已确定后续以 **Tauri 2** 为技术方向。进入开发前仍须单独写 PRD，并先做一个只加载线上网页的最小验证包，在 Windows、macOS、Linux 上跑一遍内容阅读和 AI 对话；Linux 若出现 WebKitGTK 兼容问题，不影响先发布 Windows / macOS。

## 5. 待确认

- [x] 技术方向：Tauri 2（2026-09-30 确认）
- [ ] 桌面端和 Flutter App 谁先做
