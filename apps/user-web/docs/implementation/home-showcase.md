# 首页滚动改版与作品矩阵

> 状态：本期已落地，不含首页性能区块
> 最后更新：2026-10-09
> 需求：[home-showcase-prd.md](../prd/home-showcase-prd.md)

## 调用链

1. Nest `parseGroupValue('site.homepage')` 把旧的 4 个模块 key 补成默认 7 个。同 key 只覆盖 `visible` / `sort`；缺 key 时按默认邻居插入。后台已经保存过完整列表时，不再重排。
2. 公开配置仍走 `/api/v1/public/site-config`。用户端在 `fetchPublicConfig` 里把 `homepage` 挂到页面对象上，不改共享的扁平 `SystemPublicConfig`。
3. 首页按 `modules` 的 `visible`、`sort` 渲染。`performance` 有配置项，但页面不渲染，等 `perf-dashboard` 合并后再做。
4. 首屏只挂 Hero。标题直接渲染，不放进 `Stagger`，避免最大内容等淡入动画。其余区块用 `useInView`（提前 200px）再挂载；精选内容的请求跟着区块挂载走。
5. 项目页文字来自 `src/config/projectShowcase.ts`。封面和截图只读公开配置里的 `coverUrl`、`screenshotUrls`，失败回落 `public/images/showcase/<key>.svg`。精选和「更多作品」在内容接口没有数据时展示示例或待补充说明；请求失败时写「暂时读不到内容」，不说成还没有。用户端「查看性能」指向 `/status`，等性能面板那条分支合并后打开。项目进度仍是静态四条，字段按 GitHub Releases 预留（标题、状态、变更、可选日期）。页面不直接请求 GitHub，以后由构建或服务端同步再替换 `PROJECT_PROGRESS`。更多作品只取一篇，不放分页。占位图清单在 `src/config/publicImageCatalog.json`，随用户端构建上生产，见 `docs/deploy/public-image-assets.md`。大图预览在原有翻转、旋转、缩放之外加了下载。AI 图片的大图下载走 `downloadAiAsset`，文件名带扩展名。手机上首页和项目页用 `useDocumentGrows` 给 `html` / `body` / `#root` 加类名后才放开高度，离开页面就拿掉。AI 工具全关或技术栈为空时，首页不渲染对应外层，避免留下空白高度。

## 动效

页面不直接调用 Motion。`src/components/motion/` 提供 `MotionRoot`、`Reveal`、`Stagger`、`ScrollScene`、`useInView`。`LazyMotion` 异步加载 `domAnimation`。开发环境有 `/__motion`，生产构建不注册。

桌面且不是矮屏时，平台能力用 `ScrollScene`。平板、手机、矮屏改成纵向 `Reveal`。

## 故意不做

- 首页性能区块、`/status`、性能采集、入口体积优化
- 透明顶栏、整页吸附、Lenis
- 不改 `PublicLayout`、`PublicHeaderActions`、`routes.ts`、`SystemProjects`、`motion.less`
- 素材库页面还没做。当前只登记随代码提交的占位图，需求见 [素材库](../../../../docs/product/phase-2/asset-library.md)
- 项目进度不接 GitHub API
