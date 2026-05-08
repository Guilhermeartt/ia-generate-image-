import { useState, useEffect } from 'react';
import type { AppSettings } from '../types';
import { DEFAULT_PROMPTS } from '../config/prompts';

const SETTINGS_KEY = 'scriptVisualizerSettings';

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_PROMPTS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        // Merge saved settings with defaults to ensure all keys are present
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }
    } catch (e) {
      console.error("Falha ao carregar configurações do localStorage", e);
      // Use defaults if parsing fails
      setSettings(DEFAULT_PROMPTS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (e) {
      console.error("Falha ao salvar configurações no localStorage", e);
    }
  };

  return { settings, saveSettings, isLoaded };
};
