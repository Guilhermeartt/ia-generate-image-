import { db, nowIso, id } from '../db.mjs';
import { requireAuth } from '../auth.mjs';
import { validate, schemas } from '../validation.mjs';

// Biblioteca global de modelos de cena (SVG + slots). Escopo por usuário: um
// modelo é reutilizável em qualquer projeto. O markup já chega sanitizado pelo
// editor no cliente; aqui validamos tamanho/formato e re-sanitizamos no client
// ao carregar (defesa em profundidade).
export default function registerTemplateRoutes(app, { asyncRoute }) {
  app.get('/api/templates', requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT id, name, view_w, view_h, created_at, updated_at
         FROM svg_templates
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(req.user.id);
    res.json({ templates: rows });
  });

  app.post('/api/templates', requireAuth, asyncRoute(async (req) => {
    const { name, markup, viewW, viewH } = validate(schemas.svgTemplate, req.body);
    const createdAt = nowIso();
    const templateId = id('tmpl');

    db.prepare(
      `INSERT INTO svg_templates (id, user_id, name, markup, view_w, view_h, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(templateId, req.user.id, name, markup, viewW ?? null, viewH ?? null, createdAt, createdAt);

    return {
      template: { id: templateId, name, view_w: viewW ?? null, view_h: viewH ?? null, created_at: createdAt, updated_at: createdAt },
    };
  }));

  app.get('/api/templates/:id', requireAuth, (req, res) => {
    const row = db
      .prepare('SELECT * FROM svg_templates WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Modelo não encontrado.' });
    res.json({ template: row });
  });

  app.put('/api/templates/:id', requireAuth, asyncRoute(async (req) => {
    const row = db
      .prepare('SELECT id FROM svg_templates WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!row) throw Object.assign(new Error('Modelo não encontrado.'), { status: 404 });

    const { name, markup, viewW, viewH } = validate(schemas.svgTemplate, req.body);
    const updatedAt = nowIso();

    db.prepare(
      `UPDATE svg_templates SET name = ?, markup = ?, view_w = ?, view_h = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(name, markup, viewW ?? null, viewH ?? null, updatedAt, req.params.id, req.user.id);

    return { template: { id: req.params.id, name, view_w: viewW ?? null, view_h: viewH ?? null, updated_at: updatedAt } };
  }));

  app.delete('/api/templates/:id', requireAuth, asyncRoute(async (req) => {
    db.prepare('DELETE FROM svg_templates WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    return { ok: true };
  }));
}
