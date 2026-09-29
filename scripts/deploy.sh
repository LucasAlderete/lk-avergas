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
SERVICE_NAME="${SERVICE_NAME:-avergas}"

log() {
  printf '\n▶ %s\n' "$1"
}

die() {
  printf '\n✗ %s\n' "$1" >&2
  exit 1
}

ensure_env() {
  local key="$1"
  local value="$2"
  if ! grep -q "^${key}=" "$ROOT/deploy.env"; then
    printf '%s=%s\n' "$key" "$value" >> "$ROOT/deploy.env"
    echo "  + ${key}"
  fi
}

command -v git >/dev/null || die "git no está instalado"
command -v node >/dev/null || die "node no está instalado (hace falta Node 18+)"
command -v npm >/dev/null || die "npm no está instalado"

if [[ ! -f "$ROOT/deploy.env" ]]; then
  log "Creando deploy.env desde el ejemplo"
  cp "$ROOT/scripts/deploy.env.example" "$ROOT/deploy.env"
fi

# shellcheck disable=SC1091
source "$ROOT/deploy.env"

log "Completando variables en deploy.env"
ensure_env PORT 3001
ensure_env HOST 127.0.0.1
ensure_env MONGODB_URI 'mongodb://127.0.0.1:27017/avergas'
ensure_env MONGODB_DB avergas
ensure_env GOOGLE_CLIENT_ID ''
ensure_env SESSION_SECRET "$(openssl rand -hex 24 2>/dev/null || echo cambia-esto-por-un-secreto-largo)"
# shellcheck disable=SC1091
source "$ROOT/deploy.env"

log "Averga's Club deploy"
echo "  Repo:   $ROOT"
echo "  Branch: $GIT_BRANCH"

log "Actualizando código (origin/$GIT_BRANCH)"
git fetch origin "$GIT_BRANCH"
git checkout "$GIT_BRANCH"
git reset --hard "origin/$GIT_BRANCH"

log "Instalando dependencias y buildeando"
if [[ -f "$ROOT/package-lock.json" ]]; then
  npm ci
else
  npm install
fi
npm run build

DIST="$ROOT/dist"
if [[ ! -d "$DIST" ]]; then
  die "No se generó dist/"
fi

if [[ "$WEB_ROOT" != "$ROOT" ]]; then
  log "Publicando estáticos en $WEB_ROOT"
  sudo mkdir -p "$WEB_ROOT"
  sudo rm -rf "$WEB_ROOT/dist"
  sudo cp -a "$DIST" "$WEB_ROOT/dist"
else
  log "dist/ queda en $ROOT/dist"
fi

NODE_BIN="$(command -v node)"
APP_USER="$(id -un)"
APP_GROUP="$(id -gn)"
UNIT_SRC="$ROOT/scripts/avergas.service.in"
UNIT_DST="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ -f "$UNIT_SRC" ]] && command -v systemctl >/dev/null; then
  log "Instalando servicio ${SERVICE_NAME}"
  tmp="$(mktemp)"
  sed -e "s|__ROOT__|${ROOT}|g" \
      -e "s|__NODE__|${NODE_BIN}|g" \
      -e "s|__USER__|${APP_USER}|g" \
      -e "s|__GROUP__|${APP_GROUP}|g" \
      "$UNIT_SRC" > "$tmp"
  if [[ "$(id -u)" -eq 0 ]]; then
    install -m 644 "$tmp" "$UNIT_DST"
    chmod 640 "$ROOT/deploy.env" || true
    systemctl daemon-reload
    systemctl enable --now "$SERVICE_NAME"
    systemctl restart "$SERVICE_NAME"
  elif command -v sudo >/dev/null; then
    sudo install -m 644 "$tmp" "$UNIT_DST"
    sudo chmod 640 "$ROOT/deploy.env" || true
    sudo systemctl daemon-reload
    sudo systemctl enable --now "$SERVICE_NAME"
    sudo systemctl restart "$SERVICE_NAME"
  fi
  rm -f "$tmp"

  log "Chequeando API en ${HOST:-127.0.0.1}:${PORT:-3001}"
  ok=0
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf "http://${HOST:-127.0.0.1}:${PORT:-3001}/api/health" >/dev/null; then
      ok=1
      break
    fi
    sleep 1
  done
  if [[ "$ok" -ne 1 ]]; then
    if [[ "$(id -u)" -eq 0 ]]; then
      systemctl status "$SERVICE_NAME" --no-pager -l || true
      journalctl -u "$SERVICE_NAME" -n 50 --no-pager || true
    else
      sudo systemctl status "$SERVICE_NAME" --no-pager -l || true
      sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager || true
    fi
    die "La API no respondió después del restart"
  fi
fi

log "Deploy terminado"
echo "  API: ${HOST:-127.0.0.1}:${PORT:-3001}"
echo "  Nginx: /api -> ese puerto, el resto dist/"
echo "  GOOGLE_CLIENT_ID tiene que estar en deploy.env"
