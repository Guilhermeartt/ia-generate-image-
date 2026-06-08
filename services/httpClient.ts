// ── HTTP client com injeção automática de CSRF token e credenciais ────────────
// O cookie csrf_token é setado pelo backend (NÃO httpOnly). Lemos esse cookie
// no client e enviamos como header x-csrf-token em métodos não-seguros.
// Métodos seguros (GET/HEAD/OPTIONS) não precisam.

const CSRF_COOKIE = 'csrf_token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
};

export interface ApiFetchOptions extends RequestInit {
  /** Header adicional opcional. Útil para Bearer e x-gemini-api-key. */
  authToken?: string;
  /** API key do usuário no modo BYOK, enviada no header x-gemini-api-key. */
  userApiKey?: string;
}

export const apiFetch = async (url: string, options: ApiFetchOptions = {}): Promise<Response> => {
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (!SAFE_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  if (options.authToken) headers.Authorization = `Bearer ${options.authToken}`;
  if (options.userApiKey) headers['x-gemini-api-key'] = options.userApiKey;

  return fetch(url, { ...options, headers, credentials: 'include' });
};

export const apiFetchJson = async <T>(url: string, options: ApiFetchOptions = {}): Promise<T> => {
  const response = await apiFetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string })?.error || 'Falha na comunicação com o servidor.');
  }
  return payload as T;
};

/** Faz um GET inicial para garantir que o cookie csrf_token seja emitido pelo backend. */
export const primeCsrfCookie = async (): Promise<void> => {
  if (getCsrfToken()) return;
  try {
    await apiFetch('/api/health');
  } catch {
    // intencionalmente silencioso — o cookie virá no próximo request ok.
  }
};
