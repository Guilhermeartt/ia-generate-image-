// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Scene } from '@/types';
import VideoStudio from './VideoStudio';

vi.mock('@remotion/player', () => ({
  Player: React.forwardRef(() => <div data-testid="remotion-player" />),
}));

const scene: Scene = {
  id: 10,
  scene_id: 2,
  sub_id: 1,
  order: 1,
  original_location: 'Estação',
  original_description: 'Uma pessoa aguarda o trem.',
  tagged_description: '',
  image_prompt: '',
  style: '',
  imageUrl: 'data:image/png;base64,image',
  lettering_notes: ['ÚLTIMO TREM'],
};

describe('VideoStudio', () => {
  it('edits and emits persistent lettering for a scene', () => {
    const onLetteringChange = vi.fn();
    render(
      <VideoStudio scenes={[scene]} aspectRatio="16:9" onLetteringChange={onLetteringChange} />,
    );

    const textarea = screen.getByLabelText('Texto');
    expect(textarea).toHaveValue('ÚLTIMO TREM');

    fireEvent.change(textarea, { target: { value: 'EMBARQUE AGORA' } });

    expect(onLetteringChange).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        text: 'EMBARQUE AGORA',
        position: 'bottom',
        style: 'cinematic',
      }),
    );
  });
});
