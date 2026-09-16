#!/usr/bin/env bash
# PM2 启动前同步小册并跑 Umi dev（保留 mock）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 服务器默认读 /data；本地开发可省略（走仓库 content-local 软链）
export CONTENT_LOCAL_DIR="${CONTENT_LOCAL_DIR:-/data/personal-hub/content-local}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8000}"
export UMI_ENV="${UMI_ENV:-dev}"
export NODE_ENV="${NODE_ENV:-development}"

echo "[pm2-start-dev] CONTENT_LOCAL_DIR=$CONTENT_LOCAL_DIR"
echo "[pm2-start-dev] 同步小册 → mock/data/local-booklets.generated.ts"
pnpm sync:booklets

echo "[pm2-start-dev] 启动 user-web dev:mock (HOST=$HOST PORT=$PORT)"
exec pnpm --filter user-web dev:mock
