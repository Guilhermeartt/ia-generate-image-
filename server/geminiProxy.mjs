import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { projectRoot } from './db.mjs';
import { optionalAuth, publicUser, getUserById } from './auth.mjs';
import { recordUsage } from './billing.mjs';
import { csrfMiddleware } from './csrf.mjs';
import { requestLogger } from './requestLogger.mjs';

import registerAuthRoutes from './routes/authRoutes.mjs';
import registerAccountRoutes from './routes/accountRoutes.mjs';
import registerProjectRoutes from './routes/projectRoutes.mjs';
import registerAdminRoutes from './routes/adminRoutes.mjs';
import registerGeminiRoutes from './routes/geminiRoutes.mjs';
import registerSam2Routes from './routes/sam2Routes.mjs';
import registerHealthRoutes from './routes/healthRoutes.mjs';
import registerStripeWebhookRoutes from './routes/stripeWebhookRoutes.mjs';
import { initSentry, sentryRequestHandler, sentryErrorHandler } from './sentry.mjs';

const app = express();
const port = Number(process.env.API_PORT || 8787);

const loadEnvFile = (fileName) => {
  const filePath = path.join(projectRoot, fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const equalIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadEnvFile('.env');
loadEnvFile('.env.local');

// ── Fail-fast: variáveis obrigatórias em produção ─────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const required = ['APP_SECRET', 'APP_ENCRYPTION_KEY', 'PUBLIC_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[FATAL] Variáveis obrigatórias ausentes em produção: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.APP_SECRET && process.env.APP_SECRET.length < 32) {
    console.error('[FATAL] APP_SECRET deve ter pelo menos 32 caracteres em produção.');
    process.exit(1);
  }
}

// ── Trust proxy: necessário atrás de Cloudflare/Fly/Render para req.ip correto e secure cookies
app.set('trust proxy', 1);

// ── Security headers via Helmet ───────────────────────────────────────────────
// CSP é desabilitado aqui porque o app é uma SPA com inline scripts gerados pelo Vite;
// reabilitamos com nonce após introduzir um build com nonce injection.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
// Mesmo origin em produção (Express serve a SPA), mas mantemos config explícita
// para permitir clientes alternativos (extensão, app desktop) via PUBLIC_URL.
// Lista de origens explicitamente permitidas (separadas por vírgula em PUBLIC_URL).
const explicitOrigins = new Set(
  (process.env.PUBLIC_URL || 'http://localhost:3000')
    .split(',').map((o) => o.trim()).filter(Boolean)
);
app.use((req, res, next) => {
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // same-origin nav / curl
      // Permite explicitamente o PUBLIC_URL.
      if (explicitOrigins.has(origin)) return callback(null, true);
      // Permite quando a Origin é a mesma do Host atual — cobre acesso por IP,
      // domínio novo, ou múltiplos hosts atrás do mesmo backend.
      try {
        const originHost = new URL(origin).host;
        const reqHost = req.get('host') || '';
        if (originHost && originHost === reqHost) return callback(null, true);
      } catch { /* origin malformado */ }
      return callback(new Error('Origem não permitida pela política de CORS.'));
    },
    credentials: true,
  })(req, res, next);
});

app.use(cookieParser());

// ── Sentry (no-op se SENTRY_DSN não estiver definido) ────────────────────────
initSentry();
app.use(sentryRequestHandler());

// ── Webhook do Stripe — precisa do body cru, ANTES do express.json global ────
registerStripeWebhookRoutes(app);

// ── Request logger com x-request-id e sanitização de campos sensíveis ─────────
app.use(requestLogger);

// Text endpoints can receive large scripts/CSV; image endpoints need even more.
app.use(express.json({ limit: '20mb' }));
const imageJsonParser = express.json({ limit: '75mb' });

app.use(optionalAuth);
app.use(csrfMiddleware);

// ── Shared route helper ───────────────────────────────────────────────────────
const asyncRoute = (handler) => async (req, res) => {
  const route = `${req.method} ${req.path}`;
  try {
    const data = await handler(req, res);
    if (data?.costEntry) recordUsage(req, data.costEntry);
    if (data && req.user) data.user = publicUser(getUserById(req.user.id));
    if (!res.headersSent) res.json(data);
  } catch (error) {
    const message = error?.message || 'Erro inesperado no servidor.';
    const status = Number(error?.status) || 500;
    console.error(`[${route}] Erro ${status}:`, message);
    if (!res.headersSent) res.status(status).json({ error: message });
  }
};

const deps = { asyncRoute, imageJsonParser };

// ── Register routes ───────────────────────────────────────────────────────────
registerHealthRoutes(app, deps);
registerAuthRoutes(app, deps);
registerAccountRoutes(app, deps);
registerProjectRoutes(app, deps);
registerAdminRoutes(app, deps);
registerGeminiRoutes(app, deps);
registerSam2Routes(app, deps);

// ── Sentry captura erros antes do handler global ────────────────────────────
app.use(sentryErrorHandler());

// ── Global error handler (ensures API errors are always JSON) ─────────────────
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Erro inesperado no servidor.';
  console.error(`[${req.method} ${req.path}] Erro global ${status}:`, message);
  if (!res.headersSent) res.status(status).json({ error: message });
});

// ── Static files & SPA fallback ───────────────────────────────────────────────
app.use(express.static(path.join(projectRoot, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(projectRoot, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`[Gemini Proxy] API em http://localhost:${port}`);
});
