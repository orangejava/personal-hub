# Nest HTTP 与 worker 共用同一镜像，Compose 用不同 CMD 启动。
# 构建上下文必须是仓库根（见 compose.prod.yml），以便解析 pnpm workspace。
# 镜像不推送到任何仓库；标签只在本机构建。
FROM node:22-bookworm-slim AS build

WORKDIR /app
# 原 Debian 官方源安装命令保留作对照；腾讯云 CVM 实测下载过慢，当前不执行。
# RUN apt-get update \
#   && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
#   && rm -rf /var/lib/apt/lists/*
# 当前构建命令：仅在镜像构建层切换腾讯云 Debian 镜像并强制 IPv4，不修改宿主机 apt 配置。
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
  && printf 'Acquire::ForceIPv4 "true";\n' > /etc/apt/apt.conf.d/99force-ipv4 \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
# 根锁文件声明了 pnpm patchedDependencies；必须在安装依赖前带入补丁文件。
COPY patches ./patches
COPY apps/server/package.json apps/server/package.json
COPY packages ./packages

RUN pnpm install --frozen-lockfile --filter server...

COPY apps/server ./apps/server

# prisma generate 不连库；真实 migrate 在发布窗口单独执行
ENV DATABASE_URL=postgresql://build:build@localhost:5432/personal_hub?schema=public
RUN pnpm --filter server exec prisma generate
RUN pnpm --filter server build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
# 原 Debian 官方源安装命令保留作对照；runner 是新的基础镜像，当前不执行。
# RUN apt-get update \
#   && apt-get install -y --no-install-recommends openssl ca-certificates \
#   && rm -rf /var/lib/apt/lists/*
# 当前构建命令：runner 阶段同样使用腾讯云 Debian 镜像与 IPv4；不影响容器运行时网络。
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
  && printf 'Acquire::ForceIPv4 "true";\n' > /etc/apt/apt.conf.d/99force-ipv4 \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

COPY --from=build /app /app

WORKDIR /app/apps/server
EXPOSE 3001
CMD ["node", "dist/main"]
