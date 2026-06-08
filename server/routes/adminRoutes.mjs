import { db } from '../db.mjs';
import { requireAuth, requireAdmin, publicUser } from '../auth.mjs';

export default function registerAdminRoutes(app, { asyncRoute }) {
  app.get('/api/usage/summary', requireAuth, (req, res) => {
    const rows = db.prepare(`
      SELECT operation, model, billing_mode, COUNT(*) AS calls, SUM(input_tokens) AS input_tokens,
             SUM(output_tokens) AS output_tokens, SUM(cost_brl) AS cost_brl, SUM(credit_cost) AS credit_cost
      FROM usage_logs
      WHERE user_id = ?
      GROUP BY operation, model, billing_mode
      ORDER BY calls DESC
    `).all(req.user.id);
    const recent = db.prepare(`
      SELECT operation, model, billing_mode, input_tokens, output_tokens, cost_brl, credit_cost, created_at
      FROM usage_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 25
    `).all(req.user.id);
    const credits = db.prepare(`
      SELECT type, amount, balance_after, description, created_at
      FROM credit_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 25
    `).all(req.user.id);
    res.json({ rows, recent, credits, user: publicUser(req.user) });
  });

  app.get('/api/admin/summary', requireAdmin, (req, res) => {
    const totals = {
      users: Number(db.prepare('SELECT COUNT(*) AS count FROM users').get()?.count || 0),
      projects: Number(db.prepare('SELECT COUNT(*) AS count FROM projects').get()?.count || 0),
      usageCalls: Number(db.prepare('SELECT COUNT(*) AS count FROM usage_logs').get()?.count || 0),
      costBrl: Number(db.prepare('SELECT COALESCE(SUM(cost_brl), 0) AS total FROM usage_logs').get()?.total || 0),
      creditsUsed: Number(db.prepare('SELECT COALESCE(SUM(credit_cost), 0) AS total FROM usage_logs').get()?.total || 0),
    };

    const usersByPlan = db.prepare(`
      SELECT plan_id AS planId, COUNT(*) AS users
      FROM users
      GROUP BY plan_id
      ORDER BY users DESC
    `).all();

    const topUsers = db.prepare(`
      SELECT u.id, u.name, u.email, u.plan_id AS planId,
             COUNT(l.id) AS calls,
             COALESCE(SUM(l.cost_brl), 0) AS costBrl,
             COALESCE(SUM(l.credit_cost), 0) AS creditsUsed,
             (SELECT COALESCE(SUM(amount), 0) FROM credit_transactions WHERE user_id = u.id) AS creditBalance,
             MAX(l.created_at) AS lastUsageAt
      FROM users u
      LEFT JOIN usage_logs l ON l.user_id = u.id
      GROUP BY u.id
      ORDER BY costBrl DESC, calls DESC
      LIMIT 20
    `).all();

    const recentUsage = db.prepare(`
      SELECT l.operation, l.model, l.billing_mode AS billingMode, l.cost_brl AS costBrl,
             l.credit_cost AS creditCost, l.created_at AS createdAt, u.email
      FROM usage_logs l
      LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC
      LIMIT 30
    `).all();

    res.json({ totals, usersByPlan, topUsers, recentUsage });
  });
}
