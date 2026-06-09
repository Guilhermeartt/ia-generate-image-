import { useState, useCallback, useEffect, useMemo } from 'react';
import type { TextCostEntry } from '../types';
import { registerCostEmitter } from '../services/geminiService';

/**
 * Rastreia o custo das chamadas de texto da API Gemini. Registra um emitter
 * global no mount e acumula as entradas. Extraído de App.tsx.
 */
export function useTextCosts() {
  const [textCosts, setTextCosts] = useState<TextCostEntry[]>([]);

  useEffect(() => {
    registerCostEmitter(({ operation, model, inputTokens, outputTokens, costBRL }) => {
      setTextCosts((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          operation,
          model,
          inputTokens,
          outputTokens,
          costBRL,
          timestamp: Date.now(),
        },
      ]);
    });
  }, []);

  const resetTextCosts = useCallback(() => setTextCosts([]), []);

  const totalCostBRL = useMemo(
    () => textCosts.reduce((sum, item) => sum + item.costBRL, 0),
    [textCosts],
  );

  return { textCosts, resetTextCosts, totalCostBRL };
}
