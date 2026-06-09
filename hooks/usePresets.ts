import { useState, useCallback } from 'react';
import type { SettingsPreset, GenerationSettings } from '../types';

const PRESETS_KEY = 'generationSettingsPresets';
export const CUSTOM_PRESET_ID = 'custom';

const loadInitial = (): SettingsPreset[] => {
  try {
    const saved = localStorage.getItem(PRESETS_KEY);
    return saved ? (JSON.parse(saved) as SettingsPreset[]) : [];
  } catch (e) {
    console.error('Failed to load presets from localStorage', e);
    return [];
  }
};

const persist = (presets: SettingsPreset[]) => {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save presets to localStorage', e);
  }
};

interface UsePresetsParams {
  /** Configurações de geração atuais, usadas ao salvar um novo preset. */
  currentSettings: GenerationSettings;
  /** Aplica as configurações de um preset selecionado. */
  applySettings: (settings: GenerationSettings) => void;
}

/**
 * Presets de configuração de geração: persistência em localStorage,
 * salvar/excluir/selecionar. Extraído de App.tsx.
 */
export function usePresets({ currentSettings, applySettings }: UsePresetsParams) {
  const [presets, setPresets] = useState<SettingsPreset[]>(loadInitial);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(CUSTOM_PRESET_ID);

  const savePreset = useCallback(() => {
    const name = prompt('Digite um nome para o preset:');
    if (!name) return;
    const newPreset: SettingsPreset = {
      id: Date.now().toString(),
      name,
      settings: { ...currentSettings },
    };
    setPresets((prev) => {
      const updated = [...prev, newPreset];
      persist(updated);
      return updated;
    });
    setSelectedPresetId(newPreset.id);
  }, [currentSettings]);

  const deletePreset = useCallback(() => {
    if (selectedPresetId === CUSTOM_PRESET_ID) return;
    if (!window.confirm('Tem certeza que deseja excluir este preset?')) return;
    setPresets((prev) => {
      const updated = prev.filter((p) => p.id !== selectedPresetId);
      persist(updated);
      return updated;
    });
    setSelectedPresetId(CUSTOM_PRESET_ID);
  }, [selectedPresetId]);

  const selectPreset = useCallback(
    (presetId: string) => {
      setSelectedPresetId(presetId);
      if (presetId === CUSTOM_PRESET_ID) return;
      const preset = presets.find((p) => p.id === presetId);
      if (preset) applySettings(preset.settings);
    },
    [presets, applySettings],
  );

  return { presets, selectedPresetId, setSelectedPresetId, savePreset, deletePreset, selectPreset };
}
