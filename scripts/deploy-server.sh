#!/usr/bin/env bash
# 服务器一键部署：拉代码 → 装依赖 → PM2 重启（启动脚本内会自动 sync 小册）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PM2_APP="personal-hub-dev"
PM2_CONFIG="ecosystem.config.js"
CLEAN=0
SKIP_PULL=0

usage() {
  cat <<'EOF'
用法: ./scripts/deploy-server.sh [选项]

选项:
  --clean     删除 node_modules 后重装（lock/依赖大变更、install 异常时用）
  --no-pull   跳过 git pull（代码未改、只重装依赖或重启时用）
  -h          显示帮助

示例:
  ./scripts/deploy-server.sh              # 日常：拉代码 + 装依赖 + 重启
  ./scripts/deploy-server.sh --no-pull    # 不拉代码，只 install + 重启
  ./scripts/deploy-server.sh --clean      # 依赖异常时的干净重装
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean) CLEAN=1; shift ;;
    --no-pull) SKIP_PULL=1; shift ;;
    -h | --help) usage; exit 0 ;;
    *) echo "未知参数: $1"; usage; exit 1 ;;
  esac
done

if [[ "$SKIP_PULL" -eq 0 ]]; then
  echo "==> [1/4] git pull"
  git pull --ff-only
else
  echo "==> [1/4] 跳过 git pull（--no-pull）"
fi

if [[ "$CLEAN" -eq 1 ]]; then
  echo "==> [2/4] 清理 node_modules"
  rm -rf node_modules apps/*/node_modules packages/*/node_modules 2>/dev/null || true
else
  echo "==> [2/4] 跳过 node_modules 清理（异常时可加 --clean）"
fi

echo "==> [3/4] pnpm install"
pnpm install

echo "==> [4/4] PM2 重启"
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP"
else
  pm2 start "$PM2_CONFIG" --only "$PM2_APP"
fi
pm2 save

echo ""
echo "部署完成。建议验证："
echo "  pm2 logs $PM2_APP --lines 30"
echo "  ss -lntp | grep ':8000'"
echo "  curl -I http://127.0.0.1:8000/content"
