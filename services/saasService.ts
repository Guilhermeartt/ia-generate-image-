import type { ProjectState } from '../types';
import { apiFetch as csrfFetch, apiFetchJson } from './httpClient';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  aiBillingMode: 'platform' | 'user_key';
  planId: string;
  creditBalance: number;
  hasGeminiApiKey: boolean;
  geminiApiKeyStatus: string | null;
  geminiApiKeyLastValidatedAt: string | null;
  isAdmin?: boolean;
  plan?: Plan | null;
  createdAt: string;
}

export interface Plan {
  id: string;
  name: string;
  monthlyCredits: number;
  maxProjects: number;
  maxScenesPerScript: number;
  allowUserApiKey: boolean;
  priceBrl: number;
}

export interface CloudProjectListItem {
  id: string;
  name: string;
  file_name: string | null;
  created_at: string;
  updated_at: string;
}

export const AUTH_TOKEN_STORAGE_KEY = 'saas-auth-token';

// Kept for backward compatibility with existing sessions and API-client usage.
// New sessions receive auth via httpOnly cookie set by the server, which is
// automatically included in same-origin requests and is not accessible via JS.
export const getAuthToken = (): string => {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

export const setAuthToken = (token: string): void => {
  try {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {}
};

export const clearAuthToken = async (): Promise<void> => {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {}
  // Tell the server to clear the httpOnly cookie.
  try {
    await csrfFetch('/api/auth/logout', { method: 'POST' });
  } catch {}
};

const apiFetch = <T>(url: string, options: RequestInit = {}): Promise<T> =>
  apiFetchJson<T>(url, { ...options, authToken: getAuthToken() || undefined });

export const registerAccount = async (
  name: string,
  email: string,
  password: string
): Promise<CurrentUser & { devVerificationToken?: string }> => {
  const payload = await apiFetch<{ user: CurrentUser; token: string; devVerificationToken?: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setAuthToken(payload.token);
  // Anexa o token de dev na própria struct do user para que o UI consiga exibir.
  return { ...payload.user, devVerificationToken: payload.devVerificationToken };
};

export const loginAccount = async (
  email: string,
  password: string
): Promise<CurrentUser> => {
  const payload = await apiFetch<{ user: CurrentUser; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(payload.token);
  return payload.user;
};

export const requestPasswordReset = async (
  email: string
): Promise<{ message: string; resetToken?: string; expiresAt?: string; devNote?: string }> => {
  return apiFetch('/api/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const verifyEmail = async (token: string): Promise<{ user: CurrentUser; message: string }> => {
  return apiFetch('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
};

export const resendEmailVerification = async (): Promise<{ ok: boolean; message: string; devVerificationToken?: string }> => {
  return apiFetch('/api/auth/resend-verification', { method: 'POST' });
};

export const resetPassword = async (
  resetToken: string,
  password: string
): Promise<CurrentUser> => {
  const payload = await apiFetch<{ user: CurrentUser; token: string; message: string }>('/api/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ resetToken, password }),
  });
  setAuthToken(payload.token);
  return payload.user;
};

export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  if (!getAuthToken()) return null;
  try {
    const payload = await apiFetch<{ user: CurrentUser }>('/api/auth/me');
    return payload.user;
  } catch {
    clearAuthToken();
    return null;
  }
};

export const updateBillingMode = async (mode: 'platform' | 'user_key'): Promise<CurrentUser> => {
  const payload = await apiFetch<{ user: CurrentUser }>('/api/account/billing-mode', {
    method: 'PATCH',
    body: JSON.stringify({ mode }),
  });
  return payload.user;
};

export const saveServerGeminiApiKey = async (apiKey: string): Promise<CurrentUser> => {
  const payload = await apiFetch<{ user: CurrentUser }>('/api/account/api-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
  return payload.user;
};

export const deleteServerGeminiApiKey = async (): Promise<CurrentUser> => {
  const payload = await apiFetch<{ user: CurrentUser }>('/api/account/api-key/gemini', {
    method: 'DELETE',
  });
  return payload.user;
};

export const saveCloudProject = async (
  projectId: string | null,
  data: ProjectState
): Promise<{ id: string; updated_at: string }> => {
  const name = data.fileName?.replace(/\.[^.]+$/, '') || 'Projeto sem nome';
  const endpoint = projectId ? `/api/projects/${projectId}` : '/api/projects';
  const method = projectId ? 'PUT' : 'POST';
  const payload = await apiFetch<{ project: { id: string; updated_at: string } }>(endpoint, {
    method,
    body: JSON.stringify({
      name,
      fileName: data.fileName,
      data,
    }),
  });
  return { id: payload.project.id, updated_at: payload.project.updated_at };
};

export const listCloudProjects = async (): Promise<CloudProjectListItem[]> => {
  const payload = await apiFetch<{ projects: CloudProjectListItem[] }>('/api/projects');
  return payload.projects;
};

export const loadCloudProject = async (projectId: string): Promise<ProjectState> => {
  const payload = await apiFetch<{ project: { data: ProjectState } }>(`/api/projects/${projectId}`);
  return payload.project.data;
};

export const deleteCloudProject = async (projectId: string): Promise<void> => {
  await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE' });
};

export const listPlans = async (): Promise<Plan[]> => {
  const payload = await apiFetch<{ plans: Plan[] }>('/api/plans');
  return payload.plans;
};

export const mockUpgradePlan = async (planId: string): Promise<CurrentUser> => {
  const payload = await apiFetch<{ user: CurrentUser }>('/api/billing/mock-upgrade', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
  return payload.user;
};

export const startCheckout = async (planId: string): Promise<{ checkoutUrl: string | null; message: string }> => {
  return apiFetch('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
};

export interface UsageRow {
  operation: string;
  model: string;
  billing_mode: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_brl: number;
  credit_cost: number;
}

export interface UsageLogEntry {
  operation: string;
  model: string;
  billing_mode: string;
  input_tokens: number;
  output_tokens: number;
  cost_brl: number;
  credit_cost: number;
  created_at: string;
}

export interface CreditTransactionEntry {
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export interface UsageSummary {
  rows: UsageRow[];
  recent: UsageLogEntry[];
  credits: CreditTransactionEntry[];
  user: CurrentUser;
}

export interface AdminTopUser {
  id: string;
  name: string;
  email: string;
  planId: string;
  calls: number;
  costBrl: number;
  creditsUsed: number;
  creditBalance: number;
  lastUsageAt: string | null;
}

export interface AdminRecentUsage {
  operation: string;
  model: string;
  billingMode: string;
  costBrl: number;
  creditCost: number;
  createdAt: string;
  email: string | null;
}

export interface AdminSummary {
  totals: {
    users: number;
    projects: number;
    usageCalls: number;
    costBrl: number;
    creditsUsed: number;
  };
  usersByPlan: Array<{ planId: string; users: number }>;
  topUsers: AdminTopUser[];
  recentUsage: AdminRecentUsage[];
}

export const getUsageSummary = async (): Promise<UsageSummary> => {
  return apiFetch<UsageSummary>('/api/usage/summary');
};

export const getAdminSummary = async (): Promise<AdminSummary> => {
  return apiFetch<AdminSummary>('/api/admin/summary');
};

// ── Admin: gerenciamento de usuários, pagamentos e webhooks ──────────────────

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  planId: string;
  aiBillingMode: 'platform' | 'user_key';
  emailVerifiedAt: string | null;
  createdAt: string;
  stripeCustomerId: string | null;
  creditBalance: number;
  projectCount: number;
  lastUsageAt: string | null;
}

export interface AdminUserList {
  users: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUserDetail {
  user: CurrentUser;
  usageByOperation: Array<{ operation: string; model: string; calls: number; costBrl: number; creditCost: number }>;
  recentUsage: Array<{ operation: string; model: string; costBrl: number; creditCost: number; createdAt: string }>;
  creditHistory: Array<{ type: string; amount: number; balanceAfter: number; description: string | null; createdAt: string }>;
  payments: Array<{ id: string; provider: string; amountBrl: number; status: string; receiptUrl: string | null; createdAt: string; stripeInvoiceId: string | null }>;
  subscriptions: Array<{ id: string; planId: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: number; stripeSubscriptionId: string | null; createdAt: string; updatedAt: string }>;
}

export interface AdminPayment {
  id: string;
  userId: string;
  userEmail: string | null;
  provider: string;
  providerPaymentId: string | null;
  amountBrl: number;
  status: string;
  metadataJson: string | null;
  createdAt: string;
  receiptUrl: string | null;
  stripeInvoiceId: string | null;
}

export interface StripeEventRow {
  id: string;
  type: string;
  receivedAt: string;
  processedAt: string | null;
  error: string | null;
}

export const listAdminUsers = async (params: { search?: string; plan?: string; limit?: number; offset?: number } = {}): Promise<AdminUserList> => {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.plan) qs.set('plan', params.plan);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<AdminUserList>(`/api/admin/users${query}`);
};

export const getAdminUserDetail = async (userId: string): Promise<AdminUserDetail> => {
  return apiFetch<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(userId)}`);
};

export const adminGrantCredits = async (userId: string, amount: number, description?: string): Promise<{ ok: boolean; newBalance: number }> => {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/credits`, {
    method: 'POST',
    body: JSON.stringify({ amount, description }),
  });
};

export const adminChangePlan = async (userId: string, planId: string): Promise<{ ok: boolean; user: CurrentUser }> => {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/plan`, {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
};

export const listAdminPayments = async (params: { limit?: number; offset?: number } = {}): Promise<{ payments: AdminPayment[]; total: number; limit: number; offset: number }> => {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/api/admin/payments${query}`);
};

export const listStripeEvents = async (onlyFailed = false, limit = 50): Promise<{ events: StripeEventRow[] }> => {
  const qs = new URLSearchParams();
  if (onlyFailed) qs.set('failed', '1');
  qs.set('limit', String(limit));
  return apiFetch(`/api/admin/stripe-events?${qs.toString()}`);
};
