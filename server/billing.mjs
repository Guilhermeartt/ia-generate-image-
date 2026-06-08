import { db, nowIso, id, transaction } from './db.mjs';
import { getUserPlan, getCreditBalance, decryptText } from './auth.mjs';

// ── Pricing constants ─────────────────────────────────────────────────────────
export const MODEL_PRICE_PER_TOKEN = {
  'gemini-2.5-flash-image': 0.060 / 1000,
  'gemini-3.1-flash-image-preview': 0.060 / 1000,
  'gemini-3-pro-image-preview': 0.030 / 1000,
};

export const TEXT_MODEL_PRICING = {
  'gemini-2.5-pro': { input: 1.25 / 1_000_000, output: 10.00 / 1_000_000 },
  'gemini-2.5-flash': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
};

export const USD_TO_BRL = Number(process.env.USD_TO_BRL || 5.80);
export const IMAGEN_COST_USD = 0.040;

// ── Cost calculation helpers ──────────────────────────────────────────────────
export const calcImageCost = (model, tokens) => {
  const pricePerToken = MODEL_PRICE_PER_TOKEN[model] ?? (0.060 / 1000);
  return { tokens, costBRL: Number((tokens * pricePerToken * USD_TO_BRL).toFixed(4)) };
};

export const calcTextCost = (model, inputTokens, outputTokens) => {
  const pricing = TEXT_MODEL_PRICING[model] ?? TEXT_MODEL_PRICING['gemini-2.5-flash'];
  return Number(((inputTokens * pricing.input + outputTokens * pricing.output) * USD_TO_BRL).toFixed(5));
};

export const textCostEntry = (operation, model, response) => {
  const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    operation,
    model,
    inputTokens,
    outputTokens,
    costBRL: calcTextCost(model, inputTokens, outputTokens),
  };
};

export const imageCostEntry = (operation, model, result) => ({
  operation,
  model,
  inputTokens: 0,
  outputTokens: Number(result?.tokens || 0),
  costBRL: Number(result?.costBRL || 0),
});

export const creditCostFor = (costEntry, billingMode) => {
  if (!billingMode.startsWith('platform')) return 0;
  const costBrl = Number(costEntry?.costBRL || 0);
  return Math.max(1, Math.ceil(costBrl * 100));
};

// ── Platform provider resolution ──────────────────────────────────────────────
// Priority: Vertex Express (API key) → Vertex Service Account → AI Studio API key.
export const getPlatformProvider = () => {
  const vertexApiKey = process.env.VERTEX_API_KEY;
  if (vertexApiKey) {
    return { kind: 'vertex_express', apiKey: vertexApiKey };
  }
  const hasVertexCreds = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const vertexProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_AI_PROJECT;
  const vertexLocation = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_AI_LOCATION || 'us-central1';
  if (hasVertexCreds && vertexProject) {
    return { kind: 'vertex', project: vertexProject, location: vertexLocation };
  }
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (apiKey) return { kind: 'api_key', apiKey };
  return null;
};

export const hasPlatformProvider = () => Boolean(getPlatformProvider());

// ── Billing context ───────────────────────────────────────────────────────────
export const getBillingContext = (req) => {
  if (req.billingContext) return req.billingContext;

  const explicitUserKey = req.get('x-gemini-api-key')?.trim();
  if (explicitUserKey) {
    req.billingContext = { apiKey: explicitUserKey, billingMode: 'user_key_ephemeral' };
    return req.billingContext;
  }

  if (req.user?.ai_billing_mode === 'user_key') {
    const plan = getUserPlan(req.user);
    if (plan && !Number(plan.allow_user_api_key)) {
      throw new Error('Seu plano atual não permite usar API Key própria.');
    }
    const apiKeyRow = db.prepare('SELECT encrypted_api_key FROM user_api_keys WHERE user_id = ? AND provider = ? AND status = ?')
      .get(req.user.id, 'gemini', 'active');
    if (!apiKeyRow) {
      throw new Error('Sua conta está configurada para usar API Key própria, mas nenhuma key Gemini ativa foi encontrada.');
    }
    req.billingContext = { apiKey: decryptText(apiKeyRow.encrypted_api_key), billingMode: 'user_key' };
    return req.billingContext;
  }

  const platform = getPlatformProvider();
  if (platform) {
    if (!req.user) {
      throw new Error('Faça login para usar a API da plataforma, ou configure sua própria API Key Gemini.');
    }
    // Checagem de saldo + reserva numa única transação: evita que requisições
    // concorrentes leiam o mesmo saldo e reservem além do disponível.
    transaction(() => {
      const balance = getCreditBalance(req.user.id);
      if (balance <= 0) {
        throw new Error('Seus créditos acabaram. Use sua própria API Key ou faça upgrade do plano.');
      }
      db.prepare(`
        INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id('credit'), req.user.id, 'reserve', -1, balance - 1, 'Reserva pré-geração', nowIso());
    });
    if (platform.kind === 'vertex') {
      req.billingContext = {
        vertex: { project: platform.project, location: platform.location },
        billingMode: 'platform',
        reservedCredit: 1,
      };
    } else if (platform.kind === 'vertex_express') {
      req.billingContext = {
        vertex: { apiKey: platform.apiKey },
        billingMode: 'platform',
        reservedCredit: 1,
      };
    } else {
      req.billingContext = { apiKey: platform.apiKey, billingMode: 'platform', reservedCredit: 1 };
    }
    return req.billingContext;
  }

  throw new Error('Nenhuma API Key configurada no servidor ou enviada pelo usuário.');
};

// ── Usage recording ───────────────────────────────────────────────────────────
// Toda a gravação (log de uso + débito/estorno de crédito) acontece numa única
// transação atômica: se qualquer passo falhar, nada é persistido — evita o estado
// inconsistente de "cobrou crédito mas não logou" (ou vice-versa).
export const recordUsage = (req, costEntry) => {
  if (!costEntry) return;
  const ctx = req.billingContext; // already resolved — don't call getBillingContext again (would re-reserve)
  if (!ctx) return;
  const billingMode = ctx.billingMode;
  const creditCost = creditCostFor(costEntry, billingMode);
  const createdAt = nowIso();

  transaction(() => {
  db.prepare(`
    INSERT INTO usage_logs (
      id, user_id, project_id, operation, provider, model, billing_mode,
      input_tokens, output_tokens, cost_brl, credit_cost, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id('usage'),
    req.user?.id || null,
    req.get('x-project-id') || null,
    costEntry.operation,
    'gemini',
    costEntry.model,
    billingMode,
    Number(costEntry.inputTokens || 0),
    Number(costEntry.outputTokens || 0),
    Number(costEntry.costBRL || 0),
    creditCost,
    createdAt,
  );

  if (req.user && creditCost > 0) {
    // If we pre-reserved 1 credit, the actual debit is (creditCost - reserved).
    const reserved = Number(ctx.reservedCredit || 0);
    const additionalCost = creditCost - reserved;
    if (additionalCost !== 0) {
      const current = Number(db.prepare('SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?').get(req.user.id)?.balance || 0);
      const nextBalance = current - additionalCost;
      db.prepare(`
        INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id('credit'),
        req.user.id,
        'usage',
        -additionalCost,
        nextBalance,
        `${costEntry.operation} (${costEntry.model})`,
        createdAt,
      );
    }
    // If creditCost < reserved, refund the difference.
    if (creditCost < reserved) {
      const refund = reserved - creditCost;
      const current = Number(db.prepare('SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?').get(req.user.id)?.balance || 0);
      db.prepare(`
        INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id('credit'), req.user.id, 'refund', refund, current + refund, 'Estorno reserva excedente', createdAt);
    }
  } else if (req.user && creditCost === 0 && ctx.reservedCredit) {
    // Operation had no credit cost — refund the full reservation.
    const current = Number(db.prepare('SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = ?').get(req.user.id)?.balance || 0);
    db.prepare(`
      INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id('credit'), req.user.id, 'refund', ctx.reservedCredit, current + ctx.reservedCredit, 'Estorno reserva (custo zero)', createdAt);
  }
  });
};
