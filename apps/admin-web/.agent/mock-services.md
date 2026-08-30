# mock 与 service 层规范

> 适用：`mock/`、`src/services/`、`mock/data/`
>
> 默认 `pnpm dev:admin` 为 `MOCK=none`。需要后台 CRUD mock 时用 `pnpm dev:admin:mock`。

## 分层
```
src/services/   ← 页面调用的服务函数
mock/           ← Umi mock 接口
mock/data/      ← 可复用 mock 数据源
```

## 规则
- 所有 mock 接口按 `ApiResponse<T>` 返回，成功 `code:0`，失败如 `code:401`。
- service 文件按模块拆：`auth.ts`、`content.ts`、`booklet.ts`、`workspace.ts`、`admin.ts`、`ai.ts`、`system.ts`。
- 接口路径贴近未来 NestJS API（见 `docs/react-first/mock-data.md`）。
- mock 数据覆盖：空列表、多页、搜索无结果、无权限、未登录、草稿/已发布/已归档、公开/登录/私密、各内容类型、本地小册目录不存在/meta 错误/无章节。
- 页面禁止直接 import `mock/data`。
- 本地小册同步产物 `mock/data/local-booklets.generated.ts` 由脚本生成，已加入 `.gitignore`。
