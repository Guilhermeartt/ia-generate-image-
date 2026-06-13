import { describe, it, expect } from 'vitest';
import { validate, schemas } from './validation.mjs';

describe('validate / schemas.register', () => {
  it('aceita entrada válida e normaliza email', () => {
    const out = validate(schemas.register, {
      name: '  João  ',
      email: 'JOAO@Example.COM',
      password: 'senha-forte-123',
    });
    expect(out.name).toBe('João');
    expect(out.email).toBe('joao@example.com');
  });

  it('rejeita senha curta', () => {
    expect(() => validate(schemas.register, { name: 'X', email: 'a@b.com', password: '123' }))
      .toThrow(/password/);
  });

  it('rejeita email inválido', () => {
    expect(() => validate(schemas.register, { name: 'X', email: 'não-é-email', password: 'senha-forte-123' }))
      .toThrow(/email/);
  });

  it('rejeita nome vazio', () => {
    expect(() => validate(schemas.register, { name: '   ', email: 'a@b.com', password: 'senha-forte-123' }))
      .toThrow(/name/);
  });
});

describe('schemas.adminCredits', () => {
  it('aceita inteiro positivo', () => {
    expect(validate(schemas.adminCredits, { amount: 100 }).amount).toBe(100);
  });
  it('aceita inteiro negativo (débito)', () => {
    expect(validate(schemas.adminCredits, { amount: -50 }).amount).toBe(-50);
  });
  it('rejeita zero', () => {
    expect(() => validate(schemas.adminCredits, { amount: 0 })).toThrow();
  });
  it('coage string numérica', () => {
    expect(validate(schemas.adminCredits, { amount: '42' }).amount).toBe(42);
  });
});

describe('schemas.billingPlan', () => {
  it('exige planId não-vazio', () => {
    expect(() => validate(schemas.billingPlan, {})).toThrow(/planId/);
    expect(validate(schemas.billingPlan, { planId: 'platform' }).planId).toBe('platform');
  });
});

describe('schemas.svgTemplate', () => {
  const template = {
    name: 'Modelo',
    markup: '<svg viewBox="0 0 1080.5 1920.25"></svg>',
  };

  it('aceita dimensões fracionárias de viewBox', () => {
    const out = validate(schemas.svgTemplate, {
      ...template,
      viewW: 1080.5,
      viewH: 1920.25,
    });

    expect(out.viewW).toBe(1080.5);
    expect(out.viewH).toBe(1920.25);
  });

  it('continua rejeitando dimensões não positivas', () => {
    expect(() => validate(schemas.svgTemplate, { ...template, viewW: 0 })).toThrow(/viewW/);
    expect(() => validate(schemas.svgTemplate, { ...template, viewH: -1 })).toThrow(/viewH/);
  });
});
