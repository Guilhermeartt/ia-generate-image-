#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Setup idempotente da VM Vycena no Google Cloud Compute Engine.
#
# O que faz:
#   1. Instala dependências de SO (curl, git, build-essential, ufw, nginx, certbot, postgres)
#   2. Instala Node 22 LTS via NodeSource
#   3. Cria usuário de sistema "vycena" e diretórios /opt/vycena, /etc/vycena
#   4. Inicializa Postgres local + cria banco + usuário da aplicação
#   5. Instala unit systemd e config do nginx (com placeholder de domínio)
#   6. Habilita firewall ufw (porta 22, 80, 443)
#   7. Instala Google Cloud Ops Agent (logging + monitoring)
#
# Como usar (na VM, como root ou sudo):
#   sudo DOMAIN=seudominio.com.br EMAIL=admin@seudominio.com.br \
#        bash /opt/vycena/deploy/setup.sh
#
# Re-executar é seguro — cada bloco verifica estado antes de aplicar.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
APP_USER="vycena"
APP_DIR="/opt/vycena"
ENV_DIR="/etc/vycena"
DB_NAME="vycena"
DB_USER="vycena"

log() { printf '\n\033[1;36m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m[warn]\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Rode com sudo."

# ── 1) Pacotes base ──────────────────────────────────────────────────────────
log "Atualizando apt e instalando dependências de SO"
apt-get update -y
apt-get install -y --no-install-recommends \
  curl git ca-certificates gnupg lsb-release build-essential \
  ufw nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib

# ── 2) Node 22 via NodeSource ────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22* ]]; then
  log "Instalando Node 22 via NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  log "Node 22 já instalado ($(node -v))"
fi

# ── 3) Usuário do app + diretórios ───────────────────────────────────────────
if ! id "$APP_USER" >/dev/null 2>&1; then
  log "Criando usuário do sistema '$APP_USER'"
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
install -d -m 750 -o "$APP_USER" -g "$APP_USER" "$ENV_DIR"

# Se o repo ainda não foi clonado, alertar — quem clona é o operador
if [[ ! -d "$APP_DIR/.git" ]]; then
  warn "$APP_DIR não tem clone do git. Clone com:"
  warn "  sudo -u $APP_USER git clone https://github.com/Guilhermeartt/ia-generate-image-.git $APP_DIR-tmp"
  warn "  sudo mv $APP_DIR-tmp/projeto/* $APP_DIR-tmp/projeto/.[^.]* $APP_DIR/"
  warn "  sudo chown -R $APP_USER:$APP_USER $APP_DIR"
fi

# ── 4) Postgres local: banco + usuário ───────────────────────────────────────
systemctl enable --now postgresql

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  log "Criando usuário Postgres '$DB_USER' (senha aleatória)"
  DB_PASS="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
  log "Anote a DATABASE_URL no env: postgres://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"
  echo "DATABASE_URL_HINT=postgres://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME" > "$ENV_DIR/.db-credentials"
  chmod 600 "$ENV_DIR/.db-credentials"
else
  log "Usuário Postgres '$DB_USER' já existe"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  log "Criando banco '$DB_NAME'"
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi

# ── 5) Arquivo de env (template) ─────────────────────────────────────────────
if [[ ! -f "$ENV_DIR/env" ]]; then
  log "Criando template $ENV_DIR/env — você precisa preencher os secrets"
  cat > "$ENV_DIR/env" <<EOF
# Vycena production environment
# Não comitar este arquivo. Preencha valores reais e ajuste permissões.

NODE_ENV=production
API_PORT=8787
PUBLIC_URL=https://${DOMAIN:-CHANGE_ME}

# Geração via openssl rand -hex 32
APP_SECRET=CHANGE_ME_32_BYTES_HEX
APP_ENCRYPTION_KEY=CHANGE_ME_32_BYTES_HEX

# Admins
ADMIN_EMAILS=guilherme.artt@gmail.com

# Banco
DATABASE_URL=postgres://$DB_USER:CHANGE_ME@127.0.0.1:5432/$DB_NAME

# Provider de IA (escolha um)
# GEMINI_API_KEY=AIza...
# OU Vertex AI:
# GOOGLE_APPLICATION_CREDENTIALS=/etc/vycena/sa.json
# GOOGLE_CLOUD_PROJECT=seu-projeto
# GOOGLE_CLOUD_LOCATION=us-central1

# Stripe (Fase 3 — deixe vazio até configurar)
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_PUBLISHABLE_KEY=pk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# Email transacional (Fase 2 — deixe vazio até configurar)
# RESEND_API_KEY=re_...
# EMAIL_FROM=noreply@${DOMAIN:-CHANGE_ME}

# Observabilidade (Fase 4 — opcional)
# SENTRY_DSN=https://...
EOF
  chmod 640 "$ENV_DIR/env"
  chown root:"$APP_USER" "$ENV_DIR/env"
else
  log "$ENV_DIR/env já existe — não sobrescrevendo"
fi

# ── 6) systemd unit ──────────────────────────────────────────────────────────
log "Instalando unit do systemd"
install -m 644 "$APP_DIR/deploy/vycena.service" /etc/systemd/system/vycena.service
systemctl daemon-reload
systemctl enable vycena.service

# ── 7) nginx ─────────────────────────────────────────────────────────────────
if [[ -n "$DOMAIN" ]]; then
  log "Configurando nginx para $DOMAIN"
  sed "s/__DOMAIN__/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/vycena
  ln -sf /etc/nginx/sites-available/vycena /etc/nginx/sites-enabled/vycena
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
else
  warn "DOMAIN não definido. Pulando config do nginx. Rode novamente com DOMAIN=... quando tiver."
fi

# ── 8) Firewall ufw ──────────────────────────────────────────────────────────
log "Configurando firewall ufw"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# ── 9) TLS via Let's Encrypt ─────────────────────────────────────────────────
if [[ -n "$DOMAIN" && -n "$EMAIL" ]]; then
  if [[ ! -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    log "Solicitando certificado Let's Encrypt para $DOMAIN"
    certbot --nginx --non-interactive --agree-tos -m "$EMAIL" -d "$DOMAIN" --redirect
  else
    log "Certificado para $DOMAIN já existe"
  fi
else
  warn "DOMAIN ou EMAIL ausentes. Pulando TLS. Quando tiver, rode:"
  warn "  sudo certbot --nginx -d $DOMAIN -m $EMAIL --agree-tos"
fi

# ── 10) Google Cloud Ops Agent (logs + métricas no console GCP) ──────────────
if ! systemctl is-active --quiet google-cloud-ops-agent; then
  log "Instalando Google Cloud Ops Agent"
  curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
  bash add-google-cloud-ops-agent-repo.sh --also-install
  rm -f add-google-cloud-ops-agent-repo.sh
else
  log "Ops Agent já está rodando"
fi

# Configura o Ops Agent pra coletar o journal do vycena.service como log estruturado
cat > /etc/google-cloud-ops-agent/config.yaml <<'EOF'
logging:
  receivers:
    vycena_journal:
      type: systemd_journald
      include_units: [vycena.service]
  processors:
    parse_json:
      type: parse_json
  service:
    pipelines:
      vycena:
        receivers: [vycena_journal]
        processors: [parse_json]
metrics:
  receivers:
    hostmetrics:
      type: hostmetrics
      collection_interval: 60s
  service:
    pipelines:
      default_pipeline:
        receivers: [hostmetrics]
EOF
systemctl restart google-cloud-ops-agent

log "Setup concluído."
log "Próximos passos manuais:"
log "  1) Edite $ENV_DIR/env com APP_SECRET/APP_ENCRYPTION_KEY (openssl rand -hex 32)"
log "  2) Edite DATABASE_URL com a senha do banco (veja $ENV_DIR/.db-credentials)"
log "  3) Faça o primeiro deploy: sudo $APP_DIR/deploy/deploy.sh"
log "  4) Confira: systemctl status vycena && curl -s http://127.0.0.1:8787/api/health"
