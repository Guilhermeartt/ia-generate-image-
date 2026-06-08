# Deploy no Google Cloud Compute Engine

Conjunto de scripts para subir e atualizar o Vycena em uma VM do GCE.

## Arquitetura

```
Internet
   │
   ▼
nginx (443, TLS via Let's Encrypt)
   │
   ▼
Node 22 (porta 8787, gerenciado pelo systemd)
   │
   ▼
Postgres 16 (local na mesma VM)

Logs systemd ───► Google Cloud Ops Agent ───► Cloud Logging
```

## Primeira instalação na VM

1. **SSH na VM via console do GCP** (mais simples) ou `gcloud compute ssh`.
2. Clonar o repositório:
   ```bash
   sudo mkdir -p /opt/vycena-tmp
   sudo git clone https://github.com/Guilhermeartt/ia-generate-image-.git /opt/vycena-tmp
   sudo cp -r /opt/vycena-tmp/projeto/. /opt/vycena/
   sudo rm -rf /opt/vycena-tmp
   ```
3. Rodar o setup:
   ```bash
   sudo DOMAIN=seudominio.com.br EMAIL=admin@seudominio.com.br \
     bash /opt/vycena/deploy/setup.sh
   ```
   Se ainda não tem domínio, omita `DOMAIN` e `EMAIL`; rode de novo quando tiver.
4. Editar `/etc/vycena/env`:
   - `APP_SECRET` = `openssl rand -hex 32`
   - `APP_ENCRYPTION_KEY` = outro `openssl rand -hex 32`
   - `DATABASE_URL` = use a credencial gerada em `/etc/vycena/.db-credentials`
   - `GEMINI_API_KEY` (ou config Vertex)
5. Primeiro deploy:
   ```bash
   sudo /opt/vycena/deploy/deploy.sh
   ```
6. Verifique:
   ```bash
   systemctl status vycena
   curl https://seudominio.com.br/api/health
   ```

## Atualização automática via GitHub Actions

1. Na VM, gere uma chave SSH dedicada para CI:
   ```bash
   sudo -u vycena ssh-keygen -t ed25519 -f /home/vycena/.ssh/id_ed25519_ci -N ""
   sudo cat /home/vycena/.ssh/id_ed25519_ci.pub >> /home/vycena/.ssh/authorized_keys
   ```
2. Permita ao usuário `vycena` rodar o deploy como root sem senha:
   ```bash
   echo 'vycena ALL=(root) NOPASSWD: /opt/vycena/deploy/deploy.sh' | \
     sudo tee /etc/sudoers.d/vycena-deploy
   sudo chmod 440 /etc/sudoers.d/vycena-deploy
   ```
3. No GitHub do repo, adicione **Secrets**:
   - `GCE_SSH_HOST` = IP externo da VM
   - `GCE_SSH_USER` = `vycena`
   - `GCE_SSH_PRIVATE_KEY` = conteúdo de `/home/vycena/.ssh/id_ed25519_ci`
   - `PUBLIC_HEALTH_URL` = `https://seudominio.com.br/api/health` (opcional)
   - `SLACK_WEBHOOK_URL` = webhook do Slack (opcional)
4. Cada push em `main` dispara `.github/workflows/deploy.yml`.

## Backup do banco

Adicione ao crontab do root:
```bash
sudo crontab -e
# Backup diário às 3h UTC
0 3 * * * /opt/vycena/deploy/backup-db.sh
```

Antes de usar, crie o bucket:
```bash
gcloud storage buckets create gs://vycena-backups --location=us-central1
```

## Rollback

```bash
sudo -u vycena git -C /opt/vycena log --oneline -10
sudo -u vycena git -C /opt/vycena reset --hard <sha-anterior>
sudo /opt/vycena/deploy/deploy.sh
```

Restaurar banco a partir do backup:
```bash
gcloud storage cp gs://vycena-backups/vycena-<timestamp>.sql.gz /tmp/
gunzip -c /tmp/vycena-*.sql.gz | sudo -u postgres pg_restore --clean --if-exists -d vycena
```

## Observabilidade

- **Logs em tempo real**: `journalctl -u vycena -f`
- **Logs no Cloud**: GCP Console → Logging → Logs Explorer; query: `resource.type="gce_instance" jsonPayload.requestId=*`
- **Métricas do host**: GCP Console → Monitoring → Dashboards → VM Instance
- **Uptime monitor**: Crie em Monitoring → Uptime checks apontando para `/api/health` (free)

## Comandos úteis

| Ação | Comando |
|---|---|
| Restart | `sudo systemctl restart vycena` |
| Status | `sudo systemctl status vycena` |
| Logs do app | `sudo journalctl -u vycena -f` |
| Reload nginx | `sudo nginx -t && sudo systemctl reload nginx` |
| Renovar TLS | `sudo certbot renew` (cron faz automático) |
| Editar env | `sudo nano /etc/vycena/env && sudo systemctl restart vycena` |
