import { z } from 'zod';

// ── Validação de entrada com Zod ──────────────────────────────────────────────
// Centraliza os schemas das rotas críticas (auth, billing). Em caso de entrada
// inválida, lança um erro com status 400 e a primeira mensagem amigável.

/**
 * Valida `data` contra `schema`. Em falha, lança Error com status 400.
 * @template T
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} data
 * @returns {T}
 */
export const validate = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.join('.') || 'campo';
    const message = first?.message || 'Entrada inválida.';
    throw Object.assign(new Error(`${path}: ${message}`), { status: 400 });
  }
  return result.data;
};

// ── Schemas reutilizáveis ─────────────────────────────────────────────────────
const email = z.string().trim().toLowerCase().email('e-mail inválido').max(254);
const password = z.string().min(8, 'use ao menos 8 caracteres').max(200);
const name = z.string().trim().min(1, 'obrigatório').max(120);
const planId = z.string().trim().min(1).max(64);

export const schemas = {
  register: z.object({ name, email, password }),
  login: z.object({ email, password: z.string().min(1, 'obrigatória').max(200) }),
  forgotPassword: z.object({ email }),
  resetPassword: z.object({
    resetToken: z.string().trim().min(1, 'obrigatório').max(512),
    password,
  }),
  verifyEmail: z.object({ token: z.string().trim().min(1, 'obrigatório').max(512) }),

  billingPlan: z.object({ planId }),

  adminCredits: z.object({
    amount: z.coerce.number().int('use número inteiro').refine((n) => n !== 0, 'não pode ser zero'),
    description: z.string().trim().max(200).optional(),
  }),
  adminPlan: z.object({ planId }),
};
