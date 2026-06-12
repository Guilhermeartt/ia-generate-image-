import React from 'react';
import type { GradientSpec, GradientStop } from './types';

interface GradientEditorProps {
  spec: GradientSpec;
  onChange: (spec: GradientSpec) => void;
}

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

const hexToRgba = (hex: string, opacity: number): string => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const int = Number.parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${clampUnit(opacity)})`;
};

// Xadrez para enxergar transparência atrás do degradê.
const CHECKER =
  'repeating-conic-gradient(rgba(255,255,255,0.10) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px';

const cssPreview = (spec: GradientSpec): string => {
  const stops = [...spec.stops]
    .sort((left, right) => left.offset - right.offset)
    .map((stop) => `${hexToRgba(stop.color, stop.opacity)} ${Math.round(clampUnit(stop.offset) * 100)}%`)
    .join(', ');
  // SVG: 0°=→, 90°=↓. CSS: 0deg=↑, 90deg=→. CSS = svg + 90.
  const gradient =
    spec.type === 'radial'
      ? `radial-gradient(circle, ${stops})`
      : `linear-gradient(${spec.angle + 90}deg, ${stops})`;
  return `${gradient}, ${CHECKER}`;
};

const GradientEditor: React.FC<GradientEditorProps> = ({ spec, onChange }) => {
  const patch = (changes: Partial<GradientSpec>) => onChange({ ...spec, ...changes });

  const updateStop = (index: number, changes: Partial<GradientStop>) =>
    patch({ stops: spec.stops.map((stop, i) => (i === index ? { ...stop, ...changes } : stop)) });

  const addStop = () =>
    patch({ stops: [...spec.stops, { offset: 0.5, color: '#ffffff', opacity: 1 }] });

  const removeStop = (index: number) => {
    if (spec.stops.length <= 2) return;
    patch({ stops: spec.stops.filter((_, i) => i !== index) });
  };

  return (
    <div className="svg-editor-gradient">
      <div className="svg-editor-gradient-preview" style={{ background: cssPreview(spec) }} />

      <div className="svg-editor-button-row">
        {(['linear', 'radial'] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={`svg-editor-text-button${spec.type === type ? ' active' : ''}`}
            onClick={() => patch({ type })}
          >
            {type === 'linear' ? 'Linear' : 'Radial'}
          </button>
        ))}
      </div>

      {spec.type === 'linear' && (
        <label className="svg-editor-inline-field">
          <span>Ângulo</span>
          <input
            type="number"
            min="0"
            max="360"
            value={spec.angle}
            onChange={(event) => patch({ angle: Number(event.target.value) || 0 })}
          />
        </label>
      )}

      <div className="svg-editor-gradient-stops">
        {spec.stops.map((stop, index) => (
          <div className="svg-editor-gradient-stop" key={index}>
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(stop.color) ? stop.color : '#000000'}
              aria-label={`Cor da parada ${index + 1}`}
              onChange={(event) => updateStop(index, { color: event.target.value })}
            />
            <label className="svg-editor-gradient-offset">
              <input
                type="number"
                min="0"
                max="100"
                value={Math.round(clampUnit(stop.offset) * 100)}
                aria-label={`Posição da parada ${index + 1}`}
                onChange={(event) => updateStop(index, { offset: clampUnit(Number(event.target.value) / 100) })}
              />
              <span>%</span>
            </label>
            <button
              type="button"
              className="svg-editor-mini-button"
              disabled={spec.stops.length <= 2}
              title="Remover parada"
              aria-label={`Remover parada ${index + 1}`}
              onClick={() => removeStop(index)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="svg-editor-text-button wide" onClick={addStop}>
        + Adicionar parada
      </button>
    </div>
  );
};

export default GradientEditor;
