import { describe, it, expect } from 'vitest';
import {
  calcImageCost,
  calcTextCost,
  creditCostFor,
  textCostEntry,
  imageCostEntry,
} from './billing.mjs';

describe('calcImageCost', () => {
  it('calcula custo proporcional aos tokens', () => {
    const result = calcImageCost('gemini-2.5-flash-image', 1000);
    expect(result.tokens).toBe(1000);
    expect(result.costBRL).toBeGreaterThan(0);
  });

  it('usa preço de fallback para modelo desconhecido', () => {
    const known = calcImageCost('gemini-2.5-flash-image', 1000);
    const unknown = calcImageCost('modelo-inexistente', 1000);
    expect(unknown.costBRL).toBe(known.costBRL); // fallback = mesmo preço base
  });

  it('custo zero para zero tokens', () => {
    expect(calcImageCost('gemini-2.5-flash-image', 0).costBRL).toBe(0);
  });
});

describe('calcTextCost', () => {
  it('soma input e output tokens', () => {
    const onlyInput = calcTextCost('gemini-2.5-flash', 1000, 0);
    const both = calcTextCost('gemini-2.5-flash', 1000, 1000);
    expect(both).toBeGreaterThan(onlyInput);
  });

  it('output é mais caro que input (flash)', () => {
    const inputCost = calcTextCost('gemini-2.5-flash', 1000, 0);
    const outputCost = calcTextCost('gemini-2.5-flash', 0, 1000);
    expect(outputCost).toBeGreaterThan(inputCost);
  });
});

describe('creditCostFor', () => {
  it('não cobra créditos quando billingMode não é platform', () => {
    expect(creditCostFor({ costBRL: 5 }, 'user_key')).toBe(0);
    expect(creditCostFor({ costBRL: 5 }, 'user_key_ephemeral')).toBe(0);
  });

  it('cobra no mínimo 1 crédito no modo platform', () => {
    expect(creditCostFor({ costBRL: 0 }, 'platform')).toBe(1);
    expect(creditCostFor({ costBRL: 0.001 }, 'platform')).toBe(1);
  });

  it('cobra proporcional ao custo (1 crédito = R$0,01)', () => {
    expect(creditCostFor({ costBRL: 1.0 }, 'platform')).toBe(100);
    expect(creditCostFor({ costBRL: 0.39 }, 'platform')).toBe(39);
  });

  it('arredonda para cima (ceil)', () => {
    expect(creditCostFor({ costBRL: 0.391 }, 'platform')).toBe(40);
  });
});

describe('textCostEntry', () => {
  it('extrai tokens do usageMetadata', () => {
    const fakeResponse = {
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    };
    const entry = textCostEntry('Teste', 'gemini-2.5-flash', fakeResponse);
    expect(entry.operation).toBe('Teste');
    expect(entry.inputTokens).toBe(100);
    expect(entry.outputTokens).toBe(50);
    expect(entry.costBRL).toBeGreaterThan(0);
  });

  it('lida com usageMetadata ausente (tokens 0)', () => {
    const entry = textCostEntry('Teste', 'gemini-2.5-flash', {});
    expect(entry.inputTokens).toBe(0);
    expect(entry.outputTokens).toBe(0);
  });
});

describe('imageCostEntry', () => {
  it('usa tokens e custo do resultado', () => {
    const entry = imageCostEntry('Geração', 'gemini-2.5-flash-image', { tokens: 1290, costBRL: 0.45 });
    expect(entry.outputTokens).toBe(1290);
    expect(entry.costBRL).toBe(0.45);
  });
});
