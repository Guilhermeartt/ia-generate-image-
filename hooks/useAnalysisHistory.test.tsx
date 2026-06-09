// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnalysisHistory } from './useAnalysisHistory';
import type { SavedAnalysis } from '../types';

const makeAnalysis = (ts: number): SavedAnalysis => ({
  timestamp: ts,
  fileName: `roteiro-${ts}.csv`,
  generalContext: 'ctx',
  characters: [],
  scenes: [],
});

beforeEach(() => localStorage.clear());

describe('useAnalysisHistory', () => {
  it('começa vazio sem nada salvo', () => {
    const { result } = renderHook(() => useAnalysisHistory());
    expect(result.current.history).toEqual([]);
  });

  it('adiciona análise no topo e persiste', () => {
    const { result } = renderHook(() => useAnalysisHistory());
    act(() => result.current.addToHistory(makeAnalysis(1)));
    expect(result.current.history).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('scriptVisualizerHistory')!)).toHaveLength(1);
  });

  it('mantém o mais recente primeiro', () => {
    const { result } = renderHook(() => useAnalysisHistory());
    act(() => result.current.addToHistory(makeAnalysis(1)));
    act(() => result.current.addToHistory(makeAnalysis(2)));
    expect(result.current.history[0].timestamp).toBe(2);
  });

  it('capa o histórico em 2 entradas', () => {
    const { result } = renderHook(() => useAnalysisHistory());
    act(() => result.current.addToHistory(makeAnalysis(1)));
    act(() => result.current.addToHistory(makeAnalysis(2)));
    act(() => result.current.addToHistory(makeAnalysis(3)));
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history.map((h) => h.timestamp)).toEqual([3, 2]);
  });

  it('carrega o histórico existente do localStorage no init', () => {
    localStorage.setItem('scriptVisualizerHistory', JSON.stringify([makeAnalysis(99)]));
    const { result } = renderHook(() => useAnalysisHistory());
    expect(result.current.history[0].timestamp).toBe(99);
  });

  it('clearHistory zera estado e storage', () => {
    const { result } = renderHook(() => useAnalysisHistory());
    act(() => result.current.addToHistory(makeAnalysis(1)));
    act(() => result.current.clearHistory());
    expect(result.current.history).toEqual([]);
    expect(localStorage.getItem('scriptVisualizerHistory')).toBeNull();
  });
});
