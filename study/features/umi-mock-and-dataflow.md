# Umi Max 的 Mock 数据流与 useRequest 自动解包

> 阶段 1 基础底座的学习沉淀。适用于「在 Umi Max 里搭一套可平滑切真实后端的 mock 数据层」。

## 场景背景
React-first 阶段没有后端，但希望业务代码写法与未来接 NestJS 时一致：service 返回 `ApiResponse<T>`，组件用 `useRequest`。这样切真实后端时只换 baseURL，不改业务代码。

## 核心概念
- **`ApiResponse<T>`**：`{ code, message, data }`，`code === 0` 成功。所有 mock 接口都包一层。
- **Umi mock 约定**：`mock/*.ts` 里 `export default { 'GET /api/xxx': (req,res)=>{} }` 即一个路由。
- **`useRequest` 默认解包**：Umi 的 request 插件默认 `formatResult: r => r?.data`，所以 `useRequest(service)` 的 `data` 是 `T`，不是 `ApiResponse<T>`。这是最容易踩的坑。
- **`getInitialState`**：Umi 启动时执行一次，结果挂到 `@@initialState` model，全局 `useModel('@@initialState')` 可读。

## 实现步骤
1. 定义 `ApiResponse<T>` 与业务类型（`packages/shared-types`）。
2. 写 `mock/utils.ts`：`ok(res, data)` / `fail(res, msg)` / `parsePagination(req)`。
3. 写 `mock/*.ts` 路由，import `mock/data/*` 纯数据。
4. `config/config.ts`：`mock.include = ['mock/*.ts']`，把 `mock/utils.ts` 加进 `mock.exclude`。
5. `src/services/*.ts`：用 `request` 封装，返回 `ApiResponse<T>`。
6. 组件里 `useRequest(fetchX)`，直接用 `data`（已是 `T`）。

## 关键代码
mock 工具：
```ts
export const ok = (res: Response, data: unknown) =>
  res.json({ code: 0, message: 'ok', data });
```
组件（注意 `data` 已解包）：
```ts
const { data, loading } = useRequest(fetchWorkspaceStats);
// data: WorkspaceStats | undefined，不是 ApiResponse<WorkspaceStats>
```

## 常见错误
- **`mock/data` 被当模块加载**：`mock.include` 用 `mock/**/*` 会把目录当模块，报 `Cannot find module .../mock/data`。改成 `mock/*.ts`。
- **`mock/utils.ts` 重复路由告警**：utils 的具名导出被当作路由扫描。把 utils 加进 `mock.exclude`。
- **`mock/**` 不允许 import src**：Umi 构建检查会把 mock 文件算进 client bundle，若 mock 反向 import `src` 会报错。mock 只能 import `mock/*` 和 `shared-types`。
- **把 `data?.data` 当 `ApiResponse`**：因为 `useRequest` 已解包，再 `.data` 就是 `undefined`。

## 手动验证
- `curl http://localhost:8000/api/workspace/usage` → `{"code":0,"data":{...}}`。
- 组件里 `console.log(data)` 是 `WorkspaceStats`，不是外层包装。
- `tsc --noEmit` 中 `data?.data` 报 `Property 'data' does not exist on type 'WorkspaceStats'`，即说明已被解包。
