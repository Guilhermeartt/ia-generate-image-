import { useState, useCallback, useEffect } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'app-theme';

const readStoredTheme = (): Theme => {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark';
  } catch {
    return 'dark';
  }
};

/**
 * Gerencia o tema (dark/light): estado, persistência em localStorage e
 * reflexo no atributo data-theme do <html>. Extraído de App.tsx.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  // Aplica o tema no DOM sempre que muda (e no mount).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const persist = (next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage indisponível — ignora persistência */
    }
  };

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    persist(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      persist(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}
