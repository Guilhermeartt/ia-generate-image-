import { useState, useEffect } from 'react';
import type { AppSettings } from '../types';
import { DEFAULT_PROMPTS } from '../config/prompts';

const SETTINGS_KEY = 'scriptVisualizerSettings';
const SETTINGS_PROMPT_VERSION_KEY = 'scriptVisualizerPromptVersion';
const CURRENT_PROMPT_VERSION = '2026-05-20-modular-json-v4';

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_PROMPTS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        // Merge saved settings with defaults to ensure all keys are present
        const parsedSettings = JSON.parse(savedSettings);
        const savedPromptVersion = localStorage.getItem(SETTINGS_PROMPT_VERSION_KEY);
        const mergedSettings = { ...DEFAULT_PROMPTS, ...parsedSettings };
        const migratedSettings = savedPromptVersion === CURRENT_PROMPT_VERSION
          ? mergedSettings
          : {
              ...mergedSettings,
              scriptStructuringPrompt: DEFAULT_PROMPTS.scriptStructuringPrompt,
              sceneAnalysisPrompt: DEFAULT_PROMPTS.sceneAnalysisPrompt,
              characterImagePrompt: DEFAULT_PROMPTS.characterImagePrompt,
              storyboardStructureConfig: DEFAULT_PROMPTS.storyboardStructureConfig,
              sceneAnalysisConfig: DEFAULT_PROMPTS.sceneAnalysisConfig,
            };

        if (savedPromptVersion !== CURRENT_PROMPT_VERSION) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(migratedSettings));
          localStorage.setItem(SETTINGS_PROMPT_VERSION_KEY, CURRENT_PROMPT_VERSION);
        }

        setSettings(migratedSettings);
      } else {
        localStorage.setItem(SETTINGS_PROMPT_VERSION_KEY, CURRENT_PROMPT_VERSION);
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
      localStorage.setItem(SETTINGS_PROMPT_VERSION_KEY, CURRENT_PROMPT_VERSION);
      setSettings(newSettings);
    } catch (e) {
      console.error("Falha ao salvar configurações no localStorage", e);
    }
  };

  return { settings, saveSettings, isLoaded };
};
