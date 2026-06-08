import { GoogleGenAI } from '@google/genai';
import { db, nowIso, id } from '../db.mjs';
import {
  requireAuth,
  requireVerifiedEmail,
  getUserById,
  getUserPlan,
  publicUser,
  encryptText,
} from '../auth.mjs';

export default function registerAccountRoutes(app, { asyncRoute }) {
  app.patch('/api/account/billing-mode', requireAuth, asyncRoute(async (req) => {
    const mode = String(req.body.mode || '');
    if (!['platform', 'user_key'].includes(mode)) {
      throw new Error('Modo de uso inválido.');
    }
    if (mode === 'user_key') {
      const plan = getUserPlan(req.user);
      if (plan && !Number(plan.allow_user_api_key)) {
        throw new Error('Seu plano atual não permite usar API Key própria.');
      }
      const apiKeyRow = db.prepare('SELECT id FROM user_api_keys WHERE user_id = ? AND provider = ? AND status = ?')
        .get(req.user.id, 'gemini', 'active');
      if (!apiKeyRow) {
        throw new Error('Salve uma API Key Gemini criptografada antes de ativar este modo.');
      }
    }
    db.prepare('UPDATE users SET ai_billing_mode = ?, updated_at = ? WHERE id = ?').run(mode, nowIso(), req.user.id);
    return { user: publicUser(getUserById(req.user.id)) };
  }));

  app.get('/api/account/api-key/status', requireAuth, (req, res) => {
    const row = db.prepare('SELECT status, last_validated_at, created_at, updated_at FROM user_api_keys WHERE user_id = ? AND provider = ?')
      .get(req.user.id, 'gemini');
    res.json({
      hasGeminiApiKey: Boolean(row),
      status: row?.status || null,
      lastValidatedAt: row?.last_validated_at || null,
    });
  });

  app.post('/api/account/api-key', requireAuth, asyncRoute(async (req) => {
    const apiKey = String(req.body.apiKey || '').trim();
    if (!apiKey.startsWith('AIza') || apiKey.length < 20) {
      throw new Error('A chave Gemini parece inválida.');
    }

    // Validate the key by making a lightweight models.list call before saving.
    try {
      const client = new GoogleGenAI({ apiKey });
      await client.models.list();
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes('API_KEY_INVALID') || msg.includes('401') || msg.includes('403')) {
        throw new Error('A chave Gemini é inválida ou não tem permissão para esta API. Verifique o valor e tente novamente.');
      }
      // Other errors (network, quota) are non-fatal — save the key anyway.
    }

    const createdAt = nowIso();
    db.prepare(`
      INSERT INTO user_api_keys (id, user_id, provider, encrypted_api_key, status, last_validated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        encrypted_api_key = excluded.encrypted_api_key,
        status = excluded.status,
        last_validated_at = excluded.last_validated_at,
        updated_at = excluded.updated_at
    `).run(
      id('key'),
      req.user.id,
      'gemini',
      encryptText(apiKey),
      'active',
      createdAt,
      createdAt,
      createdAt,
    );

    return { user: publicUser(getUserById(req.user.id)) };
  }));

  app.delete('/api/account/api-key/gemini', requireAuth, asyncRoute(async (req) => {
    db.prepare('DELETE FROM user_api_keys WHERE user_id = ? AND provider = ?').run(req.user.id, 'gemini');
    if (req.user.ai_billing_mode === 'user_key') {
      db.prepare('UPDATE users SET ai_billing_mode = ?, updated_at = ? WHERE id = ?').run('platform', nowIso(), req.user.id);
    }
    return { user: publicUser(getUserById(req.user.id)) };
  }));

  // ── Plans ─────────────────────────────────────────────────────────────────
  app.get('/api/plans', (req, res) => {
    const plans = db.prepare(`
      SELECT id, name, monthly_credits, max_projects, max_scenes_per_script, allow_user_api_key, price_brl
      FROM plans
      ORDER BY price_brl ASC
    `).all().map((plan) => ({
      id: plan.id,
      name: plan.name,
      monthlyCredits: plan.monthly_credits,
      maxProjects: plan.max_projects,
      maxScenesPerScript: plan.max_scenes_per_script,
      allowUserApiKey: Boolean(plan.allow_user_api_key),
      priceBrl: plan.price_brl,
    }));
    res.json({ plans });
  });

  // ── Billing ───────────────────────────────────────────────────────────────
  app.post('/api/billing/mock-upgrade', requireVerifiedEmail, asyncRoute(async (req) => {
    const planId = String(req.body.planId || '');
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) throw new Error('Plano não encontrado.');

    const createdAt = nowIso();
    db.prepare('UPDATE users SET plan_id = ?, updated_at = ? WHERE id = ?').run(plan.id, createdAt, req.user.id);
    db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_end, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id('sub'), req.user.id, plan.id, 'active', null, createdAt, createdAt);
    db.prepare(`
      INSERT INTO payments (id, user_id, provider, provider_payment_id, amount_brl, status, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id('pay'), req.user.id, 'mock', null, plan.price_brl, 'paid', JSON.stringify({ planId: plan.id }), createdAt);

    const current = Number(db.prepare('SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?').get(req.user.id)?.balance || 0);
    const nextBalance = current + Number(plan.monthly_credits);
    db.prepare(`
      INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id('credit'), req.user.id, 'grant', plan.monthly_credits, nextBalance, `Créditos do plano ${plan.name}`, createdAt);

    return { user: publicUser(getUserById(req.user.id)) };
  }));

  app.post('/api/billing/checkout', requireVerifiedEmail, asyncRoute(async (req) => {
    const planId = String(req.body.planId || '');
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) throw new Error('Plano não encontrado.');

    const createdAt = nowIso();
    db.prepare(`
      INSERT INTO payments (id, user_id, provider, provider_payment_id, amount_brl, status, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id('pay'), req.user.id, 'stripe_placeholder', null, plan.price_brl, 'pending', JSON.stringify({ planId: plan.id }), createdAt);

    return {
      checkoutUrl: null,
      message: 'Checkout Stripe ainda não está configurado. Use o upgrade de teste no ambiente local.',
    };
  }));
}
