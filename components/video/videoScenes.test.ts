import { describe, expect, it } from 'vitest';
import type { Scene } from '@/types';
import { createVideoScenes, defaultLetteringForScene } from './videoScenes';

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

describe('createVideoScenes', () => {
  it('keeps only generated scenes and sorts them by storyboard order', () => {
    const result = createVideoScenes([
      scene(3, { imageUrl: 'data:image/png;base64,third' }),
      scene(1),
      scene(2, { imageUrl: 'data:image/png;base64,second' }),
    ]);

    expect(result.map((item) => item.id)).toEqual([2, 3]);
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
});
