import { describe, it, expect } from 'vitest';
import { db, transaction, id, nowIso } from './db.mjs';

// Cria um usuário real (FK de credit_transactions é enforçada) e retorna o id.
const makeUser = () => {
  const userId = id('user');
  const now = nowIso();
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, ai_billing_mode, plan_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, 'TX', `${userId}@test.dev`, 'x:y', 'platform', 'free', now, now);
  return userId;
};

const insertCredit = (userId, amount) =>
  db.prepare(`
    INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id('credit'), userId, 'grant', amount, amount, 'teste', nowIso());

const balanceOf = (userId) =>
  Number(db.prepare('SELECT COALESCE(SUM(amount), 0) AS b FROM credit_transactions WHERE user_id = ?').get(userId)?.b || 0);

describe('transaction()', () => {
  it('faz commit das escritas no sucesso', () => {
    const u = makeUser();
    transaction(() => {
      insertCredit(u, 100);
      insertCredit(u, 50);
    });
    expect(balanceOf(u)).toBe(150);
  });

  it('faz rollback de tudo se uma exceção ocorre no meio', () => {
    const u = makeUser();
    expect(() =>
      transaction(() => {
        insertCredit(u, 100);
        throw new Error('falha proposital');
      }),
    ).toThrow('falha proposital');
    // O primeiro insert deve ter sido revertido
    expect(balanceOf(u)).toBe(0);
  });

  it('retorna o valor da função', () => {
    const result = transaction(() => 42);
    expect(result).toBe(42);
  });
});
