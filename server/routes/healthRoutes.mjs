import { db } from '../db.mjs';

// ── Health probes ────────────────────────────────────────────────────────────
// /healthz   → liveness (o processo está vivo)
// /readyz    → readiness (depende do banco; quem orquestra evita rotear pra cá quando falha)
// Nenhuma autenticação. Não logamos para não poluir.

const startedAt = Date.now();

export default function registerHealthRoutes(app) {
  // Endpoints com prefixo /api para passar pelo proxy do Vite em dev.
  // Em produção (Express servindo tudo), funcionam igualmente.
  const liveness = (_req, res) => {
    res.json({
      ok: true,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      env: process.env.NODE_ENV || 'development',
    });
  };
  const readiness = (_req, res) => {
    let dbOk = false;
    let dbError = null;
    try {
      const row = db.prepare('SELECT 1 AS ok').get();
      dbOk = row?.ok === 1;
    } catch (e) {
      dbError = e?.message || 'erro desconhecido';
    }
    const status = dbOk ? 200 : 503;
    res.status(status).json({ ok: dbOk, db: dbOk ? 'ok' : 'fail', dbError });
  };

  app.get('/healthz', liveness);
  app.get('/readyz', readiness);
  app.get('/api/health', liveness);
  app.get('/api/ready', readiness);
}
