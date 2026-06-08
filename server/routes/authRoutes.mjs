import crypto from 'node:crypto';
import { db, nowIso, id, transaction } from '../db.mjs';
import {
  rateLimit,
  passwordHash,
  hashResetToken,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  getUserById,
  publicUser,
} from '../auth.mjs';
import { validate, schemas } from '../validation.mjs';

const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24h

const createVerificationToken = (userId) => {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(rawToken);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
  db.prepare('UPDATE email_verifications SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(createdAt, userId);
  db.prepare(`
    INSERT INTO email_verifications (id, user_id, token_hash, expires_at, used_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id('emailver'), userId, tokenHash, expiresAt, null, createdAt);
  return { rawToken, expiresAt };
};

export default function registerAuthRoutes(app, { asyncRoute }) {
  app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (rateLimit(`register:${ip}`, 10, 60 * 60 * 1000)) {
      throw Object.assign(new Error('Muitas tentativas de registro. Aguarde alguns minutos.'), { status: 429 });
    }

    const { name, email, password } = validate(schemas.register, req.body);

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) throw new Error('Já existe uma conta com este e-mail.');

    const userId = id('user');
    const createdAt = nowIso();
    // Criação de conta + assinatura + créditos iniciais numa única transação:
    // se algum passo falhar, não fica uma conta órfã sem créditos/assinatura.
    transaction(() => {
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, ai_billing_mode, plan_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, name, email, passwordHash(password), 'platform', 'free', createdAt, createdAt);

      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_end, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id('sub'), userId, 'free', 'active', null, createdAt, createdAt);

      db.prepare(`
        INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id('credit'), userId, 'grant', 200, 200, 'Créditos iniciais do plano Free', createdAt);
    });

    const verification = createVerificationToken(userId);
    // TODO Fase 2: enviar e-mail via Resend. Em dev, devolvemos o token na resposta.

    const user = getUserById(userId);
    const token = signToken({ sub: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    setAuthCookie(res, token);
    const response = { user: publicUser(user), token };
    if (process.env.NODE_ENV !== 'production') {
      response.devVerificationToken = verification.rawToken;
      response.devNote = 'Ambiente local: use POST /api/auth/verify-email com este token. Em produção, envie por e-mail.';
    }
    return response;
  }));

  app.post('/api/auth/verify-email', asyncRoute(async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (rateLimit(`verify-email:${ip}`, 20, 60 * 60 * 1000)) {
      throw Object.assign(new Error('Muitas tentativas. Aguarde alguns minutos.'), { status: 429 });
    }
    const { token: rawToken } = validate(schemas.verifyEmail, req.body);

    const tokenHash = hashResetToken(rawToken);
    const row = db.prepare(`
      SELECT t.id AS token_id, t.expires_at, t.used_at, u.id AS user_id, u.email_verified_at
      FROM email_verifications t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ?
    `).get(tokenHash);

    if (!row) throw new Error('Token inválido.');
    if (row.used_at) throw new Error('Este link de verificação já foi usado.');
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error('Link de verificação expirado. Solicite um novo.');
    }

    const updatedAt = nowIso();
    db.prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?')
      .run(updatedAt, updatedAt, row.user_id);
    db.prepare('UPDATE email_verifications SET used_at = ? WHERE id = ?').run(updatedAt, row.token_id);

    return { user: publicUser(getUserById(row.user_id)), message: 'E-mail verificado com sucesso.' };
  }));

  app.post('/api/auth/resend-verification', requireAuth, asyncRoute(async (req) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (rateLimit(`resend-verification:${req.user.id}:${ip}`, 5, 60 * 60 * 1000)) {
      throw Object.assign(new Error('Muitas solicitações. Aguarde uma hora.'), { status: 429 });
    }
    if (req.user.email_verified_at) {
      return { ok: true, message: 'E-mail já estava verificado.' };
    }
    const verification = createVerificationToken(req.user.id);
    // TODO Fase 2: enviar e-mail real
    const response = { ok: true, message: 'Enviamos um novo link de verificação.' };
    if (process.env.NODE_ENV !== 'production') {
      response.devVerificationToken = verification.rawToken;
    }
    return response;
  }));

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (rateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) {
      throw Object.assign(new Error('Muitas tentativas de login. Aguarde 15 minutos.'), { status: 429 });
    }

    const { email, password } = validate(schemas.login, req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new Error('E-mail ou senha inválidos.');
    }

    const token = signToken({ sub: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    setAuthCookie(res, token);
    return { user: publicUser(user), token };
  }));

  app.post('/api/auth/password/forgot', asyncRoute(async (req) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (rateLimit(`forgot:${ip}`, 5, 60 * 60 * 1000)) {
      throw Object.assign(new Error('Muitas solicitações de recuperação. Aguarde uma hora.'), { status: 429 });
    }

    const { email } = validate(schemas.forgotPassword, req.body);

    // Always return the same message to avoid user enumeration.
    const response = {
      message: 'Se o e-mail existir, enviaremos instruções para redefinir a senha.',
    };

    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) return response;

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(rawToken);
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
      .run(createdAt, user.id);
    db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id('reset'), user.id, tokenHash, expiresAt, null, createdAt);

    if (process.env.NODE_ENV !== 'production') {
      // Dev-only: expose token in response so it can be used without an e-mail server.
      return {
        ...response,
        resetToken: rawToken,
        expiresAt,
        devNote: 'Ambiente local: copie este token para redefinir a senha. Em produção, envie por e-mail.',
      };
    }

    // TODO: send e-mail with reset link in production.
    return response;
  }));

  app.post('/api/auth/password/reset', asyncRoute(async (req, res) => {
    const { resetToken, password } = validate(schemas.resetPassword, req.body);

    const tokenHash = hashResetToken(resetToken);
    const row = db.prepare(`
      SELECT t.*, u.id AS account_id
      FROM password_reset_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.used_at IS NULL
    `).get(tokenHash);

    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error('Token de recuperação inválido ou expirado.');
    }

    const updatedAt = nowIso();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash(password), updatedAt, row.account_id);
    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?')
      .run(updatedAt, row.id);

    const user = getUserById(row.account_id);
    const token = signToken({ sub: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    setAuthCookie(res, token);
    return { user: publicUser(user), token, message: 'Senha redefinida com sucesso.' };
  }));

  app.post('/api/auth/logout', (req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });
}
