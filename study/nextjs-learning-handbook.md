# Next.js 学习手册

> 面向已经写过 React、准备进入 Next.js App Router 的开发者。
> 最后更新：2026-06-01

---

## 1. 先把 Next.js 当成什么

对你来说，Next.js 不应该理解成“React 的替代品”，而应该理解成：

- React 的全栈运行时
- 带路由、SSR、RSC、数据获取能力的工程框架

你已经会 React，所以真正要补的是这些能力：

- 文件路由
- 服务端渲染
- Server Component / Client Component
- 缓存与 revalidate

---

## 2. 当前项目里，Next.js 负责什么

- 公开前台页面
- 登录后工作区
- 后台管理台容器
- SEO 页面渲染
- 内容阅读页 SSR / ISR

---

## 3. 你先只学这 6 件事

1. `app/` 目录路由结构
2. `layout.tsx` 与 `page.tsx`
3. 动态路由 `[slug]`
4. Server Component 与 Client Component
5. 服务端 `fetch`
6. `revalidate` 与缓存策略

---

## 4. 你最该先建立的心智模型

### Server Component

适合：

- 内容详情页
- 首页 SEO 区块
- 关于页

特点：

- 默认运行在服务端
- 可以直接取服务端数据
- 不能直接使用浏览器交互 Hook

### Client Component

适合：

- 表单
- 弹窗
- 消息输入框
- 标签切换
- 状态复杂的交互区域

特点：

- 运行在浏览器
- 可以使用 `useState`、`useEffect`
- 更适合交互，不适合承担大量首屏 SEO 工作

---

## 5. 在这个项目里怎么选 Server / Client

优先规则：

1. 默认先写 Server Component
2. 需要交互时，再把局部拆成 Client Component

示例：

- `/content/[slug]` 页面：外层 Server
- 阅读页里的收藏按钮、目录交互：内层 Client

---

## 6. 路由结构怎么理解

推荐先记住这几类位置：

- `app/layout.tsx`：全局根布局
- `app/(public)`：公开前台
- `app/(workspace)`：登录后工作区
- `app/admin`：后台管理
- `app/auth`：登录注册相关页面

你会发现，Next.js 路由不是“配表”，而是“目录本身就是结构”。

---

## 7. 当前阶段的最小实践任务

### 任务 1：创建首页

目标：

- 理解 `page.tsx`
- 理解公开前台路由组

### 任务 2：创建内容列表页

目标：

- 理解普通静态页面与数据页面的区别

### 任务 3：创建 `/content/[slug]`

目标：

- 理解动态路由

### 任务 4：给内容详情页加 ISR

目标：

- 理解为什么内容型页面适合增量静态再生

---

## 8. 推荐练习顺序

```text
首页
→ 公开前台 Layout
→ 工作区 Layout
→ /content 列表页
→ /content/[slug] 详情页
→ 登录页
→ AI Chat 页
```

原因：

- 这条顺序会让你先熟悉路由和布局
- 再逐步进入动态数据和交互

---

## 9. 常用命令

```bash
pnpm --filter next-web dev
pnpm --filter next-web build
pnpm --filter next-web lint
```

如果还没初始化工程，则先执行：

```bash
pnpm dlx create-next-app@latest apps/next-web --ts --app --eslint --src-dir=false --use-pnpm --tailwind
```

---

## 10. 当前项目里最常见的几个坑

### 坑 1：在 Server Component 里直接写浏览器逻辑

例如：

- `window`
- `localStorage`
- `useState`
- `useEffect`

这类代码要放在 Client Component。

### 坑 2：所有页面都写成 Client Component

这样会失去 Next.js 很多优势：

- SEO
- 更好的首屏
- 服务端取数能力

### 坑 3：把所有数据都放到客户端请求

内容站点里，很多页面更适合服务端拿数据。

### 坑 4：一开始就纠结最复杂的缓存策略

当前阶段先掌握：

- 默认缓存
- `no-store`
- `revalidate`

就够了。

---

## 11. 学完后至少要达到什么标准

1. 能独立新增一个页面
2. 能看懂页面属于哪个路由组
3. 能判断一个组件该放 Server 还是 Client
4. 能为内容详情页设置合理的缓存策略
5. 能解释为什么这个项目不优先用 Vite

---

## 12. 遇到问题先怎么排查

1. 先看这个文件是不是在 `app/` 下放对位置了
2. 再看是否错误使用了 Server / Client 能力
3. 再看是否是 `fetch` 缓存行为导致数据不更新
4. 最后再看是不是第三方组件库依赖浏览器环境

> 你对 Next.js 的掌握，不体现在记住多少 API，而体现在你能不能稳定判断“这段代码应该运行在哪里”。
