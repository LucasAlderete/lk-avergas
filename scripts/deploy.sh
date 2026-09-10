#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/deploy.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/deploy.env"
fi

WEB_ROOT="${WEB_ROOT:-/var/www/avergas}"
GIT_BRANCH="${GIT_BRANCH:-main}"

log() {
  printf '\n▶ %s\n' "$1"
}

die() {
  printf '\n✗ %s\n' "$1" >&2
  exit 1
}

command -v git >/dev/null || die "git no está instalado"

log "Averga's Stats deploy"
echo "  Repo:     $ROOT"
echo "  Web root: $WEB_ROOT"
echo "  Branch:   $GIT_BRANCH"

log "Actualizando código (git pull origin $GIT_BRANCH)"
git fetch origin "$GIT_BRANCH"
git checkout "$GIT_BRANCH"
git pull origin "$GIT_BRANCH"

if [[ "$ROOT" != "$WEB_ROOT" ]]; then
  log "Publicando en $WEB_ROOT"
  sudo mkdir -p "$WEB_ROOT"
  sudo cp -f "$ROOT/index.html" "$WEB_ROOT/index.html"
  sudo chown -R www-data:www-data "$WEB_ROOT"
else
  log "El repo ya es $WEB_ROOT — nada que copiar"
fi

log "Deploy terminado"
