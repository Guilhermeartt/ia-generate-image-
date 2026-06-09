import { useState, useCallback } from 'react';
import type { SavedAnalysis } from '../types';

const HISTORY_KEY = 'scriptVisualizerHistory';
const MAX_HISTORY = 2;

const loadInitial = (): SavedAnalysis[] => {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? (JSON.parse(saved) as SavedAnalysis[]) : [];
  } catch (e) {
    console.error('Failed to load history from localStorage', e);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
    return [];
  }
};

/**
 * Histórico de análises salvas (capado em MAX_HISTORY), persistido em
 * localStorage. Extraído de App.tsx.
 */
export function useAnalysisHistory() {
  const [history, setHistory] = useState<SavedAnalysis[]>(loadInitial);

  const addToHistory = useCallback((analysis: SavedAnalysis) => {
    setHistory((prev) => {
      const updated = [analysis, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save history to localStorage', e);
      }
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.error('Failed to clear history from localStorage', e);
    }
    setHistory([]);
  }, []);

  return { history, addToHistory, clearHistory };
}
