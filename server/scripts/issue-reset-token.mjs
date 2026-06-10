#!/usr/bin/env node
/**
 * Emite um token de reset de senha válido para um usuário, usando o MESMO
 * fluxo que o servidor usa no /api/auth/password/forgot: gera 32 bytes
 * aleatórios em base64url, grava só o sha256 hex no banco, e expira em 30 min.
 *
 * Por que existe:
 * - Em produção, /api/auth/password/forgot ainda não envia o token por e-mail
 *   (SMTP não está cabeado). Esse script preenche a lacuna sem precisar
 *   adicionar um endpoint admin (que seria backdoor).
 * - Não toca em users.password_hash. Toda validação acontece via /password/reset.
 * - O token expira sozinho. Se você gerar e não usar, vira lixo natural.
 *
 * Uso (na VM de produção):
 *   sudo systemctl status vycena                  # confirme que está rodando
 *   sudo -u vycena DATABASE_FILE=/opt/vycena/data/saas.sqlite \
 *     node /opt/vycena/server/scripts/issue-reset-token.mjs <email>
 *
 * Imprime a URL pronta (usa PUBLIC_URL do env, se disponível) E o token cru.
 * Use a URL no navegador OU faça o POST direto via curl (impresso também).
 *
 * Auditoria: grava cada emissão em data/audit.log.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..', '..');
const dbFile = process.env.DATABASE_FILE || path.join(projectRoot, 'data', 'saas.sqlite');
const auditFile = path.join(projectRoot, 'data', 'audit.log');
const publicUrl = (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/+$/, '');

const TOKEN_TTL_MIN = 30;

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function appendAudit(line) {
  try {
    fs.mkdirSync(path.dirname(auditFile), { recursive: true });
    fs.appendFileSync(auditFile, `${new Date().toISOString()} ${line}\n`, { mode: 0o600 });
  } catch (err) {
    console.error(`[warn] falha ao gravar audit log: ${err.message}`);
  }
}

function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: node server/scripts/issue-reset-token.mjs <email>');
    process.exit(2);
  }

  if (!fs.existsSync(dbFile)) {
    console.error(`Banco não encontrado em: ${dbFile}`);
    console.error('Defina DATABASE_FILE se o banco está em outro caminho.');
    process.exit(2);
  }

  const db = new DatabaseSync(dbFile);
  try {
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);
    if (!user) {
      console.error(`Nenhum usuário com email "${email}".`);
      process.exit(1);
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(rawToken);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000).toISOString();

    // Mesma política do /forgot: invalida tokens vivos do mesmo user.
    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
      .run(createdAt, user.id);

    db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id('reset'), user.id, tokenHash, expiresAt, null, createdAt);

    appendAudit(`reset-token-issued user_id=${user.id} email=${user.email} expires_at=${expiresAt} by=${process.env.USER || 'unknown'}`);

    const url = `${publicUrl}/reset?token=${encodeURIComponent(rawToken)}`;

    console.log('');
    console.log('✓ Token de reset emitido');
    console.log(`  Usuário : ${user.name} <${user.email}> (id ${user.id})`);
    console.log(`  Expira  : ${expiresAt} (em ${TOKEN_TTL_MIN} min)`);
    console.log('');
    console.log('Abra esta URL no navegador para redefinir a senha:');
    console.log(`  ${url}`);
    console.log('');
    console.log('Ou faça POST direto (substitua NOVA_SENHA):');
    console.log(`  curl -X POST '${publicUrl}/api/auth/password/reset' \\`);
    console.log(`    -H 'Content-Type: application/json' \\`);
    console.log(`    -d '{"resetToken":"${rawToken}","password":"NOVA_SENHA"}'`);
    console.log('');
    console.log(`Auditoria gravada em: ${auditFile}`);
  } finally {
    db.close();
  }
}

main();
