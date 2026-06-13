import { describe, expect, it } from 'vitest';
import type { Scene } from '@/types';
import { createVideoScenes, DEFAULT_KEN_BURNS, defaultLetteringForScene } from './videoScenes';

const scene = (order: number, overrides: Partial<Scene> = {}): Scene => ({
  id: order,
  scene_id: order,
  sub_id: 1,
  order,
  original_location: `Local ${order}`,
  original_description: `Descrição ${order}`,
  tagged_description: '',
  image_prompt: '',
  style: '',
  ...overrides,
});

describe('DEFAULT_KEN_BURNS', () => {
  it('começa desativado para novas cenas', () => {
    expect(DEFAULT_KEN_BURNS).toEqual({ direction: 'none', intensity: 0 });
  });
});

describe('createVideoScenes', () => {
  it('keeps only generated scenes and sorts them by storyboard order', () => {
    const result = createVideoScenes([
      scene(3, { imageUrl: 'data:image/png;base64,third' }),
      scene(1),
      scene(2, { imageUrl: 'data:image/png;base64,second' }),
    ]);

    expect(result.map((item) => item.sceneId)).toEqual([2, 3]);
  });

  it('propaga o templateId da cena para cada clipe', () => {
    const result = createVideoScenes([
      scene(1, { imageUrl: 'data:image/png;base64,main', templateId: 'tmpl_1' }),
      scene(2, { imageUrl: 'data:image/png;base64,two' }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].templateId).toBe('tmpl_1');
    expect(result[1].templateId).toBeUndefined();
  });

  it('propaga elementos adicionais da composição para o vídeo', () => {
    const templateElements = [
      { id: 'extra', type: 'text' as const, name: 'Título', x: 0, y: 0, width: 100, height: 30, text: 'Oi' },
    ];
    const result = createVideoScenes([
      scene(1, { imageUrl: 'data:image/png;base64,main', templateId: 'tmpl_1', templateElements }),
    ]);
    expect(result[0].templateElements).toEqual(templateElements);
  });

  it('uses the first generated split when a scene has no main image', () => {
    const result = createVideoScenes([
      scene(1, {
        splitImages: [
          { id: 'a', prompt: 'Plano aberto', imageUrl: 'data:image/png;base64,split' },
        ],
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('split:a');
    expect(result[0].imageUrl).toContain('split');
  });

  it('expands multiple selected sources in the requested order', () => {
    const result = createVideoScenes([
      scene(1, {
        imageUrl: 'data:image/png;base64,main',
        endFrameUrl: 'data:image/png;base64,end',
        splitImages: [
          { id: 'a', prompt: 'Plano aberto', imageUrl: 'data:image/png;base64,split-a' },
          { id: 'b', prompt: 'Close', imageUrl: 'data:image/png;base64,split-b' },
        ],
        videoImageSourceIds: ['split:b', 'main', 'end'],
      }),
    ]);

    expect(result.map(item => item.sourceId)).toEqual(['split:b', 'main', 'end']);
  });

  it('drops selected sources that no longer exist', () => {
    const result = createVideoScenes([
      scene(1, {
        imageUrl: 'data:image/png;base64,main',
        videoImageSourceIds: ['split:removed', 'main'],
      }),
    ]);

    expect(result.map(item => item.sourceId)).toEqual(['main']);
  });

  it('limits long captions so they remain readable in the player', () => {
    const result = createVideoScenes([
      scene(1, {
        imageUrl: 'data:image/png;base64,image',
        original_description: 'A'.repeat(220),
      }),
    ]);

    expect(result[0].description).toHaveLength(180);
    expect(result[0].description.endsWith('…')).toBe(true);
  });

  it('uses script lettering notes as the editable video text', () => {
    const result = defaultLetteringForScene(
      scene(1, { lettering_notes: ['UM NOVO COMEÇO', 'São Paulo, 2026'] }),
    );

    expect(result.text).toBe('UM NOVO COMEÇO\nSão Paulo, 2026');
  });

  it('preserves lettering edited and saved in the scene', () => {
    const result = createVideoScenes([
      scene(1, {
        imageUrl: 'data:image/png;base64,image',
        videoLettering: {
          text: 'Texto editado',
          position: 'top',
          align: 'center',
          style: 'box',
          fontSize: 64,
          color: '#ffcc00',
        },
      }),
    ]);

    expect(result[0].lettering).toEqual({
      text: 'Texto editado',
      position: 'top',
      align: 'center',
      style: 'box',
      fontSize: 64,
      color: '#ffcc00',
    });
  });

  it('shares one lettering timeline across sub-scenes with the same parent scene id', () => {
    const result = createVideoScenes([
      scene(1, {
        id: 11,
        scene_id: 5,
        sub_id: 1,
        imageUrl: 'data:image/png;base64,first',
      }),
      scene(2, {
        id: 12,
        scene_id: 5,
        sub_id: 2,
        imageUrl: 'data:image/png;base64,second',
        lettering_notes: ['TEXTO CONTÍNUO'],
      }),
    ]);

    expect(result.map(item => item.parentSceneClipIndex)).toEqual([0, 1]);
    expect(result.map(item => item.parentSceneClipCount)).toEqual([2, 2]);
    expect(result.map(item => item.lettering.text)).toEqual(['TEXTO CONTÍNUO', 'TEXTO CONTÍNUO']);
  });

  it('uses the saved parent lettering in every sub-scene', () => {
    const sharedLettering = {
      ...defaultLetteringForScene(scene(1)),
      text: 'MESMO LETTERING',
      startSeconds: 1,
      endSeconds: 5,
      enterAnimation: 'zoom' as const,
    };
    const result = createVideoScenes([
      scene(1, {
        id: 21,
        scene_id: 7,
        sub_id: 1,
        imageUrl: 'data:image/png;base64,first',
        videoLettering: sharedLettering,
      }),
      scene(2, {
        id: 22,
        scene_id: 7,
        sub_id: 2,
        imageUrl: 'data:image/png;base64,second',
      }),
    ]);

    expect(result[0].lettering).toEqual(sharedLettering);
    expect(result[1].lettering).toEqual(sharedLettering);
  });
});
