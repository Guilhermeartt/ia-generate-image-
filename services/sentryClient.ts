// ── Sentry client (browser) ──────────────────────────────────────────────────
// O SDK do Sentry (~94 KB) só é baixado se VITE_SENTRY_DSN estiver definido.
// Sem DSN, nenhum byte do Sentry entra no bundle inicial (dynamic import).

type SentryModule = typeof import('@sentry/react');
let _sentry: SentryModule | null = null;

export const initSentryClient = async (): Promise<void> => {
  const dsn = (import.meta as { env?: Record<string, string> }).env?.VITE_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import('@sentry/react');
  Sentry.init({
    dsn,
    environment: (import.meta as { env?: Record<string, string> }).env?.MODE || 'production',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
  });
  _sentry = Sentry;
};

export const isSentryClientEnabled = (): boolean => _sentry !== null;

export const setSentryUser = (user: { id: string; email?: string } | null): void => {
  _sentry?.setUser(user ? { id: user.id, email: user.email } : null);
};

export const captureClientException = (err: unknown, context?: Record<string, unknown>): void => {
  _sentry?.captureException(err, { extra: context });
};
