import React, { useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { Scene, SceneVideoLettering } from '@/types';
import { StoryboardComposition, type StoryboardVideoScene } from './StoryboardComposition';
import { createVideoScenes } from './videoScenes';

interface VideoStudioProps {
  scenes: Scene[];
  aspectRatio: string;
  onLetteringChange: (sceneId: number, lettering: SceneVideoLettering | undefined) => void;
}

const FPS = 30;

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:3': { width: 1440, height: 1080 },
  '3:4': { width: 1080, height: 1440 },
};

const VideoStudio: React.FC<VideoStudioProps> = ({ scenes, aspectRatio, onLetteringChange }) => {
  const [secondsPerScene, setSecondsPerScene] = useState(3);
  const [showCaptions, setShowCaptions] = useState(true);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const playerRef = useRef<PlayerRef>(null);
  const videoScenes = useMemo(() => createVideoScenes(scenes), [scenes]);
  const dimensions = DIMENSIONS[aspectRatio] ?? DIMENSIONS['16:9'];
  const framesPerScene = secondsPerScene * FPS;
  const durationInFrames = Math.max(1, videoScenes.length * framesPerScene);
  const missingImages = scenes.length - videoScenes.length;
  const selectedScene = videoScenes.find((scene) => scene.id === selectedSceneId) ?? videoScenes[0];

  const updateLettering = (scene: StoryboardVideoScene, patch: Partial<SceneVideoLettering>) => {
    onLetteringChange(scene.id, { ...scene.lettering, ...patch });
  };

  const selectScene = (scene: StoryboardVideoScene, index: number) => {
    setSelectedSceneId(scene.id);
    playerRef.current?.seekTo(index * framesPerScene);
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
            {videoScenes.length} cena{videoScenes.length !== 1 ? 's' : ''} •{' '}
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
            Lettering do vídeo
          </p>

          <label className="panel-field-label" htmlFor="video-lettering-scene">
            Cena
          </label>
          <select
            id="video-lettering-scene"
            className="field"
            value={selectedScene?.id ?? ''}
            onChange={(event) => {
              const index = videoScenes.findIndex(
                (scene) => scene.id === Number(event.target.value),
              );
              if (index >= 0) selectScene(videoScenes[index], index);
            }}
            style={{ fontSize: 12, marginBottom: 12 }}
          >
            {videoScenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.title} — {scene.location || 'Sem local'}
              </option>
            ))}
          </select>

          <label className="panel-field-label" htmlFor="video-lettering-text">
            Texto
          </label>
          <textarea
            id="video-lettering-text"
            className="field"
            rows={5}
            value={selectedScene?.lettering.text ?? ''}
            onChange={(event) =>
              selectedScene && updateLettering(selectedScene, { text: event.target.value })
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
                value={selectedScene?.lettering.position ?? 'bottom'}
                onChange={(event) =>
                  selectedScene &&
                  updateLettering(selectedScene, {
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
                value={selectedScene?.lettering.align ?? 'left'}
                onChange={(event) =>
                  selectedScene &&
                  updateLettering(selectedScene, {
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
            value={selectedScene?.lettering.style ?? 'cinematic'}
            onChange={(event) =>
              selectedScene &&
              updateLettering(selectedScene, {
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
                value={selectedScene?.lettering.fontSize ?? 52}
                onChange={(event) =>
                  selectedScene &&
                  updateLettering(selectedScene, { fontSize: Number(event.target.value) })
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
                value={selectedScene?.lettering.color ?? '#ffffff'}
                onChange={(event) =>
                  selectedScene && updateLettering(selectedScene, { color: event.target.value })
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
                if (!selectedScene) return;
                onLetteringChange(selectedScene.id, undefined);
              }}
              style={{ flex: 1, fontSize: 11 }}
            >
              Restaurar texto
            </button>
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>
            Configuração do preview
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
            {missingImages > 0 && (
              <p style={{ color: '#FBBF24', marginTop: 8 }}>
                {missingImages} cena{missingImages !== 1 ? 's' : ''} sem imagem não entra
                {missingImages === 1 ? '' : 'm'} no preview.
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
