# 生产 Nginx：用户端挂 `/`，管理端挂 `/admin`（构建时 PUBLIC_PATH=/admin/）。
# 构建上下文必须是仓库根。不写入镜像仓库地址。
FROM node:22-bookworm-slim AS web-build

WORKDIR /app
# 原 Debian 官方源安装命令保留作对照；腾讯云 CVM 实测下载过慢，当前不执行。
# RUN apt-get update \
#   && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
#   && rm -rf /var/lib/apt/lists/*
# 当前构建命令：仅在镜像构建层切换腾讯云 Debian 镜像并强制 IPv4，不修改宿主机 apt 配置。
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
  && printf 'Acquire::ForceIPv4 "true";\n' > /etc/apt/apt.conf.d/99force-ipv4 \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/user-web/package.json apps/user-web/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts --filter user-web... --filter admin-web...

COPY apps/user-web ./apps/user-web
COPY apps/admin-web ./apps/admin-web

# 生产镜像不带 content-local；mock 生成文件 gitignore，构建期用空数组占位以免 import 失败
RUN printf '%s\n' \
  '// 由生产镜像构建占位，请勿当作本地 sync:booklets 产物' \
  "import type { Booklet, BookletChapter } from '@personal-hub/shared-types';" \
  'export const localBooklets: Booklet[] = [];' \
  'export const localBookletChapters: BookletChapter[] = [];' \
  > apps/user-web/mock/data/local-booklets.generated.ts

RUN pnpm --filter user-web build
RUN PUBLIC_PATH=/admin/ pnpm --filter admin-web build

FROM nginx:1.27-alpine
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/user-web/dist /usr/share/nginx/html
COPY --from=web-build /app/apps/admin-web/dist /usr/share/nginx/html/admin
