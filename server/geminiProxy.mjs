import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { projectRoot } from './db.mjs';
import { optionalAuth, publicUser, getUserById } from './auth.mjs';
import { recordUsage } from './billing.mjs';

import registerAuthRoutes from './routes/authRoutes.mjs';
import registerAccountRoutes from './routes/accountRoutes.mjs';
import registerProjectRoutes from './routes/projectRoutes.mjs';
import registerAdminRoutes from './routes/adminRoutes.mjs';
import registerGeminiRoutes from './routes/geminiRoutes.mjs';
import registerSam2Routes from './routes/sam2Routes.mjs';

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

// Text endpoints can receive large scripts/CSV; image endpoints need even more.
app.use(express.json({ limit: '20mb' }));
const imageJsonParser = express.json({ limit: '75mb' });

app.use(optionalAuth);

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
registerAuthRoutes(app, deps);
registerAccountRoutes(app, deps);
registerProjectRoutes(app, deps);
registerAdminRoutes(app, deps);
registerGeminiRoutes(app, deps);
registerSam2Routes(app, deps);

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
