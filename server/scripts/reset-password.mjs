#!/usr/bin/env node
/**
 * Reset administrativo de senha — uso local apenas.
 *
 * NÃO é um endpoint HTTP. Roda no terminal, exige confirmação interativa,
 * grava a operação em data/audit.log e usa o mesmo PBKDF2 do servidor.
 *
 * Uso:
 *   node server/scripts/reset-password.mjs <email>
 *   echo "Senha-Nova-123!" | node server/scripts/reset-password.mjs <email>  (não recomendado: vai pro shell history)
 *
 * A senha é lida do stdin **sem eco** quando o terminal é interativo.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..', '..');
const dbFile = process.env.DATABASE_FILE || path.join(projectRoot, 'data', 'saas.sqlite');
const auditFile = path.join(projectRoot, 'data', 'audit.log');

const MIN_PASSWORD_LEN = 8;

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      // Modo não-interativo: lê a primeira linha do stdin sem mascarar.
      const rl = readline.createInterface({ input: process.stdin });
      rl.once('line', (line) => { rl.close(); resolve(line); });
      rl.once('close', () => resolve(''));
      return;
    }
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buf = '';
    const onData = (ch) => {
      if (ch === '\n' || ch === '\r' || ch === '') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(buf);
      } else if (ch === '') { // Ctrl+C
        process.stdout.write('\n');
        reject(new Error('cancelado'));
      } else if (ch === '' || ch === '\b') { // Backspace
        buf = buf.slice(0, -1);
      } else {
        buf += ch;
      }
    };
    stdin.on('data', onData);
  });
}

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function appendAudit(line) {
  try {
    fs.mkdirSync(path.dirname(auditFile), { recursive: true });
    fs.appendFileSync(auditFile, `${new Date().toISOString()} ${line}\n`, { mode: 0o600 });
  } catch (err) {
    console.error(`[warn] falha ao gravar audit log: ${err.message}`);
  }
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: node server/scripts/reset-password.mjs <email>');
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

    console.log(`Usuário encontrado:`);
    console.log(`  id    : ${user.id}`);
    console.log(`  nome  : ${user.name}`);
    console.log(`  email : ${user.email}`);
    console.log(`Banco: ${dbFile}`);
    console.log('');

    const password = await readSecret('Nova senha (não será exibida): ');
    if (password.length < MIN_PASSWORD_LEN) {
      console.error(`Senha precisa ter pelo menos ${MIN_PASSWORD_LEN} caracteres.`);
      process.exit(2);
    }
    const confirm = await readSecret('Confirme a nova senha: ');
    if (password !== confirm) {
      console.error('As senhas não conferem.');
      process.exit(2);
    }

    const hashed = passwordHash(password);
    const updatedAt = new Date().toISOString();
    const info = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hashed, updatedAt, user.id);

    if (info.changes !== 1) {
      console.error('UPDATE não atingiu nenhuma linha — abortando.');
      process.exit(1);
    }

    appendAudit(`password-reset user_id=${user.id} email=${user.email} by=${process.env.USER || 'unknown'}`);
    console.log('');
    console.log('✓ Senha atualizada com sucesso.');
    console.log(`  Auditoria gravada em: ${auditFile}`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
