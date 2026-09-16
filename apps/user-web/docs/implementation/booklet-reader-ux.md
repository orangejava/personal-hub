# 小册/Markdown 阅读体验优化

> 状态：已落地（前端 localStorage 偏好）
> 最后更新：2026-07-22

## 需求摘要

1. Markdown 正文图片固定高度 400px，点击 antd Image 预览
2. 右侧大纲语雀化：同色背景、树折叠、眼睛显隐、hover 临时展开（主栏不加宽）
3. 小册页右下角 BackTop
4. 上下章在正文列宽内居中；返回内容中心在大纲列；footer 滚到底才可见
5. 主题与阅读进度写入 `ph.prefs.v1`，刷新可恢复；小册入口跳上次章节并恢复章内滚动

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `utils/clientPreferences.ts` | 主题/阅读进度 localStorage |
| `components/shared/MarkdownViewer` | 固定高度图 + PreviewGroup |
| `components/shared/TocPanel` | 大纲树 / 钉住 / hover |
| `components/shared/BookletChapterFooter` | 底部上下章 + 返回链接，列宽与正文/大纲对齐 |
| `pages/public/BookletChapter` | 右区 body(内容+footer)、BackTop、进度 |
| `pages/public/ContentDetail` | Markdown 进度、小册入口跳章、大纲复用 |
| `app.tsx` / `PublicLayout` | 启动合并本地主题、抽屉写入偏好 |
| `styles/typography.less` / `booklet-reader.less` / `layout.less` | 视觉 |

## 偏好优先级

`用户 localStorage 主题` > `站点系统配置主题` > 代码默认值

- 阅读中主动切章后强制回顶；重新打开小册仍恢复章节与滚动
- BackTop：`visibilityHeight` 降至 200，并右偏移避开大纲遮挡

## 手动验证

1. 打开含大图的小册章节：图高约 400px，点击可预览
2. 点眼睛隐藏大纲 → 主栏宽度不变；hover 右侧槽位临时展开
3. 滚动后出现右下回顶；滚到底见 footer（上下章在正文宽居中 + 右侧返回链接）
4. 切换主题后刷新，主题仍保留
5. 读到某章中部 → 经 `/content/{bookletId}` 再进，应回到该章并接近原滚动位置
