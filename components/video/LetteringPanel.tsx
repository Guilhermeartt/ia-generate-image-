import React, { useRef, useState } from 'react';
import type {
  Scene,
  SceneVideoLettering,
  VideoCgChamferSide,
  VideoLogoPosition,
} from '@/types';
import type { StoryboardVideoScene } from './StoryboardComposition';
import type { SceneVideoImageSource } from './videoScenes';
import LetteringStyleCards from './LetteringStyleCards';
import { ColorOpacityField, RangeField } from './VideoStudioControls';
import {
  CHAMFER_SIDE_OPTIONS,
  LETTERING_TEMPLATE_PATCH,
  LOGO_POSITION_OPTIONS,
} from './videoStudioConstants';

/** Lê um arquivo de imagem e devolve um data URL reduzido (máx. 480px) para manter o payload pequeno. */
const fileToScaledDataUrl = (file: File, maxDim = 480): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode-failed'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('no-ctx')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

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

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const isCgBox = displayLettering.style === 'cg-box';

  const handleLogoFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setLogoError('Use uma imagem (PNG, JPG ou SVG).'); return; }
    if (file.size > 3 * 1024 * 1024) { setLogoError('Logo acima de 3MB. Use um arquivo menor.'); return; }
    try {
      const dataUrl = await fileToScaledDataUrl(file);
      setLogoError(null);
      onLetteringPatchCommit({ logoUrl: dataUrl }, 'Logo do quadro');
    } catch {
      setLogoError('Falha ao carregar a logo. Tente outro arquivo.');
    }
  };

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

      {isCgBox && (
        <>
          <p className="vs-section-title">Quadro CG</p>
          <div className="vs-row-2">
            <div>
              <label className="panel-field-label" htmlFor="cg-chamfer-side">Chanfro</label>
              <select
                id="cg-chamfer-side"
                className="field"
                value={displayLettering.chamferSide ?? 'none'}
                onChange={(event) => onLetteringPatchCommit(
                  { chamferSide: event.target.value as VideoCgChamferSide },
                  'Lado do chanfro',
                )}
              >
                {CHAMFER_SIDE_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <RangeField
              id="cg-chamfer-size"
              label="Profundidade"
              min={0}
              max={60}
              step={2}
              value={displayLettering.chamferSize ?? 0}
              onChange={(value) => onLetteringPatchPreview({ chamferSize: value })}
              onCommit={(value) => onLetteringPatchCommit({ chamferSize: value }, 'Profundidade do chanfro')}
              format={(value) => `${value}%`}
            />
          </div>

          <p className="vs-section-title">Logo</p>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            aria-label="Enviar logo do quadro"
            onChange={(event) => { handleLogoFile(event.target.files?.[0]); event.target.value = ''; }}
          />
          {displayLettering.logoUrl ? (
            <div className="vs-cg-logo-row">
              <img src={displayLettering.logoUrl} alt="Logo do quadro CG" className="vs-cg-logo-thumb" />
              <button type="button" className="btn btn-ghost" onClick={() => logoInputRef.current?.click()}>
                Trocar
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onLetteringPatchCommit({ logoUrl: undefined }, 'Remover logo')}
              >
                Remover
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%' }}
              onClick={() => logoInputRef.current?.click()}
            >
              Enviar logo (PNG/JPG)
            </button>
          )}
          {logoError && <p className="vs-hint" style={{ color: 'var(--red-text, #f87171)' }}>{logoError}</p>}

          {displayLettering.logoUrl && (
            <div className="vs-row-2">
              <div>
                <label className="panel-field-label" htmlFor="cg-logo-position">Posição do logo</label>
                <select
                  id="cg-logo-position"
                  className="field"
                  value={displayLettering.logoPosition ?? 'bottom-right'}
                  onChange={(event) => onLetteringPatchCommit(
                    { logoPosition: event.target.value as VideoLogoPosition },
                    'Posição do logo',
                  )}
                >
                  {LOGO_POSITION_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
              <RangeField
                id="cg-logo-size"
                label="Tamanho do logo"
                min={2}
                max={40}
                step={1}
                value={displayLettering.logoSizePercent ?? 16}
                onChange={(value) => onLetteringPatchPreview({ logoSizePercent: value })}
                onCommit={(value) => onLetteringPatchCommit({ logoSizePercent: value }, 'Tamanho do logo')}
                format={(value) => `${value}%`}
              />
            </div>
          )}

          <p className="vs-section-title">Posição livre (qualquer lado/altura)</p>
          <RangeField
            id="cg-offset-x"
            label="Horizontal"
            min={-50}
            max={50}
            step={1}
            value={displayLettering.offsetXPercent ?? 0}
            onChange={(value) => onLetteringPatchPreview({ offsetXPercent: value })}
            onCommit={(value) => onLetteringPatchCommit({ offsetXPercent: value }, 'Ajuste horizontal')}
            format={(value) => `${value > 0 ? '+' : ''}${value}%`}
          />
          <RangeField
            id="cg-offset-y"
            label="Vertical"
            min={-50}
            max={50}
            step={1}
            value={displayLettering.offsetYPercent ?? 0}
            onChange={(value) => onLetteringPatchPreview({ offsetYPercent: value })}
            onCommit={(value) => onLetteringPatchCommit({ offsetYPercent: value }, 'Ajuste vertical')}
            format={(value) => `${value > 0 ? '+' : ''}${value}%`}
          />
        </>
      )}

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
