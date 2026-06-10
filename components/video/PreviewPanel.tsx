import React from 'react';
import { ASPECT_RATIOS, FPS } from './videoStudioConstants';

interface PreviewPanelProps {
  aspectOverride: string;
  showCaptions: boolean;
  totalFrames: number;
  scenesWithoutSelectedImages: number;
  onAspectChange: (aspect: string) => void;
  onShowCaptionsChange: (show: boolean) => void;
  onRestartPreview: () => void;
  panelId: string;
  tabId: string;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  aspectOverride,
  showCaptions,
  totalFrames,
  scenesWithoutSelectedImages,
  onAspectChange,
  onShowCaptionsChange,
  onRestartPreview,
  panelId,
  tabId,
}) => (
  <div className="vs-tab-panel" role="tabpanel" id={panelId} aria-labelledby={tabId}>
    <p className="vs-section-title">Formato</p>
    <label htmlFor="vs-aspect" className="panel-field-label">Aspect ratio</label>
    <select
      id="vs-aspect"
      className="field"
      value={aspectOverride}
      onChange={(event) => onAspectChange(event.target.value)}
    >
      {Object.entries(ASPECT_RATIOS).map(([key, info]) => (
        <option key={key} value={key}>{info.label}</option>
      ))}
    </select>

    <p className="vs-section-title">Captions</p>
    <label className="vs-checkbox">
      <input
        type="checkbox"
        checked={showCaptions}
        onChange={(event) => onShowCaptionsChange(event.target.checked)}
      />
      Exibir lettering
    </label>

    <p className="vs-section-title">Atalhos</p>
    <ul className="vs-shortcuts">
      <li><kbd>Espaço</kbd> Play/Pause</li>
      <li><kbd>←</kbd> / <kbd>→</kbd> Seek ±1s</li>
      <li><kbd>Cmd/Ctrl+Z</kbd> Desfazer</li>
      <li><kbd>Cmd/Ctrl+Shift+Z</kbd> Refazer</li>
    </ul>

    <button
      type="button"
      className="btn btn-primary vs-restart"
      onClick={onRestartPreview}
    >
      Reiniciar preview
    </button>

    <div className="vs-summary">
      <p>Formato: {aspectOverride}</p>
      <p>Timeline: {totalFrames} frames @ {FPS} fps</p>
      {scenesWithoutSelectedImages > 0 && (
        <p className="vs-warning">
          {scenesWithoutSelectedImages} cena{scenesWithoutSelectedImages !== 1 ? 's' : ''} sem
          imagem selecionada não entra{scenesWithoutSelectedImages === 1 ? '' : 'm'} no preview.
        </p>
      )}
    </div>
  </div>
);

export default PreviewPanel;
