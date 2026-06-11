import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, '..');

export const nowIso = () => new Date().toISOString();
export const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;

/**
 * Executa `fn` dentro de uma transação SQLite. Faz COMMIT no sucesso e
 * ROLLBACK em qualquer exceção, garantindo atomicidade de operações que
 * envolvem múltiplos INSERT/UPDATE (ex.: débito de crédito + log de uso).
 *
 * Não pode ser aninhada (SQLite não suporta transações aninhadas nativas);
 * se já houver uma transação ativa, executa direto para não quebrar.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export const transaction = (fn) => {
  // db.isTransaction existe em node:sqlite recente; fallback defensivo.
  const alreadyInTx = typeof db.isTransaction === 'boolean' ? db.isTransaction : false;
  if (alreadyInTx) return fn();
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // se o rollback falhar, propaga o erro original mesmo assim
    }
    throw err;
  }
};

// Caminho do banco é configurável via DATABASE_FILE — permite que testes usem
// um arquivo temporário (ou ':memory:') sem tocar no banco de produção/dev.
const dbFile = process.env.DATABASE_FILE || path.join(projectRoot, 'data', 'saas.sqlite');
if (dbFile !== ':memory:') {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
}

export const db = new DatabaseSync(dbFile);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    ai_billing_mode TEXT NOT NULL DEFAULT 'platform',
    plan_id TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    monthly_credits INTEGER NOT NULL,
    max_projects INTEGER NOT NULL,
    max_scenes_per_script INTEGER NOT NULL,
    allow_user_api_key INTEGER NOT NULL,
    price_brl INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_validated_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, provider),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    file_name TEXT,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    project_id TEXT,
    operation TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'gemini',
    model TEXT NOT NULL,
    billing_mode TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_brl REAL NOT NULL DEFAULT 0,
    credit_cost INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_end TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_payment_id TEXT,
    amount_brl INTEGER NOT NULL,
    status TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    received_at TEXT NOT NULL,
    processed_at TEXT,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS svg_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    markup TEXT NOT NULL,
    view_w INTEGER,
    view_h INTEGER,
    thumbnail TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON stripe_events(processed_at);
  CREATE INDEX IF NOT EXISTS idx_svg_templates_user ON svg_templates(user_id, updated_at);
`);

// ── Migrations idempotentes (para bancos pré-existentes) ─────────────────────
const addColumnIfMissing = (table, column, definition) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};
addColumnIfMissing('users', 'email_verified_at', 'TEXT');
addColumnIfMissing('users', 'stripe_customer_id', 'TEXT');
addColumnIfMissing('plans', 'stripe_price_id', 'TEXT');
addColumnIfMissing('subscriptions', 'stripe_subscription_id', 'TEXT');
addColumnIfMissing('subscriptions', 'stripe_price_id', 'TEXT');
addColumnIfMissing('subscriptions', 'cancel_at_period_end', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('payments', 'stripe_payment_intent_id', 'TEXT');
addColumnIfMissing('payments', 'stripe_invoice_id', 'TEXT');
addColumnIfMissing('payments', 'receipt_url', 'TEXT');

const seedPlans = db.prepare(`
  INSERT OR IGNORE INTO plans (id, name, monthly_credits, max_projects, max_scenes_per_script, allow_user_api_key, price_brl)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
seedPlans.run('free', 'Free', 200, 2, 20, 1, 0);
seedPlans.run('byok', 'Creator BYOK', 1000, 25, 250, 1, 3900);
seedPlans.run('platform', 'Creator Platform', 5000, 50, 500, 1, 9900);
