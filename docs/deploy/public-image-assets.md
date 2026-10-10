# 首页和项目页占位图如何上生产

这些图在 `apps/user-web/public/images/`，清单是 `apps/user-web/src/config/publicImageCatalog.json`。用户端构建会把 `public` 拷进 `dist`，生产 Nginx 镜像再把 `dist` 放进站点根目录。生产上没有它们，是因为当前线上还是旧的前端镜像，不是因为数据库缺一行。

发布方式沿用 [production-runbook.md](./production-runbook.md) 里只更新前端的命令：重建 Nginx 镜像。不要把这些 SVG 写进 Prisma 迁移。

上线前可以在仓库根核对文件是否齐全：

```bash
node apps/user-web/scripts/stage-public-images.mjs
```

需要把同一批文件拷到别的目录时：

```bash
node apps/user-web/scripts/stage-public-images.mjs --out /tmp/ph-public-images
```

后台在项目配置里上传的封面和截图不在这批文件里。它们是各自环境的文件 ID，存在 `site.layout.projectVisualAssets`。本地上传的图不会跟着这次前端发布进生产对象存储；以后要带，再按那个环境单独处理。

以后做素材库时，用清单里的 `path` 收录这批占位图，再用文件表收录上传图。后续新加的本地图不要自动塞进这次清单。需求见 [素材库](../product/phase-2/asset-library.md)。
