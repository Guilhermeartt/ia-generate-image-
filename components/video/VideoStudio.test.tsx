// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from '@/types';
import VideoStudio from './VideoStudio';

vi.mock('@remotion/player', () => ({
  Player: React.forwardRef(() => <div data-testid="remotion-player" />),
}));

afterEach(cleanup);

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
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={onLetteringChange}
        onImageSourcesChange={vi.fn()}
      />,
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

  it('allows adding split images to the video selection', () => {
    const onImageSourcesChange = vi.fn();
    render(
      <VideoStudio
        scenes={[{
          ...scene,
          splitImages: [
            { id: 'wide', prompt: 'Plano aberto', imageUrl: 'data:image/png;base64,wide' },
          ],
        }]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={onImageSourcesChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Incluir Plano 1: Plano aberto no vídeo'));

    expect(onImageSourcesChange).toHaveBeenCalledWith(10, ['main', 'split:wide']);
  });

  it('keeps at least one image selected', () => {
    const onImageSourcesChange = vi.fn();
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={onImageSourcesChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Incluir Imagem principal no vídeo'));

    expect(onImageSourcesChange).not.toHaveBeenCalled();
  });
});
