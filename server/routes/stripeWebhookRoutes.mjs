import express from 'express';
import { db, nowIso, id } from '../db.mjs';
import {
  stripe,
  isStripeEnabled,
  stripeWebhookSecret,
  recordStripeEvent,
  markStripeEventProcessed,
  grantPlanCreditsOnInvoice,
} from '../stripe.mjs';

// ── Webhook do Stripe ────────────────────────────────────────────────────────
// Registrado fora do asyncRoute padrão porque precisa do body cru para verificar
// a assinatura. O nginx em produção já tem proxy_request_buffering off nesta rota.
//
// Eventos tratados:
//   checkout.session.completed       → assina/atualiza users.plan_id
//   invoice.paid                     → credita os monthly_credits (Stripe Invoice)
//   invoice.payment_failed           → marca subscriptions.status = past_due
//   customer.subscription.updated    → sincroniza status / cancel_at_period_end
//   customer.subscription.deleted    → volta para o plano free

export default function registerStripeWebhookRoutes(app) {
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!isStripeEnabled() || !stripeWebhookSecret) {
      return res.status(503).json({ error: 'Stripe webhook não configurado.' });
    }

    let event;
    try {
      const signature = req.get('stripe-signature') || '';
      event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
    } catch (err) {
      console.error('[stripe] assinatura inválida:', err?.message);
      return res.status(400).json({ error: 'Assinatura inválida.' });
    }

    const { existed, alreadyProcessed } = recordStripeEvent(event);
    if (existed && alreadyProcessed) {
      return res.json({ ok: true, idempotent: true });
    }

    try {
      await handleStripeEvent(event);
      markStripeEventProcessed(event.id);
      return res.json({ ok: true });
    } catch (err) {
      console.error(`[stripe] erro processando ${event.type}:`, err?.message);
      markStripeEventProcessed(event.id, err);
      // 500 faz o Stripe tentar de novo (retry exponencial).
      return res.status(500).json({ error: 'Falha ao processar evento.' });
    }
  });
}

const findUserByCustomer = (customerId) => {
  if (!customerId) return null;
  return db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(customerId);
};

const findPlanByPrice = (priceId) => {
  if (!priceId) return null;
  return db.prepare('SELECT * FROM plans WHERE stripe_price_id = ?').get(priceId);
};

async function handleStripeEvent(event) {
  const data = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      // Marca o início da assinatura. invoice.paid (logo em seguida) credita os créditos.
      const userId = data.metadata?.user_id;
      const planId = data.metadata?.plan_id;
      if (!userId || !planId) break;
      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
      if (!plan) break;
      const createdAt = nowIso();
      db.prepare('UPDATE users SET plan_id = ?, updated_at = ? WHERE id = ?').run(planId, createdAt, userId);
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_end, created_at, updated_at, stripe_subscription_id, stripe_price_id, cancel_at_period_end)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id('sub'), userId, planId, 'active', null, createdAt, createdAt,
        data.subscription || null, plan.stripe_price_id || null, 0,
      );
      break;
    }

    case 'invoice.paid': {
      const customerId = data.customer;
      const subscriptionId = data.subscription;
      const user = findUserByCustomer(customerId);
      if (!user) break;
      // O price_id está em lines.data[0].price.id no schema mais recente
      const priceId = data.lines?.data?.[0]?.price?.id;
      const plan = findPlanByPrice(priceId);
      if (!plan) break;
      const amountBrl = (data.amount_paid || 0); // já em centavos
      grantPlanCreditsOnInvoice(user.id, plan, data.id, amountBrl);
      // Garante plano correto e mantém referência do receipt URL
      const receiptUrl = data.hosted_invoice_url || null;
      db.prepare('UPDATE users SET plan_id = ?, updated_at = ? WHERE id = ?').run(plan.id, nowIso(), user.id);
      if (subscriptionId) {
        db.prepare(`UPDATE subscriptions SET status = ?, updated_at = ?, stripe_subscription_id = COALESCE(stripe_subscription_id, ?) WHERE user_id = ? AND (stripe_subscription_id = ? OR stripe_subscription_id IS NULL)`)
          .run('active', nowIso(), subscriptionId, user.id, subscriptionId);
      }
      if (receiptUrl) {
        db.prepare('UPDATE payments SET receipt_url = ? WHERE stripe_invoice_id = ?').run(receiptUrl, data.id);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const user = findUserByCustomer(data.customer);
      if (!user) break;
      db.prepare('UPDATE subscriptions SET status = ?, updated_at = ? WHERE user_id = ? AND status = ?')
        .run('past_due', nowIso(), user.id, 'active');
      break;
    }

    case 'customer.subscription.updated': {
      const user = findUserByCustomer(data.customer);
      if (!user) break;
      const status = String(data.status || 'active');
      const periodEnd = data.current_period_end ? new Date(data.current_period_end * 1000).toISOString() : null;
      const cancelAtEnd = data.cancel_at_period_end ? 1 : 0;
      db.prepare(`UPDATE subscriptions SET status = ?, current_period_end = ?, cancel_at_period_end = ?, updated_at = ? WHERE stripe_subscription_id = ?`)
        .run(status, periodEnd, cancelAtEnd, nowIso(), data.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const user = findUserByCustomer(data.customer);
      if (!user) break;
      db.prepare(`UPDATE subscriptions SET status = ?, updated_at = ? WHERE stripe_subscription_id = ?`)
        .run('canceled', nowIso(), data.id);
      db.prepare('UPDATE users SET plan_id = ?, updated_at = ? WHERE id = ?').run('free', nowIso(), user.id);
      break;
    }

    default:
      // Eventos não tratados são apenas armazenados em stripe_events para auditoria.
      break;
  }
}
