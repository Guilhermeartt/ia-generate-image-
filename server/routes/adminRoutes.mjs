import { db, nowIso, id } from '../db.mjs';
import { requireAuth, requireAdmin, publicUser, getUserById } from '../auth.mjs';
import { validate, schemas } from '../validation.mjs';

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

  // ── Lista paginada de usuários ───────────────────────────────────────────
  app.get('/api/admin/users', requireAdmin, (req, res) => {
    const search = String(req.query.search || '').trim().toLowerCase();
    const planFilter = String(req.query.plan || '').trim();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const conditions = ['1=1'];
    const params = [];
    if (search) {
      conditions.push('(LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (planFilter) {
      conditions.push('u.plan_id = ?');
      params.push(planFilter);
    }
    const where = conditions.join(' AND ');

    const countRow = db.prepare(`SELECT COUNT(*) AS c FROM users u WHERE ${where}`).get(...params);
    const total = Number(countRow?.c || 0);

    const rows = db.prepare(`
      SELECT
        u.id, u.name, u.email, u.plan_id AS planId, u.ai_billing_mode AS aiBillingMode,
        u.email_verified_at AS emailVerifiedAt, u.created_at AS createdAt,
        u.stripe_customer_id AS stripeCustomerId,
        (SELECT COALESCE(SUM(amount), 0) FROM credit_transactions WHERE user_id = u.id) AS creditBalance,
        (SELECT COUNT(*) FROM projects WHERE user_id = u.id) AS projectCount,
        (SELECT MAX(created_at) FROM usage_logs WHERE user_id = u.id) AS lastUsageAt
      FROM users u
      WHERE ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({ users: rows, total, limit, offset });
  });

  // ── Detalhe de um usuário ───────────────────────────────────────────────
  app.get('/api/admin/users/:id', requireAdmin, (req, res) => {
    const user = getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const usageByOperation = db.prepare(`
      SELECT operation, model, COUNT(*) AS calls, SUM(cost_brl) AS costBrl, SUM(credit_cost) AS creditCost
      FROM usage_logs WHERE user_id = ?
      GROUP BY operation, model
      ORDER BY calls DESC LIMIT 20
    `).all(user.id);
    const recentUsage = db.prepare(`
      SELECT operation, model, cost_brl AS costBrl, credit_cost AS creditCost, created_at AS createdAt
      FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
    `).all(user.id);
    const creditHistory = db.prepare(`
      SELECT type, amount, balance_after AS balanceAfter, description, created_at AS createdAt
      FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
    `).all(user.id);
    const payments = db.prepare(`
      SELECT id, provider, amount_brl AS amountBrl, status, receipt_url AS receiptUrl, created_at AS createdAt, stripe_invoice_id AS stripeInvoiceId
      FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
    `).all(user.id);
    const subscriptions = db.prepare(`
      SELECT id, plan_id AS planId, status, current_period_end AS currentPeriodEnd,
             cancel_at_period_end AS cancelAtPeriodEnd, stripe_subscription_id AS stripeSubscriptionId,
             created_at AS createdAt, updated_at AS updatedAt
      FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC
    `).all(user.id);
    res.json({
      user: publicUser(user),
      usageByOperation,
      recentUsage,
      creditHistory,
      payments,
      subscriptions,
    });
  });

  // ── Conceder ou debitar créditos manualmente ────────────────────────────
  app.post('/api/admin/users/:id/credits', requireAdmin, (req, res) => {
    let amount, description;
    try {
      ({ amount, description } = validate(schemas.adminCredits, req.body));
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    description = description || 'Ajuste manual do admin';
    const target = getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const createdAt = nowIso();
    const currentBalance = Number(db.prepare('SELECT COALESCE(SUM(amount), 0) AS b FROM credit_transactions WHERE user_id = ?').get(target.id)?.b || 0);
    const nextBalance = currentBalance + amount;
    db.prepare(`
      INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id('credit'),
      target.id,
      amount > 0 ? 'grant' : 'adjust',
      amount,
      nextBalance,
      `[admin:${req.user.email}] ${description}`,
      createdAt,
    );
    res.json({ ok: true, newBalance: nextBalance });
  });

  // ── Mudar plano manualmente ─────────────────────────────────────────────
  app.post('/api/admin/users/:id/plan', requireAdmin, (req, res) => {
    let planId;
    try {
      ({ planId } = validate(schemas.adminPlan, req.body));
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });
    const target = getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });

    db.prepare('UPDATE users SET plan_id = ?, updated_at = ? WHERE id = ?').run(plan.id, nowIso(), target.id);
    res.json({ ok: true, user: publicUser(getUserById(target.id)) });
  });

  // ── Lista de pagamentos ──────────────────────────────────────────────────
  app.get('/api/admin/payments', requireAdmin, (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const totalRow = db.prepare('SELECT COUNT(*) AS c FROM payments').get();
    const rows = db.prepare(`
      SELECT
        p.id, p.user_id AS userId, p.provider, p.provider_payment_id AS providerPaymentId,
        p.amount_brl AS amountBrl, p.status, p.metadata_json AS metadataJson,
        p.created_at AS createdAt, p.receipt_url AS receiptUrl,
        p.stripe_invoice_id AS stripeInvoiceId,
        u.email AS userEmail
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    res.json({ payments: rows, total: Number(totalRow?.c || 0), limit, offset });
  });

  // ── Eventos do webhook do Stripe ─────────────────────────────────────────
  app.get('/api/admin/stripe-events', requireAdmin, (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const onlyFailed = String(req.query.failed || '') === '1';
    const where = onlyFailed ? 'error IS NOT NULL' : '1=1';
    const rows = db.prepare(`
      SELECT id, type, received_at AS receivedAt, processed_at AS processedAt, error
      FROM stripe_events
      WHERE ${where}
      ORDER BY received_at DESC
      LIMIT ?
    `).all(limit);
    res.json({ events: rows });
  });
}
