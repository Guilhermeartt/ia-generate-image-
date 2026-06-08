import type { ProjectState } from '../types';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
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
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
};

const apiFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Falha na comunicação com o servidor.');
  }

  return payload as T;
};

export const registerAccount = async (
  name: string,
  email: string,
  password: string
): Promise<CurrentUser> => {
  const payload = await apiFetch<{ user: CurrentUser; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setAuthToken(payload.token);
  return payload.user;
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
