import { describe, it, expect } from 'vitest';
import { db } from './db.mjs';
import {
  passwordHash,
  verifyPassword,
  signToken,
  verifyToken,
  encryptText,
  decryptText,
  hashResetToken,
  rateLimit,
  isAdminUser,
} from './auth.mjs';

describe('passwordHash / verifyPassword', () => {
  it('gera hashes diferentes para a mesma senha (salt aleatório)', () => {
    const a = passwordHash('senha-secreta');
    const b = passwordHash('senha-secreta');
    expect(a).not.toBe(b);
  });

  it('verifica a senha correta', () => {
    const hash = passwordHash('minha-senha-forte');
    expect(verifyPassword('minha-senha-forte', hash)).toBe(true);
  });

  it('rejeita senha incorreta', () => {
    const hash = passwordHash('minha-senha-forte');
    expect(verifyPassword('senha-errada', hash)).toBe(false);
  });

  it('rejeita hash malformado sem lançar', () => {
    expect(verifyPassword('qualquer', 'lixo-sem-formato')).toBe(false);
  });
});

describe('signToken / verifyToken', () => {
  it('assina e verifica um payload', () => {
    const token = signToken({ sub: 'user_123', exp: Date.now() + 10000 });
    const payload = verifyToken(token);
    expect(payload?.sub).toBe('user_123');
  });

  it('rejeita token com assinatura adulterada', () => {
    const token = signToken({ sub: 'user_123', exp: Date.now() + 10000 });
    const [body] = token.split('.');
    const forged = `${body}.assinatura-falsa`;
    expect(verifyToken(forged)).toBeNull();
  });

  it('rejeita token expirado', () => {
    const token = signToken({ sub: 'user_123', exp: Date.now() - 1000 });
    expect(verifyToken(token)).toBeNull();
  });

  it('rejeita token sem ponto separador', () => {
    expect(verifyToken('lixo')).toBeNull();
  });

  it('rejeita payload com body adulterado (assinatura não bate)', () => {
    const token = signToken({ sub: 'user_123', exp: Date.now() + 10000 });
    const [, sig] = token.split('.');
    const tamperedBody = Buffer.from(JSON.stringify({ sub: 'admin', exp: Date.now() + 10000 })).toString('base64url');
    expect(verifyToken(`${tamperedBody}.${sig}`)).toBeNull();
  });
});

describe('encryptText / decryptText', () => {
  it('faz round-trip de texto', () => {
    const secret = 'AIzaSyExemploDeChaveGemini123456';
    const encrypted = encryptText(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptText(encrypted)).toBe(secret);
  });

  it('produz ciphertexts diferentes para o mesmo texto (IV aleatório)', () => {
    const a = encryptText('mesma-coisa');
    const b = encryptText('mesma-coisa');
    expect(a).not.toBe(b);
    expect(decryptText(a)).toBe('mesma-coisa');
    expect(decryptText(b)).toBe('mesma-coisa');
  });

  it('falha ao decifrar payload adulterado (auth tag GCM)', () => {
    const encrypted = encryptText('dado-sensivel');
    const parts = encrypted.split('.');
    parts[2] = Buffer.from('adulterado').toString('base64url');
    expect(() => decryptText(parts.join('.'))).toThrow();
  });
});

describe('hashResetToken', () => {
  it('é determinístico', () => {
    expect(hashResetToken('abc')).toBe(hashResetToken('abc'));
  });
  it('muda com a entrada', () => {
    expect(hashResetToken('abc')).not.toBe(hashResetToken('abd'));
  });
});

describe('rateLimit', () => {
  it('libera até o limite e bloqueia depois', () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 2, 60000)).toBe(false); // 1ª
    expect(rateLimit(key, 2, 60000)).toBe(false); // 2ª
    expect(rateLimit(key, 2, 60000)).toBe(true); // 3ª → bloqueia
  });

  it('reseta após a janela', async () => {
    const key = `test-window-${Math.random()}`;
    expect(rateLimit(key, 1, 50)).toBe(false);
    expect(rateLimit(key, 1, 50)).toBe(true);
    await new Promise((r) => setTimeout(r, 60));
    expect(rateLimit(key, 1, 50)).toBe(false);
  });

  it('persiste o contador entre chamadas (não depende de memória do processo)', () => {
    const key = `test-persist-${Math.random()}`;
    rateLimit(key, 5, 60000);
    rateLimit(key, 5, 60000);
    // Lê direto do banco para confirmar persistência
    const row = db.prepare('SELECT count FROM rate_limits WHERE key = ?').get(key);
    expect(Number(row.count)).toBe(2);
  });

  it('chaves independentes não interferem', () => {
    const a = `ka-${Math.random()}`;
    const b = `kb-${Math.random()}`;
    expect(rateLimit(a, 1, 60000)).toBe(false);
    expect(rateLimit(a, 1, 60000)).toBe(true);
    expect(rateLimit(b, 1, 60000)).toBe(false); // b não foi afetado por a
  });
});

describe('isAdminUser', () => {
  it('reconhece email na lista ADMIN_EMAILS', () => {
    expect(isAdminUser({ email: 'admin@test.dev' })).toBe(true);
  });
  it('é case-insensitive', () => {
    expect(isAdminUser({ email: 'ADMIN@TEST.DEV' })).toBe(true);
  });
  it('rejeita não-admin', () => {
    expect(isAdminUser({ email: 'qualquer@test.dev' })).toBe(false);
  });
  it('rejeita user nulo', () => {
    expect(isAdminUser(null)).toBe(false);
  });
});
