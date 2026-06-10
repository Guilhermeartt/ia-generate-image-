import React, { useRef } from 'react';
import type { VideoLetteringStyle } from '@/types';

export interface LetteringStyleOption {
  id: VideoLetteringStyle;
  label: string;
  description: string;
}

export const LETTERING_STYLE_OPTIONS: LetteringStyleOption[] = [
  { id: 'cinematic', label: 'Cinematográfico', description: 'Texto solto sobre gradiente inferior.' },
  { id: 'box', label: 'Caixa legível', description: 'Bloco escuro com blur — alta legibilidade.' },
  { id: 'clean', label: 'Texto limpo', description: 'Texto centralizado sem caixa.' },
  { id: 'title', label: 'Título central', description: 'Caixa alta gigante, abertura.' },
  { id: 'lower-third', label: 'Lower third', description: 'Faixa com barra colorida — telejornal.' },
  { id: 'glass', label: 'Glassmorphism', description: 'Vidro fosco com blur intenso — iOS.' },
  { id: 'neon', label: 'Neon', description: 'Brilho ciano/magenta — vibrante.' },
  { id: 'subtitle', label: 'Legenda Netflix', description: 'Branca, sombra dura, sem fundo.' },
  { id: 'marker', label: 'Marca-texto', description: 'Rabisco amarelo atrás do texto preto.' },
  { id: 'gradient', label: 'Gradiente', description: 'Texto com fill em gradiente colorido.' },
  { id: 'outline', label: 'Contorno', description: 'Stroke sem preenchimento — hollow.' },
];

interface LetteringStyleCardsProps {
  value: VideoLetteringStyle;
  onChange: (style: VideoLetteringStyle) => void;
}

const StylePreview: React.FC<{ style: VideoLetteringStyle }> = ({ style }) => {
  if (style === 'title') {
    return (
      <div className="vs-style-preview vs-style-preview-title" aria-hidden="true">
        <span>TÍTULO</span>
      </div>
    );
  }
  if (style === 'box') {
    return (
      <div className="vs-style-preview vs-style-preview-box" aria-hidden="true">
        <div className="vs-style-preview-box-bg">Texto</div>
      </div>
    );
  }
  if (style === 'lower-third') {
    return (
      <div className="vs-style-preview vs-style-preview-lower-third" aria-hidden="true">
        <div className="vs-style-preview-lt-bar" />
        <div className="vs-style-preview-lt-text">
          <span>Linha 1</span>
          <span>Linha 2</span>
        </div>
      </div>
    );
  }
  if (style === 'clean') {
    return (
      <div className="vs-style-preview vs-style-preview-clean" aria-hidden="true">
        <span>Texto limpo</span>
      </div>
    );
  }
  if (style === 'glass') {
    return (
      <div className="vs-style-preview vs-style-preview-glass" aria-hidden="true">
        <div className="vs-style-preview-glass-bg">Glass</div>
      </div>
    );
  }
  if (style === 'neon') {
    return (
      <div className="vs-style-preview vs-style-preview-neon" aria-hidden="true">
        <span>NEON</span>
      </div>
    );
  }
  if (style === 'subtitle') {
    return (
      <div className="vs-style-preview vs-style-preview-subtitle" aria-hidden="true">
        <span>Legenda</span>
      </div>
    );
  }
  if (style === 'marker') {
    return (
      <div className="vs-style-preview vs-style-preview-marker" aria-hidden="true">
        <span>destaque</span>
      </div>
    );
  }
  if (style === 'gradient') {
    return (
      <div className="vs-style-preview vs-style-preview-gradient" aria-hidden="true">
        <span>Cores</span>
      </div>
    );
  }
  if (style === 'outline') {
    return (
      <div className="vs-style-preview vs-style-preview-outline" aria-hidden="true">
        <span>OUTLINE</span>
      </div>
    );
  }
  return (
    <div className="vs-style-preview vs-style-preview-cinematic" aria-hidden="true">
      <span>Texto cinematográfico</span>
    </div>
  );
};

const LetteringStyleCards: React.FC<LetteringStyleCardsProps> = ({ value, onChange }) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusByIndex = (index: number) => {
    const clamped = (index + LETTERING_STYLE_OPTIONS.length) % LETTERING_STYLE_OPTIONS.length;
    refs.current[clamped]?.focus();
    onChange(LETTERING_STYLE_OPTIONS[clamped].id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusByIndex(index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusByIndex(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusByIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusByIndex(LETTERING_STYLE_OPTIONS.length - 1);
    }
  };

  return (
    <div
      className="vs-style-cards"
      role="radiogroup"
      aria-label="Estilo do lettering"
    >
      {LETTERING_STYLE_OPTIONS.map((option, index) => {
        const isSelected = option.id === value;
        const labelId = `vs-style-card-${option.id}-label`;
        const descId = `vs-style-card-${option.id}-desc`;
        return (
          <button
            key={option.id}
            ref={(el) => { refs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-labelledby={labelId}
            aria-describedby={descId}
            tabIndex={isSelected ? 0 : -1}
            className={`vs-style-card${isSelected ? ' is-selected' : ''}`}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <StylePreview style={option.id} />
            {isSelected && <span className="vs-style-card-check" aria-hidden="true">✓</span>}
            <span id={labelId} className="vs-style-card-label">{option.label}</span>
            <span id={descId} className="vs-style-card-desc">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
};

export default LetteringStyleCards;
