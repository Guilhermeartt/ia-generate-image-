import * as Sentry from '@sentry/node';

// ── Sentry: inicialização opcional ────────────────────────────────────────────
// Se SENTRY_DSN não estiver no env, todos os helpers viram no-ops e
// nenhum overhead é adicionado ao request loop.

let _enabled = false;

export const initSentry = () => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.GIT_SHA || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    sendDefaultPii: false, // não enviamos IP/headers por padrão
  });
  _enabled = true;
  console.log('[sentry] inicializado');
};

export const isSentryEnabled = () => _enabled;

// Middleware no-op quando desligado. Quando ligado, preenche o contexto
// (request id, user id) para que cada erro capturado tenha tags úteis.
export const sentryRequestHandler = () => (req, _res, next) => {
  if (!_enabled) return next();
  Sentry.withScope((scope) => {
    if (req.requestId) scope.setTag('request_id', req.requestId);
    if (req.user?.id) scope.setUser({ id: req.user.id, email: req.user.email });
    next();
  });
};

export const sentryErrorHandler = () => (err, req, _res, next) => {
  if (_enabled) {
    Sentry.withScope((scope) => {
      if (req.requestId) scope.setTag('request_id', req.requestId);
      if (req.user?.id) scope.setUser({ id: req.user.id });
      Sentry.captureException(err);
    });
  }
  next(err);
};

export const captureException = (err, context) => {
  if (!_enabled) return;
  Sentry.captureException(err, context);
};
