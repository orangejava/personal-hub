# 公开前台模块规范

> 适用：`src/pages/public`、`src/components/public`

## 范围
首页、内容中心、内容详情、小册章节阅读、项目页、关于我。

## 约束
- 数据走 `src/services/content.ts`、`src/services/booklet.ts`，不写死。
- 视觉沿用 Ant Design Pro 基调，做轻量内容站布局，避免后台表格风格。
- 内容阅读页正文最大宽 `--ph-reading-width: 820px`。
- 与未来 Next.js 重写强相关的组件写成纯展示组件，减少 `useModel`/Umi 运行时依赖。
- Markdown 渲染用 `react-markdown` + `remark-gfm`；编辑器用 `@uiw/react-md-editor`（编辑场景）。
- PDF / Word / 富文本首版只做卡片和详情占位，不接 PDF.js。

## 必备状态
loading、empty、error、unauthorized、forbidden。
