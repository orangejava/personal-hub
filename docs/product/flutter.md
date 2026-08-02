# Flutter App

> 状态：� 已完成细化
> 最后更新：2026-05-31

---

## 定位

Flutter App 作为 Web 端的移动延伸，复用后端 API，**不承接后台管理功能**（后台管理保留在 Web 端）。

---

## 首版功能范围

| 功能         | 说明                                            |
| ------------ | ----------------------------------------------- |
| 登录 / 注册  | 邮箱 + 密码，与 Web 端共用账号体系              |
| 公开内容浏览 | 首页、内容中心列表、内容阅读页                  |
| 内容阅读     | 掘金小册（章节切换）、PDF（内嵌渲染）、Markdown |
| 收藏         | 收藏/取消收藏，查看收藏列表                     |
| AI 工具      | 对话（Chat）、文本生成                          |
| 图片生成     | 首版暂不实现（接口预留）                        |
| 我的用量     | 查看 Token 消耗情况                             |
| 个人设置     | 头像、昵称、密码修改                            |

---

## 技术选型

| 层       | 技术                   | 说明                               |
| -------- | ---------------------- | ---------------------------------- |
| 状态管理 | Riverpod               | 声明式、可测试、支持异步状态       |
| 网络请求 | Dio                    | 拦截器统一处理 Token 刷新          |
| 路由     | go_router              | 声明式路由，支持深链接             |
| 本地存储 | Isar                   | 高性能，支持复杂查询；用于离线缓存 |
| 安全存储 | flutter_secure_storage | 存储 Access Token / Refresh Token  |
| PDF 渲染 | flutter_pdfview        | 原生嵌入，性能好                   |
| Markdown | flutter_markdown       | 渲染 Markdown 内容                 |
| 图片缓存 | cached_network_image   | —                                  |

---

## UI 风格

**与 Web 端保持品牌视觉一致，但遵循 Material Design 3 规范适配移动端体验**：

- 主色调与 Web 端保持一致（从后端 `system_configs` 读取）
- 组件风格使用 Material 3（`useMaterial3: true`）
- 导航：底部 BottomNavigationBar（首页 / 内容 / AI / 我的）
- 不追求像素级复刻 Web 端，优先移动端手势体验

---

## 路由结构

```
/                    → 首页（内容推荐 + AI 工具快速入口）
/content             → 内容列表
/content/:id         → 内容阅读页
/ai/chat             → AI 对话
/ai/chat/:sessionId  → 继续已有会话
/ai/text             → 文本生成
/login               → 登录/注册（未登录时跳转）
/workspace/favorites → 我的收藏
/workspace/usage     → 我的用量
/workspace/profile   → 个人设置
```

---

## 接入方式

- 完全复用 NestJS 后端 RESTful API，不单独建接口；端点、错误码与数据模型以 `docs/backend/canonical-*.md` 为准。
- **Token 认证**：
  - Access Token 存 `flutter_secure_storage`（有效期 8 小时）
  - Refresh Token 存 `flutter_secure_storage`（有效期 7 天）
  - Dio 拦截器自动处理 Token 刷新（401 → 刷新 → 重试）
- Flutter 的 Refresh Token 请求体传输与设备安全策略在 Web 主链路稳定后，以独立 Flutter PRD 定稿；不得降低同一 `SessionService` 的会话撤销、轮换与版本校验语义。
- **AI 流式输出**：SSE（Server-Sent Events），使用 `http` 包的 `send()` 流式读取

---

## 离线缓存策略

**支持有限离线缓存，优先体验可接受的弱网场景**：

| 内容                          | 缓存方式        | 缓存时限             |
| ----------------------------- | --------------- | -------------------- |
| 最近阅读的 5 篇内容（含章节） | Isar 本地存储   | 永久（手动清除）     |
| 内容列表首页数据              | Isar + 过期时间 | 30 分钟              |
| 用户信息（头像/昵称）         | Isar            | 24 小时              |
| AI 对话历史                   | Isar            | 同步保留（不设过期） |

- 完全离线时：展示已缓存内容，AI 工具和未缓存内容显示"网络不可用"提示
- 联网后自动同步最新数据

---

## Token 配额

- **与 Web 端共享同一配额池**（数据库中同一个 `users.token_quota` 字段）
- App 内消耗与 Web 端消耗合并计算，不分开
- App 内展示配额余量，不足时引导联系管理员

---

## 推送通知

**首版不实现推送通知**，预留接入方案：

- 方案：Firebase Cloud Messaging（FCM）
- 后续场景：Token 配额不足提醒、管理员消息通知

---

## API 设计要求（对后端约束）

- 接口设计不耦合页面结构，保持语义独立
- 例：不要用一个接口返回整个首页所有数据，应拆分为独立语义接口
- 内容详情接口统一返回：基础信息 + type + contentRaw/contentHtml + toc + 阅读进度
- 所有列表接口支持分页（`page` + `pageSize`），不使用游标分页（首版）
- SSE 接口需支持 CORS 且响应头正确设置 `Content-Type: text/event-stream`
