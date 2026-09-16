# Nest HTTP 与 worker 共用同一镜像，Compose 用不同 CMD 启动。
# 构建上下文必须是仓库根（见 compose.prod.yml），以便解析 pnpm workspace。
# 镜像不推送到任何仓库；标签只在本机构建。
FROM node:22-bookworm-slim AS build

WORKDIR /app
# 腾讯云 CVM 访问 Debian 官方源可能长期低速；保留下面标准 apt 命令，仅在构建层改用已验证的镜像并强制 IPv4。
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
  && printf 'Acquire::ForceIPv4 "true";\n' > /etc/apt/apt.conf.d/99force-ipv4
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
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
# runner 阶段是新的基础镜像，需要再次应用构建期镜像源与 IPv4 配置；不影响容器运行时网络。
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
  && printf 'Acquire::ForceIPv4 "true";\n' > /etc/apt/apt.conf.d/99force-ipv4
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

COPY --from=build /app /app

WORKDIR /app/apps/server
EXPOSE 3001
CMD ["node", "dist/main"]
