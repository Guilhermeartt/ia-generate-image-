import * as Sentry from '@sentry/react';

// ── Sentry client (browser) ──────────────────────────────────────────────────
// Lê VITE_SENTRY_DSN do env do Vite. Sem DSN, fica desligado (zero overhead).

let _enabled = false;

export const initSentryClient = (): void => {
  const dsn = (import.meta as { env?: Record<string, string> }).env?.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: (import.meta as { env?: Record<string, string> }).env?.MODE || 'production',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
  });
  _enabled = true;
};

export const isSentryClientEnabled = (): boolean => _enabled;

export const setSentryUser = (user: { id: string; email?: string } | null): void => {
  if (!_enabled) return;
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email });
  } else {
    Sentry.setUser(null);
  }
};

export const captureClientException = (err: unknown, context?: Record<string, unknown>): void => {
  if (!_enabled) return;
  Sentry.captureException(err, { extra: context });
};
