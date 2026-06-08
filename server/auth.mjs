import crypto from 'node:crypto';
import { db, nowIso, id } from './db.mjs';

// ── Secrets & admin config ────────────────────────────────────────────────────
const DEFAULT_SECRET = 'dev-secret-change-me';
export const appSecret = process.env.APP_SECRET || process.env.JWT_SECRET || DEFAULT_SECRET;
if (process.env.NODE_ENV === 'production' && appSecret === DEFAULT_SECRET) {
  console.error('[FATAL] APP_SECRET não pode ser o valor padrão em produção. Defina APP_SECRET no .env');
  process.exit(1);
}
const encryptionSecret = process.env.APP_ENCRYPTION_KEY || appSecret;
// Lê em runtime para que o .env carregado APÓS os imports do server seja respeitado.
export const isAdminUser = (user) => {
  if (!user) return false;
  const list = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(user.email || '').toLowerCase());
};

// ── In-memory rate limiter ────────────────────────────────────────────────────
const _rateLimitStore = new Map();
export const rateLimit = (key, maxAttempts, windowMs) => {
  const now = Date.now();
  const entry = _rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count++;
  _rateLimitStore.set(key, entry);
  return entry.count > maxAttempts;
};
// Prune stale entries every 10 minutes to avoid memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rateLimitStore.entries()) {
    if (now > v.resetAt) _rateLimitStore.delete(k);
  }
}, 600_000).unref();

// ── Cookie helpers ────────────────────────────────────────────────────────────
export const AUTH_COOKIE = 'auth_token';
export const parseCookies = (req) => {
  const header = req.get('cookie') || '';
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map(c => {
      const idx = c.indexOf('=');
      if (idx === -1) return ['', ''];
      return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    }).filter(([k]) => k)
  );
};
export const setAuthCookie = (res, token) => {
  // secure baseado em res.req.secure (Express respeita trust proxy).
  // Permite HTTP transitório enquanto não há TLS; em HTTPS já marca como secure.
  const isSecure = Boolean(res.req?.secure);
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: '/',
  });
};
export const clearAuthCookie = (res) => {
  const isSecure = Boolean(res.req?.secure);
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, secure: isSecure, sameSite: 'lax', path: '/' });
};

// ── Password & token helpers ──────────────────────────────────────────────────
export const passwordHash = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
};

export const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const verifyPassword = (password, storedHash) => {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const candidate = passwordHash(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
};

const base64url = (input) => Buffer.from(input).toString('base64url');
export const signToken = (payload) => {
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', appSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
};

export const verifyToken = (token) => {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', appSecret).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
};

// ── Encryption helpers ────────────────────────────────────────────────────────
const encryptionKey = crypto.createHash('sha256').update(encryptionSecret).digest();
export const encryptText = (plainText) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
};

export const decryptText = (payload) => {
  const [ivB64, tagB64, encryptedB64] = payload.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

// ── User helpers ──────────────────────────────────────────────────────────────
export const getUserById = (userId) => db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
export const getPlanById = (planId) => db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
export const getUserPlan = (user) => getPlanById(user?.plan_id || 'free');
export const getCreditBalance = (userId) => Number(db.prepare('SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?').get(userId)?.balance || 0);

export const publicUser = (user) => {
  if (!user) return null;
  const balanceRow = db.prepare('SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?').get(user.id);
  const apiKeyRow = db.prepare('SELECT status, last_validated_at FROM user_api_keys WHERE user_id = ? AND provider = ?').get(user.id, 'gemini');
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(user.plan_id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.email_verified_at),
    emailVerifiedAt: user.email_verified_at || null,
    aiBillingMode: user.ai_billing_mode,
    planId: user.plan_id,
    creditBalance: Number(balanceRow?.balance || 0),
    hasGeminiApiKey: Boolean(apiKeyRow),
    geminiApiKeyStatus: apiKeyRow?.status || null,
    geminiApiKeyLastValidatedAt: apiKeyRow?.last_validated_at || null,
    isAdmin: isAdminUser(user),
    plan: plan ? {
      id: plan.id,
      name: plan.name,
      monthlyCredits: plan.monthly_credits,
      maxProjects: plan.max_projects,
      maxScenesPerScript: plan.max_scenes_per_script,
      allowUserApiKey: Boolean(plan.allow_user_api_key),
      priceBrl: plan.price_brl,
    } : null,
    createdAt: user.created_at,
  };
};

export const getScriptSceneLimit = (req) => {
  if (req.user) {
    const plan = getUserPlan(req.user);
    return Number(plan?.max_scenes_per_script || 20);
  }
  if (req.get('x-gemini-api-key')?.trim()) return 120;
  return 20;
};

// ── Auth middlewares ──────────────────────────────────────────────────────────
export const optionalAuth = (req, _res, next) => {
  // Cookie takes priority; Bearer header accepted as fallback (e.g. API clients).
  const cookies = parseCookies(req);
  const cookieToken = cookies[AUTH_COOKIE] || '';
  const header = req.get('authorization') || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const token = cookieToken || bearerToken;
  if (token) {
    const payload = verifyToken(token);
    if (payload?.sub) req.user = getUserById(payload.sub);
  }
  next();
};

export const requireAuth = (req, res, next) => {
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.' });
    next();
  });
};

export const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (!isAdminUser(req.user)) return res.status(403).json({ error: 'Acesso administrativo não autorizado.' });
    next();
  });
};

// ── Email verification gating ────────────────────────────────────────────────
// Use em rotas sensíveis (billing, checkout). Em dev pode ser desativado com
// REQUIRE_EMAIL_VERIFICATION=0.
export const requireVerifiedEmail = (req, res, next) => {
  requireAuth(req, res, () => {
    if (process.env.REQUIRE_EMAIL_VERIFICATION === '0') return next();
    if (!req.user.email_verified_at) {
      return res.status(403).json({
        error: 'Verifique seu e-mail para continuar.',
        code: 'email_not_verified',
      });
    }
    next();
  });
};
