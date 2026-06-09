import React, { useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { Scene, SceneVideoLettering } from '@/types';
import { StoryboardComposition, type StoryboardVideoScene } from './StoryboardComposition';
import {
  createVideoScenes,
  selectedVideoImageSourcesForScene,
  videoImageSourcesForScene,
} from './videoScenes';

interface VideoStudioProps {
  scenes: Scene[];
  aspectRatio: string;
  onLetteringChange: (sceneId: number, lettering: SceneVideoLettering | undefined) => void;
  onImageSourcesChange: (sceneId: number, sourceIds: string[]) => void;
}

const FPS = 30;

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:3': { width: 1440, height: 1080 },
  '3:4': { width: 1080, height: 1440 },
};

const VideoStudio: React.FC<VideoStudioProps> = ({
  scenes,
  aspectRatio,
  onLetteringChange,
  onImageSourcesChange,
}) => {
  const [secondsPerScene, setSecondsPerScene] = useState(3);
  const [showCaptions, setShowCaptions] = useState(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const videoScenes = useMemo(() => createVideoScenes(scenes), [scenes]);
  const dimensions = DIMENSIONS[aspectRatio] ?? DIMENSIONS['16:9'];
  const framesPerScene = secondsPerScene * FPS;
  const durationInFrames = Math.max(1, videoScenes.length * framesPerScene);
  const scenesWithoutSelectedImages = scenes.filter(
    scene => selectedVideoImageSourcesForScene(scene).length === 0,
  ).length;
  const selectedClip = videoScenes.find((scene) => scene.id === selectedClipId) ?? videoScenes[0];
  const selectedSourceScene = scenes.find(scene => scene.id === selectedClip?.sceneId);
  const availableSources = selectedSourceScene ? videoImageSourcesForScene(selectedSourceScene) : [];
  const selectedSourceIds = selectedSourceScene?.videoImageSourceIds
    ?? [availableSources.find(source => source.id === 'main') ?? availableSources[0]]
      .filter(Boolean)
      .map(source => source.id);

  const updateLettering = (scene: StoryboardVideoScene, patch: Partial<SceneVideoLettering>) => {
    onLetteringChange(scene.sceneId, { ...scene.lettering, ...patch });
  };

  const selectScene = (scene: StoryboardVideoScene, index: number) => {
    setSelectedClipId(scene.id);
    playerRef.current?.seekTo(index * framesPerScene);
  };

  const toggleImageSource = (sourceId: string) => {
    if (!selectedSourceScene) return;
    if (selectedSourceIds.includes(sourceId) && selectedSourceIds.length === 1) return;
    const nextIds = selectedSourceIds.includes(sourceId)
      ? selectedSourceIds.filter(id => id !== sourceId)
      : [...selectedSourceIds, sourceId];
    onImageSourcesChange(selectedSourceScene.id, nextIds);
  };

  if (videoScenes.length === 0) {
    return (
      <section className="anim-fade">
        <div className="section-hd" style={{ marginBottom: 16 }}>
          <div>
            <p className="section-title">Vídeo do storyboard</p>
            <p className="section-sub">Preview programático com Remotion.</p>
          </div>
        </div>
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--surface)',
          }}
        >
          <p style={{ color: 'var(--text-1)', fontWeight: 700, marginBottom: 6 }}>
            Gere ao menos uma imagem de cena
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
            O Remotion usa as imagens prontas para montar e reproduzir a sequência.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="anim-fade">
      <div className="section-hd" style={{ marginBottom: 16 }}>
        <div>
          <p className="section-title">Vídeo do storyboard</p>
          <p className="section-sub">
            {videoScenes.length} trecho{videoScenes.length !== 1 ? 's' : ''} •{' '}
            {videoScenes.length * secondsPerScene}s • Remotion Player
          </p>
        </div>
      </div>

      <div
        className="video-studio-grid"
        style={{
          display: 'grid',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            overflow: 'hidden',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: '#09090b',
            boxShadow: '0 18px 50px rgba(0,0,0,0.22)',
          }}
        >
          <Player
            key={previewRevision}
            ref={playerRef}
            component={StoryboardComposition}
            inputProps={{ scenes: videoScenes, framesPerScene, showCaptions }}
            durationInFrames={durationInFrames}
            compositionWidth={dimensions.width}
            compositionHeight={dimensions.height}
            fps={FPS}
            controls
            loop
            style={{ width: '100%', aspectRatio: `${dimensions.width}/${dimensions.height}` }}
          />
        </div>

        <aside
          style={{
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>
            Montagem do vídeo
          </p>

          <label className="panel-field-label" htmlFor="video-lettering-scene">
            Trecho
          </label>
          <select
            id="video-lettering-scene"
            className="field"
            value={selectedClip?.id ?? ''}
            onChange={(event) => {
              const index = videoScenes.findIndex(
                (scene) => scene.id === event.target.value,
              );
              if (index >= 0) selectScene(videoScenes[index], index);
            }}
            style={{ fontSize: 12, marginBottom: 12 }}
          >
            {videoScenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.title} — {scene.sourceLabel}
              </option>
            ))}
          </select>

          <p className="panel-field-label">Imagens desta cena</p>
          <div style={{ display: 'grid', gap: 7, marginBottom: 14 }}>
            {availableSources.map(source => (
              <label
                key={source.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '16px 52px minmax(0, 1fr)',
                  gap: 8,
                  alignItems: 'center',
                  padding: 7,
                  borderRadius: 8,
                  border: `1px solid ${selectedSourceIds.includes(source.id) ? 'var(--indigo-b)' : 'var(--border)'}`,
                  background: selectedSourceIds.includes(source.id) ? 'var(--indigo-s)' : 'var(--surface-2)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedSourceIds.includes(source.id)}
                  onChange={() => toggleImageSource(source.id)}
                  aria-label={`Incluir ${source.label} no vídeo`}
                />
                <img
                  src={source.imageUrl}
                  alt=""
                  style={{ width: 52, height: 32, objectFit: 'cover', borderRadius: 5 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {source.label}
                </span>
              </label>
            ))}
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.45, margin: '-6px 0 14px' }}>
            Você pode marcar várias imagens. Cada uma vira um trecho, seguindo a ordem exibida acima.
            Ao menos uma imagem deve permanecer marcada.
          </p>

          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>
            Lettering do trecho
          </p>

          <label className="panel-field-label" htmlFor="video-lettering-text">
            Texto
          </label>
          <textarea
            id="video-lettering-text"
            className="field"
            rows={5}
            value={selectedClip?.lettering.text ?? ''}
            onChange={(event) =>
              selectedClip && updateLettering(selectedClip, { text: event.target.value })
            }
            placeholder="Digite o lettering desta cena"
            style={{ fontSize: 12, lineHeight: 1.5, resize: 'vertical', marginBottom: 12 }}
          />

          <div className="video-lettering-fields">
            <div>
              <label className="panel-field-label" htmlFor="video-lettering-position">
                Posição
              </label>
              <select
                id="video-lettering-position"
                className="field"
                value={selectedClip?.lettering.position ?? 'bottom'}
                onChange={(event) =>
                  selectedClip &&
                  updateLettering(selectedClip, {
                    position: event.target.value as SceneVideoLettering['position'],
                  })
                }
                style={{ fontSize: 12 }}
              >
                <option value="top">Topo</option>
                <option value="center">Centro</option>
                <option value="bottom">Rodapé</option>
              </select>
            </div>
            <div>
              <label className="panel-field-label" htmlFor="video-lettering-align">
                Alinhamento
              </label>
              <select
                id="video-lettering-align"
                className="field"
                value={selectedClip?.lettering.align ?? 'left'}
                onChange={(event) =>
                  selectedClip &&
                  updateLettering(selectedClip, {
                    align: event.target.value as SceneVideoLettering['align'],
                  })
                }
                style={{ fontSize: 12 }}
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </div>
          </div>

          <label
            className="panel-field-label"
            htmlFor="video-lettering-style"
            style={{ marginTop: 12 }}
          >
            Estilo
          </label>
          <select
            id="video-lettering-style"
            className="field"
            value={selectedClip?.lettering.style ?? 'cinematic'}
            onChange={(event) =>
              selectedClip &&
              updateLettering(selectedClip, {
                style: event.target.value as SceneVideoLettering['style'],
              })
            }
            style={{ fontSize: 12, marginBottom: 12 }}
          >
            <option value="cinematic">Cinematográfico</option>
            <option value="box">Caixa legível</option>
            <option value="clean">Texto limpo</option>
          </select>

          <div className="video-lettering-fields">
            <div>
              <label className="panel-field-label" htmlFor="video-lettering-size">
                Tamanho
              </label>
              <input
                id="video-lettering-size"
                type="range"
                min={28}
                max={86}
                step={2}
                value={selectedClip?.lettering.fontSize ?? 52}
                onChange={(event) =>
                  selectedClip &&
                  updateLettering(selectedClip, { fontSize: Number(event.target.value) })
                }
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="panel-field-label" htmlFor="video-lettering-color">
                Cor
              </label>
              <input
                id="video-lettering-color"
                type="color"
                value={selectedClip?.lettering.color ?? '#ffffff'}
                onChange={(event) =>
                  selectedClip && updateLettering(selectedClip, { color: event.target.value })
                }
                style={{
                  width: '100%',
                  height: 34,
                  padding: 3,
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  background: 'var(--surface-2)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 16 }}>
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (!selectedClip) return;
                onLetteringChange(selectedClip.sceneId, undefined);
              }}
              style={{ flex: 1, fontSize: 11 }}
            >
              Restaurar texto
            </button>
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>
            Configuração do preview
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPreviewRevision(revision => revision + 1);
              setSelectedClipId(null);
            }}
            style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginBottom: 14 }}
          >
            Reiniciar preview
          </button>
          <p style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.45, margin: '-7px 0 14px' }}>
            O preview atualiza automaticamente ao marcar imagens, regenerar uma cena ou editar o lettering.
          </p>

          <label className="panel-field-label" htmlFor="video-scene-duration">
            Duração por cena
          </label>
          <select
            id="video-scene-duration"
            className="field"
            value={secondsPerScene}
            onChange={(event) => setSecondsPerScene(Number(event.target.value))}
            style={{ fontSize: 12, marginBottom: 14 }}
          >
            {[2, 3, 4, 5, 6, 8].map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} segundos
              </option>
            ))}
          </select>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-2)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showCaptions}
              onChange={(event) => setShowCaptions(event.target.checked)}
            />
            Exibir lettering
          </label>

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
              fontSize: 11,
              lineHeight: 1.55,
              color: 'var(--text-4)',
            }}
          >
            <p>Formato: {aspectRatio}</p>
            <p>
              Timeline: {durationInFrames} frames a {FPS} fps
            </p>
            {scenesWithoutSelectedImages > 0 && (
              <p style={{ color: '#FBBF24', marginTop: 8 }}>
                {scenesWithoutSelectedImages} cena{scenesWithoutSelectedImages !== 1 ? 's' : ''} sem
                imagem selecionada não entra{scenesWithoutSelectedImages === 1 ? '' : 'm'} no preview.
              </p>
            )}
          </div>

          <div
            style={{
              marginTop: 14,
              padding: 10,
              borderRadius: 8,
              background: 'var(--surface-2)',
              color: 'var(--text-3)',
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            Esta etapa reproduz o vídeo no navegador. Exportar MP4 exige um renderizador Remotion no
            backend.
          </div>
        </aside>
      </div>
    </section>
  );
};

export default VideoStudio;
