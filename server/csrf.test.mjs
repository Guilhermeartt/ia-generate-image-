import { describe, it, expect, vi } from 'vitest';
import { csrfMiddleware, CSRF_COOKIE } from './csrf.mjs';

// Helpers para simular req/res do Express
const makeReq = ({ method = 'GET', path = '/api/x', cookies = {}, headers = {} } = {}) => ({
  method,
  path,
  cookies: { ...cookies },
  get: (name) => headers[name.toLowerCase()],
});

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookies: {},
    cookie(name, value) {
      this.cookies[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

describe('csrfMiddleware', () => {
  it('emite cookie csrf_token quando ausente', () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(res.cookies[CSRF_COOKIE]).toBeTruthy();
    expect(next).toHaveBeenCalledOnce();
  });

  it('libera métodos seguros (GET) sem header', () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('bloqueia POST sem header x-csrf-token (403)', () => {
    const req = makeReq({ method: 'POST', cookies: { [CSRF_COOKIE]: 'abc123' } });
    const res = makeRes();
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('bloqueia POST com header que não bate com o cookie (403)', () => {
    const req = makeReq({
      method: 'POST',
      cookies: { [CSRF_COOKIE]: 'token-do-cookie' },
      headers: { 'x-csrf-token': 'token-diferente' },
    });
    const res = makeRes();
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('libera POST com header que bate com o cookie', () => {
    const token = 'token-correto-1234567890';
    const req = makeReq({
      method: 'POST',
      cookies: { [CSRF_COOKIE]: token },
      headers: { 'x-csrf-token': token },
    });
    const res = makeRes();
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('isenta o webhook do Stripe (assinado pela própria Stripe)', () => {
    const req = makeReq({ method: 'POST', path: '/api/stripe/webhook' });
    const res = makeRes();
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('rejeita tokens de comprimentos diferentes sem vazar timing', () => {
    const req = makeReq({
      method: 'PUT',
      cookies: { [CSRF_COOKIE]: 'curto' },
      headers: { 'x-csrf-token': 'um-token-bem-mais-longo-que-o-cookie' },
    });
    const res = makeRes();
    const next = vi.fn();
    csrfMiddleware(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});
