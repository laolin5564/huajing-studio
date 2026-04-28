#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="${WEB_UPDATE_REPO_DIR:-$DEFAULT_REPO_DIR}"
UPDATE_SCRIPT="${REPO_DIR}/scripts/update.sh"
LOCK_FILE="${WEB_UPDATE_LOCK_FILE:-/tmp/huajing-studio-web-update.lock}"

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
[[ -x "$UPDATE_SCRIPT" ]] || chmod +x "$UPDATE_SCRIPT" || fail "无法设置 scripts/update.sh 可执行权限"

if [[ -f /.dockerenv ]]; then
  log "检测到当前服务运行在 Docker 容器内。"
  if [[ "$REPO_DIR" == /app || "$REPO_DIR" == /app/* ]]; then
    fail "容器内不能直接更新 /app 镜像目录。请把宿主机 Git 项目目录按相同绝对路径挂载进容器，并设置 WEB_UPDATE_REPO_DIR 为该路径。"
  fi
  if [[ ! -S /var/run/docker.sock ]]; then
    fail "容器内没有 /var/run/docker.sock，无法执行 Docker Compose 重建。请挂载 docker socket，或在宿主机执行 scripts/update.sh。"
  fi
  if ! command -v docker >/dev/null 2>&1; then
    fail "容器内缺少 docker CLI。请在镜像中安装 docker CLI，或在宿主机执行 scripts/update.sh。"
  fi
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  export COMPOSE_BIN="${COMPOSE_BIN:-docker compose}"
elif command -v docker-compose >/dev/null 2>&1; then
  export COMPOSE_BIN="${COMPOSE_BIN:-docker-compose}"
else
  fail "缺少 Docker Compose。请安装 docker compose 插件或 docker-compose。"
fi

if ! command -v flock >/dev/null 2>&1; then
  fail "缺少 flock，无法提供脚本级并发锁。"
fi

log "开始受限 Web 更新流程。脚本只会调用项目内固定 scripts/update.sh，不接受任意命令输入。"
(
  flock -n 9 || fail "已有 Web 更新任务正在执行"
  cd "$REPO_DIR"
  exec "$UPDATE_SCRIPT"
) 9>"$LOCK_FILE"
