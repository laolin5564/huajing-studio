#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_SLUG="${UPDATE_REPO:-laolin5564/huajing-studio}"
GITHUB_API="${UPDATE_CHECK_URL:-https://api.github.com/repos/${REPO_SLUG}/releases/latest}"
UPDATE_TAG="${1:-${UPDATE_TAG:-}}"
BACKUP_DIR="${BACKUP_DIR:-${REPO_DIR}/backups}"
COMPOSE_BIN="${COMPOSE_BIN:-}"

log() {
  printf '[huajing-update] %s\n' "$*"
}

fail() {
  printf '[huajing-update] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

validate_tag() {
  local tag="$1"
  [[ "$tag" =~ ^v?[0-9]+(\.[0-9]+){1,2}([._+-][0-9A-Za-z.-]+)?$ ]] || fail "非法版本号：$tag"
}

fetch_latest_tag() {
  require_cmd curl
  require_cmd python3
  curl --fail --silent --show-error --location --connect-timeout 10 --max-time 30 --retry 2 --retry-delay 1 "$GITHUB_API" \
    | python3 -c 'import json, sys; print(json.load(sys.stdin).get("tag_name", ""))'
}

detect_compose_bin() {
  if [[ -n "$COMPOSE_BIN" ]]; then
    return
  fi

  if docker compose version >/dev/null 2>&1; then
    COMPOSE_BIN="docker compose"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_BIN="docker-compose"
    return
  fi

  fail "缺少 Docker Compose。请安装 docker compose 插件或 docker-compose。"
}

cd "$REPO_DIR"

[[ -d .git ]] || fail "当前目录不是 Git 部署。请使用 git clone 安装，或手动下载 release 包覆盖代码。"
require_cmd git
require_cmd docker
detect_compose_bin

if [[ -z "$UPDATE_TAG" ]]; then
  log "正在从 GitHub Releases 获取最新版本..."
  UPDATE_TAG="$(fetch_latest_tag)"
fi

[[ -n "$UPDATE_TAG" ]] || fail "未获取到可更新版本"
validate_tag "$UPDATE_TAG"

log "目标版本：$UPDATE_TAG"
log "备份 data/ 和 .env* 到 $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [[ -d data ]]; then
  tar -czf "$BACKUP_DIR/data-${STAMP}.tar.gz" data
fi

shopt -s nullglob
ENV_FILES=(.env .env.local .env.production .env.production.local)
if (( ${#ENV_FILES[@]} > 0 )); then
  tar -czf "$BACKUP_DIR/env-${STAMP}.tar.gz" "${ENV_FILES[@]}"
fi
shopt -u nullglob

log "拉取 GitHub tag..."
git fetch --tags --prune origin

if ! git diff --quiet || ! git diff --cached --quiet; then
  fail "工作区有未提交改动。请先处理本地改动后再更新。"
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git checkout main
git pull --ff-only origin main

if git rev-parse -q --verify "refs/tags/${UPDATE_TAG}" >/dev/null; then
  git checkout "$UPDATE_TAG"
else
  log "未找到 tag $UPDATE_TAG，保持 main 最新代码。"
fi

log "重新构建并启动 Docker Compose..."
$COMPOSE_BIN up -d --build

log "更新完成。备份位置：$BACKUP_DIR"
log "如需回到原分支，可执行：git checkout $CURRENT_BRANCH"
