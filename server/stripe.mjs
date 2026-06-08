import Stripe from 'stripe';
import { db, nowIso, id, transaction } from './db.mjs';

// ── Cliente Stripe ───────────────────────────────────────────────────────────
// Inicializa apenas se STRIPE_SECRET_KEY estiver presente. Quando ausente,
// isStripeEnabled() retorna false e as rotas voltam ao mock-upgrade local.
let _stripe = null;

const secretKey = process.env.STRIPE_SECRET_KEY;
if (secretKey) {
  _stripe = new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia',
    typescript: false,
    maxNetworkRetries: 2,
  });
}

export const stripe = _stripe;
export const isStripeEnabled = () => Boolean(_stripe);
export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// ── Customer helpers ────────────────────────────────────────────────────────
export const ensureStripeCustomer = async (user) => {
  if (!isStripeEnabled()) throw new Error('Stripe não configurado.');
  if (user.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { user_id: user.id },
  });
  db.prepare('UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?')
    .run(customer.id, nowIso(), user.id);
  return customer.id;
};

// ── Checkout (assinatura) ───────────────────────────────────────────────────
export const createSubscriptionCheckout = async ({ user, plan, successUrl, cancelUrl }) => {
  if (!isStripeEnabled()) throw new Error('Stripe não configurado.');
  if (!plan.stripe_price_id) {
    throw new Error(`Plano "${plan.id}" sem stripe_price_id. Configure-o no banco antes de oferecer este plano.`);
  }
  const customerId = await ensureStripeCustomer(user);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata: { user_id: user.id, plan_id: plan.id },
    subscription_data: {
      metadata: { user_id: user.id, plan_id: plan.id },
    },
    // Brazil: aceita cartão; PIX requer ativação manual no dashboard Stripe.
    payment_method_types: ['card'],
  });
  return session;
};

// ── Customer Portal ─────────────────────────────────────────────────────────
export const createBillingPortal = async ({ user, returnUrl }) => {
  if (!isStripeEnabled()) throw new Error('Stripe não configurado.');
  const customerId = await ensureStripeCustomer(user);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
};

// ── Idempotência do webhook ─────────────────────────────────────────────────
// Cada evento do Stripe entra em stripe_events; se já existir e tiver processed_at
// definido, devolvemos 200 sem reprocessar — Stripe pode reenviar o mesmo event.
export const recordStripeEvent = (event) => {
  const existing = db.prepare('SELECT id, processed_at FROM stripe_events WHERE id = ?').get(event.id);
  if (existing) return { existed: true, alreadyProcessed: Boolean(existing.processed_at) };
  db.prepare('INSERT INTO stripe_events (id, type, payload_json, received_at) VALUES (?, ?, ?, ?)')
    .run(event.id, event.type, JSON.stringify(event), nowIso());
  return { existed: false, alreadyProcessed: false };
};

export const markStripeEventProcessed = (eventId, error = null) => {
  db.prepare('UPDATE stripe_events SET processed_at = ?, error = ? WHERE id = ?')
    .run(nowIso(), error ? String(error).slice(0, 1000) : null, eventId);
};

// ── Grant de créditos via webhook ───────────────────────────────────────────
// Cobre a transição: invoice.paid → o usuário recebe os créditos mensais do plano.
// Idempotência adicional por invoice: se já creditamos por essa invoice, não duplica.
export const grantPlanCreditsOnInvoice = (userId, plan, invoiceId, amountBrl) => {
  // Crédito + registro de pagamento numa única transação: a idempotência por
  // invoice e a concessão de créditos não podem ficar desincronizadas.
  transaction(() => {
    const alreadyGranted = db.prepare(`
      SELECT 1 FROM payments WHERE user_id = ? AND stripe_invoice_id = ?
    `).get(userId, invoiceId);
    if (alreadyGranted) return;

    const createdAt = nowIso();
    const balanceRow = db.prepare('SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?').get(userId);
    const currentBalance = Number(balanceRow?.balance || 0);
    const nextBalance = currentBalance + Number(plan.monthly_credits);

    db.prepare(`
      INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id('credit'), userId, 'grant', plan.monthly_credits, nextBalance, `Créditos mensais do plano ${plan.name}`, createdAt);

    db.prepare(`
      INSERT INTO payments (id, user_id, provider, provider_payment_id, amount_brl, status, metadata_json, created_at, stripe_invoice_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id('pay'), userId, 'stripe', null, Math.round(amountBrl), 'paid', JSON.stringify({ planId: plan.id, invoiceId }), createdAt, invoiceId);
  });
};
