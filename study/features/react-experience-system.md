# React 体验系统：动效、骨架屏与结果态

## 1. 场景背景

当项目进入多个页面并行开发后，常见问题是每个页面自己写 loading、空态、错误态和动画。短期能跑，长期会出现体验不统一、改动难收口、后续 AI 页面重复造状态组件的问题。

阶段 4.5 的做法是先把体验能力收敛到 shared 层，再让页面只声明业务状态。

## 2. 核心概念

- 页面切换动画只包页面主体，不包顶栏和侧栏。
- 页面级等待用 `PageLoading`，区块级等待用 `SectionSkeleton`。
- 空态、错误态、无权限、网络异常统一走 `ResultState`。
- 卡片和少量列表用 `MotionSurface` / `AnimatedList`，大表格交给 ProTable。
- 所有动效参数来自 `tokens.less` 和 `motion.less`，页面不硬编码动画。

## 3. 实现步骤

1. 先定义 motion token：页面、内容、hover、stagger 分开。
2. 在布局层接入 `PageTransition`，避免页面自己写路由动画。
3. 扩展 `SectionSkeleton` 的业务变体，例如 form、stats、media。
4. 用 `ResultState` 收敛 empty/error/forbidden/offline。
5. 页面操作增加 `saving`、`operatingId` 或 `batchDeleting`，防止重复提交。
6. 完成后用浏览器检查页面是否闪动、跳动、控制台是否有新增报错。

## 4. 关键代码

页面切换只包主体：

```tsx
<PageTransition routeKey={history.location.pathname}>
  {children}
</PageTransition>
```

区块加载用统一骨架：

```tsx
{loading ? (
  <SectionSkeleton variant="media" minHeight={420} />
) : (
  <PdfViewer url={previewUrl} />
)}
```

操作反馈用局部状态：

```tsx
setSaving(true);
try {
  await saveConfig(values);
} finally {
  setSaving(false);
}
```

## 5. 常见错误

- 在每个页面直接写 `animation`，后续无法统一调节。
- 用整页 Spin 代替区块骨架，会打断阅读。
- 图片和文档没有固定尺寸，加载完成后页面跳动。
- 删除、保存等操作没有 loading，用户重复点击导致状态混乱。
- 后台表格筛选后强制滚顶，用户会丢失上下文。

## 6. 手动验证

1. 切换公开页、工作区、后台页面，看顶栏/侧栏是否稳定。
2. 打开 PDF/Word 内容详情，确认加载前后预览区域高度稳定。
3. 在后台执行保存、删除、批量删除、发布/归档，确认有反馈且不会重复提交。
4. 开启深色主题和窄屏，确认文字可读、布局不重叠。
