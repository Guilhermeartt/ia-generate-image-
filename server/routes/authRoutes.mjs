import crypto from 'node:crypto';
import { db, nowIso, id } from '../db.mjs';
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

export default function registerAuthRoutes(app, { asyncRoute }) {
  app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (rateLimit(`register:${ip}`, 10, 60 * 60 * 1000)) {
      throw Object.assign(new Error('Muitas tentativas de registro. Aguarde alguns minutos.'), { status: 429 });
    }

    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || !email || password.length < 8) {
      throw new Error('Informe nome, e-mail e uma senha com pelo menos 8 caracteres.');
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) throw new Error('Já existe uma conta com este e-mail.');

    const userId = id('user');
    const createdAt = nowIso();
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

    const user = getUserById(userId);
    const token = signToken({ sub: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
    setAuthCookie(res, token);
    return { user: publicUser(user), token };
  }));

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (rateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) {
      throw Object.assign(new Error('Muitas tentativas de login. Aguarde 15 minutos.'), { status: 429 });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
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

    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) throw new Error('Informe o e-mail da conta.');

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
    const resetToken = String(req.body.resetToken || '').trim();
    const password = String(req.body.password || '');
    if (!resetToken || password.length < 8) {
      throw new Error('Informe o token de recuperação e uma nova senha com pelo menos 8 caracteres.');
    }

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
