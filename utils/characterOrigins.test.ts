import { describe, it, expect } from 'vitest';
import { computeCharacterOrigins } from './characterOrigins';
import type { Character, Scene } from '../types';

const char = (name: string): Character => ({
  name,
  physical_characteristics: '',
  image_prompt: '',
});

const scene = (order: number, overrides: Partial<Scene> = {}): Scene => ({
  id: order,
  scene_id: order,
  sub_id: 1,
  order,
  original_location: `Cena ${order}`,
  original_description: '',
  tagged_description: '',
  image_prompt: '',
  style: '',
  ...overrides,
});

describe('computeCharacterOrigins', () => {
  it('detecta a origem por detected_characters da IA', () => {
    const scenes = [
      scene(1, { detected_characters: ['Paulo'] }),
      scene(2, { detected_characters: ['Maria'] }),
    ];
    const result = computeCharacterOrigins([char('Maria')], scenes);
    expect(result[0].firstSceneOrder).toBe(2);
    expect(result[0].origin).toContain('cena 2');
  });

  it('usa a primeira cena em que aparece (menor ordem)', () => {
    const scenes = [
      scene(1, { detected_characters: ['Maria'] }),
      scene(2, { detected_characters: ['Maria'] }),
    ];
    const result = computeCharacterOrigins([char('Maria')], scenes);
    expect(result[0].firstSceneOrder).toBe(1);
  });

  it('faz fallback para [nome] na tagged_description', () => {
    const scenes = [scene(3, { tagged_description: 'A [maria] entra na sala.' })];
    const result = computeCharacterOrigins([char('Maria')], scenes);
    expect(result[0].firstSceneOrder).toBe(3);
  });

  it('é case-insensitive', () => {
    const scenes = [scene(1, { detected_characters: ['MARIA'] })];
    const result = computeCharacterOrigins([char('maria')], scenes);
    expect(result[0].firstSceneOrder).toBe(1);
  });

  it('deixa origin indefinida quando o personagem não aparece', () => {
    const scenes = [scene(1, { detected_characters: ['Paulo'] })];
    const result = computeCharacterOrigins([char('Maria')], scenes);
    expect(result[0].firstSceneOrder).toBeUndefined();
    expect(result[0].origin).toBeUndefined();
  });

  it('preserva os demais campos do personagem', () => {
    const c = { ...char('Maria'), physical_characteristics: 'Mulher, 34 anos' };
    const result = computeCharacterOrigins([c], [scene(1, { detected_characters: ['Maria'] })]);
    expect(result[0].physical_characteristics).toBe('Mulher, 34 anos');
  });
});
