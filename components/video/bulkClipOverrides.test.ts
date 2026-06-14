import { describe, expect, it } from 'vitest';
import type { Scene } from '@/types';
import { buildBulkClipUpdates, type BulkClipPatch } from './bulkClipOverrides';

const scene = (id: number, overrides: Partial<Scene> = {}): Scene => ({
  id,
  scene_id: id,
  sub_id: 1,
  order: id,
  original_location: `Local ${id}`,
  original_description: `Descrição ${id}`,
  tagged_description: '',
  image_prompt: '',
  style: '',
  ...overrides,
});

const transitionPatch: BulkClipPatch = {
  transitionIn: 'iris',
  transitionDurationSeconds: 0.55,
  transitionEasing: 'ease-out',
};

describe('buildBulkClipUpdates', () => {
  it('cria um override de transição para um plano sem override prévio', () => {
    const updates = buildBulkClipUpdates(
      [scene(10), scene(11)],
      [{ sceneId: 11, sourceId: 'main', patch: transitionPatch }],
    );

    expect(updates).toEqual([
      {
        sceneId: 11,
        overrides: [{
          sourceId: 'main',
          transitionIn: 'iris',
          transitionDurationSeconds: 0.55,
          transitionEasing: 'ease-out',
        }],
      },
    ]);
  });

  it('grava Ken Burns e duração sem tocar nos campos de transição existentes', () => {
    const updates = buildBulkClipUpdates(
      [scene(11, {
        videoClipOverrides: [{ sourceId: 'main', transitionIn: 'zoom', transitionDurationSeconds: 0.4 }],
      })],
      [{
        sceneId: 11,
        sourceId: 'main',
        patch: { durationSeconds: 6, kenBurns: { direction: 'pan-up', intensity: 0.15 } },
      }],
    );

    expect(updates[0].overrides).toEqual([{
      sourceId: 'main',
      transitionIn: 'zoom',
      transitionDurationSeconds: 0.4,
      durationSeconds: 6,
      kenBurns: { direction: 'pan-up', intensity: 0.15 },
    }]);
  });

  it('aplica patches distintos por plano dentro da mesma cena', () => {
    const updates = buildBulkClipUpdates(
      [scene(11, { videoClipOverrides: [{ sourceId: 'split:wide', durationSeconds: 2 }] })],
      [
        { sceneId: 11, sourceId: 'main', patch: { kenBurns: { direction: 'zoom-in', intensity: 0.1 } } },
        { sceneId: 11, sourceId: 'split:wide', patch: transitionPatch },
      ],
    );

    expect(updates).toHaveLength(1);
    expect(updates[0].overrides).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'main', kenBurns: { direction: 'zoom-in', intensity: 0.1 } }),
      expect.objectContaining({ sourceId: 'split:wide', durationSeconds: 2, transitionIn: 'iris' }),
    ]));
    expect(updates[0].overrides).toHaveLength(2);
  });

  it('emite uma atualização por cena para alvos em cenas distintas', () => {
    const updates = buildBulkClipUpdates(
      [scene(10), scene(11), scene(12)],
      [
        { sceneId: 11, sourceId: 'main', patch: transitionPatch },
        { sceneId: 12, sourceId: 'main', patch: transitionPatch },
      ],
    );

    expect(updates.map(update => update.sceneId).sort()).toEqual([11, 12]);
  });

  it('ignora alvos com patch vazio ou cuja cena não existe', () => {
    const updates = buildBulkClipUpdates(
      [scene(10)],
      [
        { sceneId: 10, sourceId: 'main', patch: {} },
        { sceneId: 999, sourceId: 'main', patch: transitionPatch },
      ],
    );

    expect(updates).toEqual([]);
  });

  it('não muta o array de overrides original da cena', () => {
    const original = [{ sourceId: 'main', durationSeconds: 4 }];
    const fixture = scene(11, { videoClipOverrides: original });

    buildBulkClipUpdates([fixture], [{ sceneId: 11, sourceId: 'main', patch: transitionPatch }]);

    expect(original).toEqual([{ sourceId: 'main', durationSeconds: 4 }]);
    expect(original[0]).not.toHaveProperty('transitionIn');
  });
});
