# 前端代码细则

只检查本次 diff 里的 `apps/user-web`、`apps/admin-web`，以及它们改到的 `packages/api-client`、`packages/shared-types`。没改到的文件不要用本清单返工。

方法怎么放，以 `.agents/skills/tsx-structure/SKILL.md` 为准。请求怎么解包，以 `.agents/skills/fullstack-impact/SKILL.md` 为准。用户端视口以 `.agents/rules/mobile-responsive.md` 和 `apps/user-web/src/config/viewport-bands.json` 为准。

## 请求

- 页面、`useRequest`、`getInitialState` 拿到的成功值已经是业务对象。新增或改到的调用还在判断 `res.code === 0`、`success`，或自己 `toApiResponse`，记为 P1。
- 写接口加了 `skipErrorHandler`，页面 `catch` 里又 `message.error` 一次，或者 skip 了却没有失败态，记为 P1。启动拉取、登录冷却、验证码可以 skip，但要走 `nestError`。
- 已有 Nest 的路径在失败时再请求已关闭的 mock，记为 P1。
- 列表和表单的失败要有可见结果：全局 toast 或页面上的 `ErrorState`。不能失败了仍显示旧数据却没有任何提示。

## 页面结构

- 不读 hooks 的数据变换写在组件函数里面，或新抽进只被本页 import 一次的 `utils`，记为 P2。纯函数放组件上方。
- JSX 属性里新写超过约 8 行、并且关着 `form` / `message` / `setState` 的回调，记为 P2。提到组件内具名函数。不要把这种函数抽到无 React 的文件。
- 为了本次需求去改编辑器 DOM 的 `textContent` / `innerHTML`，而组件已有 `setText`、`clear` 一类方法，记为 P1。
- 顺手重排与本次 diff 无关的大页（例如整份 `AiConfig`），记为 P2，建议撤出本次改动。

## 用户端布局

只在 diff 改到 `apps/user-web` 的页面、布局或样式时检查。

- 新写的宽度断点不是 767 / 768–991 / 992，或矮屏不是高度 ≤ 499，记为 P1。Less 里的数字要和 `viewport-bands.json` 一致。
- 某一档放不下时只改了手机、平板仍用桌面布局，记为 P1。更窄的档跟紧凑方案走。
- 图片、表格、代码块或固定侧栏会把 `body` 撑出横向滚动条，记为 P1。横滑必须包在该区块内部。
- 可点控件在手机档小于约 44px，或底部按钮被 flex 压扁，记为 P1。
- 桌面才有的 hover 成了手机上唯一的操作，记为 P1。紧凑档用点击或 Drawer。
- 改了 `PublicHeaderActions` 的内部，同时又在 `PublicLayout` 里改导航位置，两处职责缠在一起，记为 P2。图标加在操作区，位置移动留在布局。

## 管理端

- 一个保存按钮写入两个 `system_configs` 组，或保存主题时把导航字段一起覆盖掉，记为 P0。
- 上传没有沿用调用方已经使用的 `ImageFileField` / 文件 service，又平行造一套上传，记为 P1。
- 预览读的是已保存接口，而表单要求反映未保存的值，记为 P1。

## 主题和文案

- 新页面另起一套色值，不读站点 `colorPrimary` 和已有 token，记为 P2。状态色不要改掉成功、警告、错误的含义。
- 用户能看见的新文案硬编码在组件里，而同页其它文案走 `useIntl`，记为 P2。

## 性能

摘自 [Vercel React Best Practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)，只保留客户端、并且和 Umi 对得上的条目。没有 `useMemo` 本身不记问题。

不采用、也不要在审查里引用：Next.js 服务端规则（`server-*`）、`next/dynamic`、Suspense 流式输出、SWR、`js-*` 微优化、`advanced-*`。请求去重继续用现有 `useRequest`，不要建议改成 SWR。

### 包体积

- 首屏布局或每个页面都会加载的入口，静态引入了只在某个路由或展开后才用的图表、动效、编辑器，记为 P1。拆成路由级 `import()` 或现有懒加载。
- `import _ from 'lodash'`，或 `import * as Icons from '@ant-design/icons'` 把整包打进公共 chunk，记为 P1。具名图标导入保持现状。`import { Button } from 'antd'` 是本仓库写法，不要改成深层路径。
- 统计或埋点打在首屏渲染路径上，页面还不能操作就开始拉脚本，记为 P2。

### 请求

- 同一次加载里互不依赖的请求被写成串行 `await`，把首屏明显拉长，记为 P1。改成 `Promise.all` 或并行的 `useRequest`。
- 新增的 `localStorage` / `sessionStorage` 没有版本或条数上限，并且会随使用一直增长，记为 P2。

### 渲染

- 组件函数内部再定义组件，并在本次 JSX 里使用，子树因此每次重挂载，记为 P1。
- `useEffect` 的依赖是每次渲染都新建的对象、数组或函数，从而重复请求或形成循环，记为 P1。
- `window` / `document` 监听没有在 effect 清理函数里摘掉，或同一个全局事件在多个实例上各绑一次且没有去重，记为 P1。滚动监听没用 `{ passive: true }` 并且卡住滚动，记为 P2。
- 条件可能是 `0` 时写成 `条件 && <节点>`，页面上会多出一个 `0`，记为 P1。
- 渲染时就能算出的值，又用 effect 写回 state，记为 P2。
- 传给子组件的默认值写成行内 `{}` 或 `[]`，子组件因引用变化反复重算重数据，记为 P2。
