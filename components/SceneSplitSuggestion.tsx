import React from 'react';
import type { Scene } from '../types';

interface SceneSplitSuggestionProps {
  scene: Scene;
  onOpenSplit: () => void;
}

/**
 * Aviso "Subcena recomendada": aparece quando a IA sugere dividir a cena.
 * Mostra o motivo e um botão para abrir o modal de divisão. Extraído do
 * SceneCard; retorna null quando não há sugestão.
 */
const SceneSplitSuggestion: React.FC<SceneSplitSuggestionProps> = ({ scene, onOpenSplit }) => {
  if (!scene.suggests_split) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '9px 10px',
        marginBottom: 10,
        borderRadius: 8,
        background: 'rgba(245,158,11,0.07)',
        border: '1px solid rgba(245,158,11,0.22)',
      }}
    >
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <rect x="2" y="3" width="9" height="18" rx="1" />
        <rect x="13" y="3" width="9" height="18" rx="1" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: '#FCD34D',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 2,
          }}
        >
          Subcena recomendada
        </p>
        {scene.split_reason && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.45 }}>{scene.split_reason}</p>
        )}
      </div>
      <button
        onClick={onOpenSplit}
        className="btn btn-ghost"
        style={{
          fontSize: 11,
          padding: '4px 8px',
          color: '#F59E0B',
          borderColor: 'rgba(245,158,11,0.30)',
          flexShrink: 0,
        }}
      >
        Dividir
      </button>
    </div>
  );
};

export default SceneSplitSuggestion;
