import crypto from 'node:crypto';

// ── CSRF protection via double-submit cookie ─────────────────────────────────
// Estratégia:
//   - Cookie `csrf_token` (NÃO httpOnly, para o JS ler) com token aleatório.
//   - Cliente envia o mesmo valor no header `x-csrf-token` em métodos não-seguros.
//   - Servidor compara em tempo constante. Se bater, libera.
// O cookie de sessão `auth_token` é `sameSite=strict`, o que já bloqueia CSRF
// na maioria dos navegadores modernos; o double-submit é defesa em profundidade.

export const CSRF_COOKIE = 'csrf_token';
const HEADER_NAME = 'x-csrf-token';

// Rotas isentas: webhooks externos (Stripe assina o payload) e endpoints somente leitura.
const EXEMPT_PATHS = new Set([
  '/api/stripe/webhook', // será criado na Fase 3 e usa assinatura própria
]);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const generateToken = () => crypto.randomBytes(32).toString('base64url');

const ensureCookie = (req, res) => {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = generateToken();
    // secure baseado na request real (não no NODE_ENV). Em HTTP transitório
    // (sem TLS ainda), o cookie precisa ser não-secure pra ser setado.
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: Boolean(req.secure),
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30,
      path: '/',
    });
    // disponibiliza o token recém-criado para o próprio request (se quiser ler imediatamente)
    req.cookies = req.cookies || {};
    req.cookies[CSRF_COOKIE] = token;
  }
  return token;
};

const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const csrfMiddleware = (req, res, next) => {
  // Sempre garante que o cookie existe para o cliente conseguir ler.
  ensureCookie(req, res);

  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PATHS.has(req.path)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE] || '';
  const headerToken = req.get(HEADER_NAME) || '';

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({ error: 'CSRF token inválido ou ausente.' });
  }
  next();
};
