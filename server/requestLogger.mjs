import crypto from 'node:crypto';

// ── Request logger com x-request-id e sanitização de payload sensível ────────
// Substitui o `console.log` ad-hoc por uma linha estruturada por request.
// Em produção, esses logs são facilmente parseáveis (ndjson) por Datadog/Better Stack.

const SENSITIVE_KEYS = new Set([
  'password', 'newpassword', 'currentpassword',
  'apikey', 'api_key',
  'token', 'resettoken', 'csrftoken',
  'authorization', 'cookie', 'set-cookie',
  'stripe_signature',
  'encrypted_api_key',
]);

const maskValue = () => '«redacted»';

export const sanitizeObject = (input) => {
  if (input == null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(sanitizeObject);
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = maskValue();
    } else if (typeof value === 'object' && value !== null) {
      out[key] = sanitizeObject(value);
    } else {
      out[key] = value;
    }
  }
  return out;
};

export const requestLogger = (req, res, next) => {
  const requestId = req.get('x-request-id') || crypto.randomUUID();
  req.requestId = requestId;
  res.set('x-request-id', requestId);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    // ignore health/static asset noise
    if (req.path === '/healthz' || req.path === '/readyz') return;
    if (req.path === '/api/health' || req.path === '/api/ready') return;
    if (req.path.startsWith('/assets/') || req.path.startsWith('/static/')) return;

    const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
    // Formato compatível com Google Cloud Logging structured logs:
    //   - `severity` ao invés de `level`
    //   - `httpRequest` com schema oficial (https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#httprequest)
    //   - `logging.googleapis.com/trace` quando houver trace propagation
    const severity = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARNING' : 'INFO';
    const record = {
      timestamp: new Date().toISOString(),
      severity,
      message: `${req.method} ${req.path} ${res.statusCode} ${durationMs}ms`,
      requestId,
      userId: req.user?.id || null,
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl || req.url,
        status: res.statusCode,
        latency: `${(durationMs / 1000).toFixed(3)}s`,
        remoteIp: req.ip,
        userAgent: req.get('user-agent') || undefined,
        protocol: `HTTP/${req.httpVersion}`,
      },
    };
    if (process.env.LOG_BODIES === '1' && req.body) {
      record.body = sanitizeObject(req.body);
    }
    console.log(JSON.stringify(record));
  });

  next();
};
