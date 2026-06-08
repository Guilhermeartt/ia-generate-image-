#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Backup do Postgres para Google Cloud Storage.
# Coloque no cron diário: 0 3 * * * /opt/vycena/deploy/backup-db.sh
# Pré-requisitos: gcloud CLI autenticado com permissão de gravar no bucket.
# Crie o bucket com retenção: gcloud storage buckets create gs://vycena-backups --location=us-central1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BUCKET="${BACKUP_BUCKET:-gs://vycena-backups}"
DB_NAME="${DB_NAME:-vycena}"
DB_USER="${DB_USER:-vycena}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
TMP="/tmp/vycena-${TS}.sql.gz"

log() { printf '\n\033[1;36m[backup]\033[0m %s\n' "$*"; }

log "Dump do banco $DB_NAME"
sudo -u postgres pg_dump --format=custom --no-owner --compress=9 "$DB_NAME" | gzip > "$TMP"

SIZE="$(du -h "$TMP" | cut -f1)"
log "Tamanho: $SIZE"

log "Enviando para $BUCKET"
gcloud storage cp "$TMP" "$BUCKET/$(basename "$TMP")"

rm -f "$TMP"

log "Limpando backups com mais de $RETENTION_DAYS dias"
CUTOFF_DATE="$(date -u -d "$RETENTION_DAYS days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-${RETENTION_DAYS}d +%Y-%m-%dT%H:%M:%SZ)"
gcloud storage ls -l "$BUCKET/" | awk -v cutoff="$CUTOFF_DATE" '$2 < cutoff && /\.sql\.gz$/ { print $3 }' | while read -r OLD; do
  gcloud storage rm "$OLD"
  log "Removido $OLD"
done

log "Backup concluído."
