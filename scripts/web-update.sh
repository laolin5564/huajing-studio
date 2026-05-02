#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="${WEB_UPDATE_REPO_DIR:-$DEFAULT_REPO_DIR}"
UPDATE_SCRIPT="${REPO_DIR}/scripts/update.sh"
LOCK_PATH="${WEB_UPDATE_LOCK_FILE:-/tmp/huajing-studio-web-update.lock}"
LOCK_DIR="${LOCK_PATH}.d"

log() {
  printf '[huajing-web-update] %s\n' "$*"
}

fail() {
  printf '[huajing-web-update] ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ "${WEB_UPDATE_ENABLED:-}" != "true" ]]; then
  fail "Web 一键更新未启用。请设置 WEB_UPDATE_ENABLED=true 后重启服务。"
fi

[[ -d "$REPO_DIR" ]] || fail "更新目录不存在：$REPO_DIR"
[[ -d "$REPO_DIR/.git" ]] || fail "更新目录不是 Git 部署：$REPO_DIR。Docker 内启用时请把宿主机 Git 项目目录挂载进容器，并设置 WEB_UPDATE_REPO_DIR。"
[[ -f "$UPDATE_SCRIPT" ]] || fail "找不到固定更新脚本：${REPO_DIR}/scripts/update.sh"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  fail "已有 Web 更新任务正在执行"
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

log "开始受限 Web 更新流程。脚本只会调用项目内固定 scripts/update.sh，不接受任意命令输入。"

if [[ -f /.dockerenv ]]; then
  log "检测到当前服务运行在 Docker 容器内，将通过 docker:28-cli 临时容器在宿主机挂载目录中执行更新。"
  if [[ "$REPO_DIR" == /app || "$REPO_DIR" == /app/* ]]; then
    fail "容器内不能直接更新 /app 镜像目录。请把宿主机 Git 项目目录按相同绝对路径挂载进容器，并设置 WEB_UPDATE_REPO_DIR 为该路径。"
  fi
  if [[ ! -S /var/run/docker.sock ]]; then
    fail "容器内没有 /var/run/docker.sock，无法执行 Docker Compose 重建。请挂载 docker socket，或在宿主机执行 scripts/update.sh。"
  fi
  if ! command -v docker >/dev/null 2>&1; then
    fail "容器内缺少 docker CLI。请重新构建最新镜像，或在宿主机执行 scripts/update.sh。"
  fi

  docker run --rm \
    -e UPDATE_REPO="${UPDATE_REPO:-}" \
    -e UPDATE_CHECK_URL="${UPDATE_CHECK_URL:-}" \
    -e UPDATE_TAG="${UPDATE_TAG:-}" \
    -e BACKUP_DIR="${BACKUP_DIR:-}" \
    -e HUAJING_SAFE_REPO_DIR="$REPO_DIR" \
    -v "$REPO_DIR:$REPO_DIR" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -w "$REPO_DIR" \
    docker:28-cli \
    sh -lc 'apk add --no-cache bash curl python3 >/dev/null && git config --global --add safe.directory "$HUAJING_SAFE_REPO_DIR" && chmod +x scripts/update.sh && bash scripts/update.sh'
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  export COMPOSE_BIN="${COMPOSE_BIN:-docker compose}"
elif command -v docker-compose >/dev/null 2>&1; then
  export COMPOSE_BIN="${COMPOSE_BIN:-docker-compose}"
else
  fail "缺少 Docker Compose。请安装 docker compose 插件或 docker-compose。"
fi

chmod +x "$UPDATE_SCRIPT" || fail "无法设置 scripts/update.sh 可执行权限"
cd "$REPO_DIR"
"$UPDATE_SCRIPT"
