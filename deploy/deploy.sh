#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Atualiza a aplicação Vycena.
# Executar como root na VM: sudo /opt/vycena/deploy/deploy.sh
# Também usado pelo workflow do GitHub Actions via SSH.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_USER="vycena"
APP_DIR="/opt/vycena"

log() { printf '\n\033[1;36m[deploy]\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Rode com sudo."
[[ -d "$APP_DIR/.git" ]] || fail "$APP_DIR não tem clone do git. Veja setup.sh."

cd "$APP_DIR"

log "Buscando atualizações"
sudo -u "$APP_USER" git fetch origin
PREVIOUS_HEAD="$(git rev-parse HEAD)"
sudo -u "$APP_USER" git reset --hard origin/main
NEW_HEAD="$(git rev-parse HEAD)"
log "HEAD: $PREVIOUS_HEAD → $NEW_HEAD"

log "Instalando dependências (incluindo dev para o build)"
sudo -u "$APP_USER" npm ci --no-audit --no-fund

log "Build do frontend"
sudo -u "$APP_USER" npm run build

log "Removendo devDependencies para produção"
sudo -u "$APP_USER" npm prune --omit=dev

log "Reiniciando serviço"
systemctl restart vycena.service

log "Aguardando o servidor responder"
for i in {1..20}; do
  if curl -fsS http://127.0.0.1:8787/api/health >/dev/null 2>&1; then
    log "Servidor de pé. Versão atual: $NEW_HEAD"
    exit 0
  fi
  sleep 1
done

log "Servidor não respondeu em 20s — checando logs"
journalctl -u vycena.service --no-pager -n 50
fail "Deploy falhou no healthcheck. Rollback manual: git reset --hard $PREVIOUS_HEAD && deploy.sh"
