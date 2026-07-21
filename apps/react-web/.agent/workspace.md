# 工作区模块规范

> 适用：`src/pages/workspace`、`src/components/workspace`

## 范围
工作台、文档管理、新建内容向导、Markdown 编辑、小册管理、收藏、用量、个人设置。

## 约束
- 登录后可访问；`editor`/`admin` 可内容生产，`member` 看到无权限态。
- 优先使用 Ant Design / Pro Components（ProTable、ProForm、ModalForm、DrawerForm）。
- 布局：顶栏 + 侧栏，侧栏宽 `--ph-sidebar-width: 224px`。
- 数据走 `src/services/workspace.ts`、`src/services/content.ts`。
- 文档状态切换（发布/归档/删除）只做 mock。
- 表格、表单字段贴近 `docs/prd/react-first/content-workspace-prd.md` 与未来 API 字段。

## 编辑器
- Markdown 编辑用 `@uiw/react-md-editor`：左右分栏、移动端 Tabs、标题输入、基础信息抽屉、保存草稿/发布 mock、离开未保存提醒。
- Word / 富文本本阶段仅占位。
