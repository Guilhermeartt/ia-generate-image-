import { db, nowIso, id } from '../db.mjs';
import { requireAuth } from '../auth.mjs';

export default function registerProjectRoutes(app, { asyncRoute }) {
  app.get('/api/projects', requireAuth, (req, res) => {
    const rows = db.prepare(`
      SELECT id, name, file_name, created_at, updated_at
      FROM projects
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all(req.user.id);
    res.json({ projects: rows });
  });

  app.post('/api/projects', requireAuth, asyncRoute(async (req) => {
    const name = String(req.body.name || req.body.fileName || 'Projeto sem nome').trim();
    const fileName = String(req.body.fileName || '').trim() || null;
    const data = req.body.data || {};
    const createdAt = nowIso();
    const projectId = id('project');
    const plan = db.prepare('SELECT max_projects FROM plans WHERE id = ?').get(req.user.plan_id);
    const projectCount = Number(db.prepare('SELECT COUNT(*) AS count FROM projects WHERE user_id = ?').get(req.user.id)?.count || 0);
    if (plan && projectCount >= Number(plan.max_projects)) {
      throw new Error('Limite de projetos do seu plano atingido. Faça upgrade para salvar mais projetos.');
    }

    db.prepare(`
      INSERT INTO projects (id, user_id, name, file_name, data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, req.user.id, name, fileName, JSON.stringify(data), createdAt, createdAt);

    return { project: { id: projectId, name, file_name: fileName, data, created_at: createdAt, updated_at: createdAt } };
  }));

  app.get('/api/projects/:id', requireAuth, (req, res) => {
    const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Projeto não encontrado.' });
    res.json({ project: { ...row, data: JSON.parse(row.data_json) } });
  });

  app.put('/api/projects/:id', requireAuth, asyncRoute(async (req) => {
    const row = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) throw new Error('Projeto não encontrado.');

    const name = String(req.body.name || 'Projeto sem nome').trim();
    const fileName = String(req.body.fileName || '').trim() || null;
    const data = req.body.data || {};
    const updatedAt = nowIso();

    db.prepare(`
      UPDATE projects SET name = ?, file_name = ?, data_json = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(name, fileName, JSON.stringify(data), updatedAt, req.params.id, req.user.id);

    return { project: { id: req.params.id, name, file_name: fileName, data, updated_at: updatedAt } };
  }));

  app.delete('/api/projects/:id', requireAuth, asyncRoute(async (req) => {
    db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    return { ok: true };
  }));
}
