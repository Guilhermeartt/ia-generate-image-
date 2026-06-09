// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Captura o emitter registrado para podermos disparar custos manualmente.
let registered: ((p: unknown) => void) | null = null;
vi.mock('../services/geminiService', () => ({
  registerCostEmitter: (fn: (p: unknown) => void) => {
    registered = fn;
  },
}));

import { useTextCosts } from './useTextCosts';

const emit = (costBRL: number, operation = 'Teste') =>
  registered?.({ operation, model: 'gemini-2.5-flash', inputTokens: 10, outputTokens: 5, costBRL });

beforeEach(() => {
  registered = null;
});

describe('useTextCosts', () => {
  it('começa vazio com total zero', () => {
    const { result } = renderHook(() => useTextCosts());
    expect(result.current.textCosts).toEqual([]);
    expect(result.current.totalCostBRL).toBe(0);
  });

  it('acumula custos emitidos', () => {
    const { result } = renderHook(() => useTextCosts());
    act(() => emit(0.05));
    act(() => emit(0.03));
    expect(result.current.textCosts).toHaveLength(2);
    expect(result.current.totalCostBRL).toBeCloseTo(0.08, 5);
  });

  it('resetTextCosts zera a lista', () => {
    const { result } = renderHook(() => useTextCosts());
    act(() => emit(0.1));
    act(() => result.current.resetTextCosts());
    expect(result.current.textCosts).toEqual([]);
    expect(result.current.totalCostBRL).toBe(0);
  });

  it('preserva os campos da entrada de custo', () => {
    const { result } = renderHook(() => useTextCosts());
    act(() => emit(0.07, 'Análise de Cena'));
    expect(result.current.textCosts[0].operation).toBe('Análise de Cena');
    expect(result.current.textCosts[0].costBRL).toBe(0.07);
  });
});
