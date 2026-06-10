import React from 'react';
import type { Scene, SceneVideoLettering } from '@/types';
import type { StoryboardVideoScene } from './StoryboardComposition';
import type { SceneVideoImageSource } from './videoScenes';
import LetteringStyleCards from './LetteringStyleCards';
import { ColorOpacityField, RangeField } from './VideoStudioControls';
import { LETTERING_TEMPLATE_PATCH } from './videoStudioConstants';

interface LetteringPanelProps {
  clip: StoryboardVideoScene;
  sourceScene: Scene;
  displayLettering: SceneVideoLettering;
  availableSources: SceneVideoImageSource[];
  selectedSourceIds: string[];
  letteringTextDraft: string;
  parentSceneDuration: number;
  colorHistory: string[];
  onLetteringTextChange: (value: string) => void;
  onToggleImageSource: (sourceId: string) => void;
  onLetteringPatchPreview: (patch: Partial<SceneVideoLettering>) => void;
  onLetteringPatchCommit: (patch: Partial<SceneVideoLettering>, label: string) => void;
  onRecordColor: (color: string) => void;
  panelId: string;
  tabId: string;
}

const LetteringPanel: React.FC<LetteringPanelProps> = ({
  clip,
  displayLettering,
  availableSources,
  selectedSourceIds,
  letteringTextDraft,
  parentSceneDuration,
  colorHistory,
  onLetteringTextChange,
  onToggleImageSource,
  onLetteringPatchPreview,
  onLetteringPatchCommit,
  onRecordColor,
  panelId,
  tabId,
}) => {
  const letteringStart = Math.min(displayLettering.startSeconds ?? 0.2, parentSceneDuration);
  const letteringEnd = Math.min(displayLettering.endSeconds ?? parentSceneDuration, parentSceneDuration);

  return (
    <div className="vs-tab-panel" role="tabpanel" id={panelId} aria-labelledby={tabId}>
      <p className="vs-section-title">Imagens deste plano</p>
      <div className="vs-source-list">
        {availableSources.map(source => (
          <label
            key={source.id}
            className={`vs-source-item${selectedSourceIds.includes(source.id) ? ' is-selected' : ''}`}
          >
            <input
              type="checkbox"
              checked={selectedSourceIds.includes(source.id)}
              onChange={() => onToggleImageSource(source.id)}
              aria-label={`Incluir ${source.label} no vídeo`}
            />
            <img src={source.imageUrl} alt="" />
            <span>{source.label}</span>
          </label>
        ))}
      </div>

      <p className="vs-section-title">Texto</p>
      <textarea
        id="video-lettering-text"
        aria-label="Texto"
        className="field vs-textarea"
        rows={4}
        value={letteringTextDraft}
        onChange={(event) => onLetteringTextChange(event.target.value)}
        placeholder="Digite o lettering desta cena"
      />

      <p className="vs-section-title">Estilo</p>
      <LetteringStyleCards
        value={displayLettering.style}
        onChange={(style) => onLetteringPatchCommit(
          { style, ...(LETTERING_TEMPLATE_PATCH[style] ?? {}) },
          `Estilo ${style}`,
        )}
      />

      <div className="vs-row-2">
        <div>
          <label className="panel-field-label" htmlFor="video-lettering-position">Posição</label>
          <select
            id="video-lettering-position"
            className="field"
            value={displayLettering.position}
            onChange={(event) => onLetteringPatchCommit(
              { position: event.target.value as SceneVideoLettering['position'] },
              'Posição',
            )}
          >
            <option value="top">Topo</option>
            <option value="center">Centro</option>
            <option value="bottom">Rodapé</option>
          </select>
        </div>
        <div>
          <label className="panel-field-label" htmlFor="video-lettering-align">Alinhamento</label>
          <select
            id="video-lettering-align"
            className="field"
            value={displayLettering.align}
            onChange={(event) => onLetteringPatchCommit(
              { align: event.target.value as SceneVideoLettering['align'] },
              'Alinhamento',
            )}
          >
            <option value="left">Esquerda</option>
            <option value="center">Centro</option>
            <option value="right">Direita</option>
          </select>
        </div>
      </div>

      <RangeField
        id="video-lettering-size"
        label="Tamanho"
        min={28}
        max={86}
        step={2}
        value={displayLettering.fontSize}
        onChange={(value) => onLetteringPatchPreview({ fontSize: value })}
        onCommit={(value) => onLetteringPatchCommit({ fontSize: value }, 'Tamanho')}
        format={(value) => `${value}px`}
      />
      <ColorOpacityField
        id="video-lettering-color"
        label="Cor do texto"
        color={displayLettering.color}
        opacity={displayLettering.textOpacity ?? 1}
        onColorChange={(color) => onLetteringPatchPreview({ color })}
        onColorCommit={(color) => {
          onRecordColor(color);
          onLetteringPatchCommit({ color }, 'Cor do texto');
        }}
        onOpacityChange={(textOpacity) => onLetteringPatchPreview({ textOpacity })}
        onOpacityCommit={(textOpacity) => onLetteringPatchCommit({ textOpacity }, 'Opacidade do texto')}
        swatches={colorHistory}
      />
      <ColorOpacityField
        id="video-lettering-background"
        label="Cor de fundo"
        color={displayLettering.backgroundColor ?? '#000000'}
        opacity={displayLettering.backgroundOpacity ?? 0}
        onColorChange={(color) => onLetteringPatchPreview({ backgroundColor: color })}
        onColorCommit={(color) => onLetteringPatchCommit({ backgroundColor: color }, 'Cor de fundo')}
        onOpacityChange={(opacity) => onLetteringPatchPreview({ backgroundOpacity: opacity })}
        onOpacityCommit={(opacity) => onLetteringPatchCommit({ backgroundOpacity: opacity }, 'Opacidade do fundo')}
      />

      <p className="vs-section-title">Tempo</p>
      <div className="vs-row-2">
        <div>
          <label htmlFor="video-lettering-start" className="panel-field-label">Começa em</label>
          <input
            id="video-lettering-start"
            type="number"
            min={0}
            max={parentSceneDuration}
            step={0.1}
            className="field"
            value={letteringStart}
            onChange={(event) => {
              const startSeconds = Math.max(0, Math.min(Number(event.target.value), parentSceneDuration));
              onLetteringPatchCommit(
                { startSeconds, endSeconds: Math.max(startSeconds + 0.1, letteringEnd) },
                'Início do lettering',
              );
            }}
          />
        </div>
        <div>
          <label htmlFor="video-lettering-end" className="panel-field-label">Termina em</label>
          <input
            id="video-lettering-end"
            type="number"
            min={0.1}
            max={parentSceneDuration}
            step={0.1}
            className="field"
            value={letteringEnd}
            onChange={(event) => onLetteringPatchCommit(
              { endSeconds: Math.max(letteringStart + 0.1, Math.min(Number(event.target.value), parentSceneDuration)) },
              'Fim do lettering',
            )}
          />
        </div>
      </div>
      <p className="vs-hint">Cena completa: {parentSceneDuration.toFixed(1)}s</p>

      <div className="vs-row-2">
        <div>
          <label className="panel-field-label" htmlFor="video-lettering-enter">Entrada</label>
          <select
            id="video-lettering-enter"
            className="field"
            value={displayLettering.enterAnimation ?? 'slide-up'}
            onChange={(event) => onLetteringPatchCommit(
              { enterAnimation: event.target.value as SceneVideoLettering['enterAnimation'] },
              'Animação de entrada',
            )}
          >
            <optgroup label="Clássico">
              <option value="fade">Fade</option>
              <option value="slide-up">Slide ↑ suave</option>
              <option value="slide-left">Slide ← suave</option>
              <option value="zoom">Zoom</option>
              <option value="none">Sem animação</option>
            </optgroup>
            <optgroup label="Moderno">
              <option value="typewriter">Typewriter (digitando)</option>
              <option value="blur-in">Blur-in (fora de foco)</option>
              <option value="bounce">Bounce (pingo)</option>
              <option value="pop">Pop (escala spring)</option>
              <option value="glitch">Glitch (RGB shift)</option>
              <option value="rise">Rise (subir lento)</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label className="panel-field-label" htmlFor="video-lettering-exit">Saída</label>
          <select
            id="video-lettering-exit"
            className="field"
            value={displayLettering.exitAnimation ?? 'fade'}
            onChange={(event) => onLetteringPatchCommit(
              { exitAnimation: event.target.value as SceneVideoLettering['exitAnimation'] },
              'Animação de saída',
            )}
          >
            <optgroup label="Clássico">
              <option value="fade">Fade</option>
              <option value="slide-down">Slide ↓ suave</option>
              <option value="slide-right">Slide → suave</option>
              <option value="zoom">Zoom</option>
              <option value="none">Sem animação</option>
            </optgroup>
            <optgroup label="Moderno">
              <option value="blur-out">Blur-out (perder foco)</option>
              <option value="pop-out">Pop-out (escala)</option>
              <option value="swipe-out">Swipe (varredura)</option>
              <option value="dissolve">Dissolve</option>
            </optgroup>
          </select>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-ghost vs-restore"
        onClick={() => onLetteringPatchCommit({ text: '' }, 'Limpar texto')}
      >
        Limpar texto
      </button>
    </div>
  );
};

export default LetteringPanel;
