// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresets } from './usePresets';
import type { GenerationSettings } from '../types';

const settings: GenerationSettings = {
  imageModel: 'gemini-2.5-flash-image',
  characterImageModel: 'imagen-4.0-generate-001',
  aspectRatio: '16:9',
  numberOfImages: 1,
  resolution: '1K',
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('usePresets', () => {
  it('começa sem presets e em "custom"', () => {
    const { result } = renderHook(() => usePresets({ currentSettings: settings, applySettings: vi.fn() }));
    expect(result.current.presets).toEqual([]);
    expect(result.current.selectedPresetId).toBe('custom');
  });

  it('salva um preset com nome e persiste', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Meu preset');
    const { result } = renderHook(() => usePresets({ currentSettings: settings, applySettings: vi.fn() }));
    act(() => result.current.savePreset());
    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe('Meu preset');
    expect(result.current.selectedPresetId).toBe(result.current.presets[0].id);
    expect(JSON.parse(localStorage.getItem('generationSettingsPresets')!)).toHaveLength(1);
  });

  it('não salva se o usuário cancela o prompt', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const { result } = renderHook(() => usePresets({ currentSettings: settings, applySettings: vi.fn() }));
    act(() => result.current.savePreset());
    expect(result.current.presets).toEqual([]);
  });

  it('selectPreset aplica as configurações do preset', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('P1');
    const applySettings = vi.fn();
    const { result } = renderHook(() => usePresets({ currentSettings: settings, applySettings }));
    act(() => result.current.savePreset());
    const id = result.current.presets[0].id;
    act(() => result.current.selectPreset(id));
    expect(applySettings).toHaveBeenCalledWith(expect.objectContaining({ aspectRatio: '16:9' }));
  });

  it('deletePreset remove após confirmação e volta para custom', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('P1');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => usePresets({ currentSettings: settings, applySettings: vi.fn() }));
    act(() => result.current.savePreset());
    act(() => result.current.deletePreset());
    expect(result.current.presets).toEqual([]);
    expect(result.current.selectedPresetId).toBe('custom');
  });

  it('carrega presets existentes do localStorage', () => {
    localStorage.setItem(
      'generationSettingsPresets',
      JSON.stringify([{ id: 'x', name: 'Salvo', settings }]),
    );
    const { result } = renderHook(() => usePresets({ currentSettings: settings, applySettings: vi.fn() }));
    expect(result.current.presets[0].name).toBe('Salvo');
  });
});
