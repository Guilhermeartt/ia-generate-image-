// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from '@/types';
import VideoStudio from './VideoStudio';

vi.mock('@remotion/player', () => ({
  Player: React.forwardRef(() => <div data-testid="remotion-player" />),
}));

afterEach(() => {
  cleanup();
  if (typeof window !== 'undefined') window.localStorage.clear();
});

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
  it('edits and emits persistent lettering for a scene (debounced)', async () => {
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

    await waitFor(
      () => {
        expect(onLetteringChange).toHaveBeenCalledWith(
          10,
          expect.objectContaining({
            text: 'EMBARQUE AGORA',
            position: 'bottom',
            style: 'cinematic',
          }),
        );
      },
      { timeout: 800 },
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

  it('updates lettering start and end timing for the parent scene', () => {
    const onLetteringChange = vi.fn();
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={onLetteringChange}
        onImageSourcesChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Começa em'), { target: { value: '0.8' } });
    fireEvent.change(screen.getByLabelText('Termina em'), { target: { value: '2.4' } });

    expect(onLetteringChange).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ startSeconds: 0.8 }),
    );
    expect(onLetteringChange).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ endSeconds: 2.4 }),
    );
  });

  it('applies a lettering template via style card', () => {
    const onLetteringChange = vi.fn();
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={onLetteringChange}
        onImageSourcesChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Lower third/i }));

    expect(onLetteringChange).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        style: 'lower-third',
        position: 'bottom',
        backgroundOpacity: 0.76,
        borderRadius: 6,
      }),
    );
  });

  it('edits entry and exit animations', () => {
    const onLetteringChange = vi.fn();
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={onLetteringChange}
        onImageSourcesChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Entrada'), { target: { value: 'zoom' } });
    fireEvent.change(screen.getByLabelText('Saída'), { target: { value: 'slide-right' } });

    expect(onLetteringChange).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ enterAnimation: 'zoom' }),
    );
    expect(onLetteringChange).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ exitAnimation: 'slide-right' }),
    );
  });

  it('routes per-clip edits through onClipOverridesChange when scope is "Só este plano"', () => {
    const onLetteringChange = vi.fn();
    const onClipOverridesChange = vi.fn();
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={onLetteringChange}
        onImageSourcesChange={vi.fn()}
        onClipOverridesChange={onClipOverridesChange}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Movimento' }));
    fireEvent.change(screen.getByLabelText('Direção'), { target: { value: 'pan-left' } });

    expect(onClipOverridesChange).toHaveBeenCalledWith(
      10,
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'main',
          kenBurns: expect.objectContaining({ direction: 'pan-left' }),
        }),
      ]),
    );
  });

  it('aplica um preset profissional de transição ao plano selecionado', () => {
    const onClipOverridesChange = vi.fn();
    render(
      <VideoStudio
        scenes={[
          scene,
          { ...scene, id: 11, scene_id: 3, order: 2, imageUrl: 'data:image/png;base64,second' },
        ]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={vi.fn()}
        onClipOverridesChange={onClipOverridesChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Selecionar Cena 3-1/i }));
    fireEvent.click(screen.getByRole('tab', { name: /^Movimento/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cinema' }));

    expect(onClipOverridesChange).toHaveBeenCalledWith(
      11,
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'main',
          transitionIn: 'zoom-blur',
          transitionDurationSeconds: 0.45,
          transitionEasing: 'ease-in-out',
        }),
      ]),
    );
  });

  it('desabilita a transição de entrada no primeiro plano', () => {
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Movimento' }));

    expect(screen.getByText(/primeiro plano começa o vídeo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cinema' })).toBeDisabled();
    expect(screen.getByLabelText('Tipo')).toBeDisabled();
  });

  it('limita presets de transição à duração dos planos envolvidos', () => {
    const onClipOverridesChange = vi.fn();
    render(
      <VideoStudio
        scenes={[
          {
            ...scene,
            videoClipOverrides: [{ sourceId: 'main', durationSeconds: 0.2 }],
          },
          {
            ...scene,
            id: 11,
            scene_id: 3,
            order: 2,
            imageUrl: 'data:image/png;base64,second',
            videoClipOverrides: [{ sourceId: 'main', durationSeconds: 0.2 }],
          },
        ]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={vi.fn()}
        onClipOverridesChange={onClipOverridesChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Selecionar Cena 3-1/i }));
    fireEvent.click(screen.getByRole('tab', { name: /^Movimento/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Editorial' }));

    expect(onClipOverridesChange).toHaveBeenCalledWith(
      11,
      expect.arrayContaining([
        expect.objectContaining({
          transitionIn: 'iris',
          transitionDurationSeconds: 0.4,
        }),
      ]),
    );
  });

  it('aplica o preset de transição por shapes', () => {
    const onClipOverridesChange = vi.fn();
    render(
      <VideoStudio
        scenes={[
          scene,
          { ...scene, id: 11, scene_id: 3, order: 2, imageUrl: 'data:image/png;base64,second' },
        ]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={vi.fn()}
        onClipOverridesChange={onClipOverridesChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Selecionar Cena 3-1/i }));
    fireEvent.click(screen.getByRole('tab', { name: /^Movimento/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }));

    expect(onClipOverridesChange).toHaveBeenCalledWith(
      11,
      expect.arrayContaining([
        expect.objectContaining({
          transitionIn: 'shape-diagonal',
          transitionDurationSeconds: 0.75,
          transitionEasing: 'ease-in-out',
        }),
      ]),
    );
  });

  it('exposes a timeline with each clip selectable', () => {
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Linha do tempo do vídeo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Selecionar Cena 2-1/i })).toBeTruthy();
  });

  it('undoes a style change via the Desfazer button', () => {
    const onLetteringChange = vi.fn();
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={onLetteringChange}
        onImageSourcesChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Lower third/i }));
    onLetteringChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Desfazer/i }));

    // undo emite o lettering anterior (undefined no fixture inicial)
    expect(onLetteringChange).toHaveBeenCalledWith(10, undefined);
  });

  it('records aspect changes in history', () => {
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    fireEvent.change(screen.getByLabelText('Aspect ratio'), { target: { value: '9:16' } });

    const undoBtn = screen.getByRole('button', { name: /Desfazer/i });
    expect(undoBtn).not.toBeDisabled();
  });

  it('blocks audio above the size limit', () => {
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Áudio' }));

    const input = screen.getByLabelText('Carregar trilha de áudio') as HTMLInputElement;
    const bigFile = new File([new Uint8Array(26 * 1024 * 1024)], 'big.mp3', { type: 'audio/mpeg' });
    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(screen.getByRole('alert').textContent).toMatch(/acima de/i);
  });

  it('hides the scope toggle when the parent scene has a single clip', () => {
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={vi.fn()}
        onClipOverridesChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('radiogroup', { name: 'Escopo da edição' })).toBeNull();
  });

  it('shows the scope toggle when the parent scene has multiple clips', () => {
    render(
      <VideoStudio
        scenes={[{
          ...scene,
          splitImages: [{ id: 'wide', prompt: 'Plano aberto', imageUrl: 'data:image/png;base64,wide' }],
          videoImageSourceIds: ['main', 'split:wide'],
        }]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={vi.fn()}
        onClipOverridesChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Escopo da edição' })).toBeTruthy();
  });

  it('calls onExportRequest with current state', () => {
    const onExportRequest = vi.fn();
    render(
      <VideoStudio
        scenes={[scene]}
        aspectRatio="16:9"
        onLetteringChange={vi.fn()}
        onImageSourcesChange={vi.fn()}
        onExportRequest={onExportRequest}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Exportar MP4/i }));

    expect(onExportRequest).toHaveBeenCalledWith(
      expect.objectContaining({ aspectRatio: '16:9' }),
    );
  });
});
