import React, { useState } from 'react';
import type { Scene } from '../types';

interface SceneLetteringProps {
  scene: Scene;
  onIncludeLetteringChange?: (id: number, include: boolean) => void;
}

/**
 * Painel "Lettering indicado": exibe as notas de lettering da cena, permite
 * alternar se serão renderizadas na imagem e copiá-las. Extraído do SceneCard;
 * retorna null quando a cena não tem lettering.
 */
const SceneLettering: React.FC<SceneLetteringProps> = ({ scene, onIncludeLetteringChange }) => {
  const [copied, setCopied] = useState(false);
  const letteringNotes = scene.lettering_notes ?? [];

  if (letteringNotes.length === 0) return null;

  const includeLettering = scene.includeLettering !== false;

  const handleCopy = async () => {
    const text = letteringNotes.join('\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '9px 10px',
        marginBottom: 10,
        borderRadius: 8,
        background: includeLettering ? 'rgba(245,158,11,0.08)' : 'rgba(120,120,120,0.06)',
        border: `1px solid ${includeLettering ? 'rgba(245,158,11,0.22)' : 'var(--border)'}`,
        opacity: includeLettering ? 1 : 0.72,
        transition: 'background .15s, border-color .15s, opacity .15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: includeLettering ? '#FCD34D' : 'var(--text-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              margin: 0,
            }}
          >
            Lettering indicado
          </p>
          {!includeLettering && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--text-4)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '1px 5px',
                borderRadius: 3,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
              }}
            >
              Removido da imagem
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {letteringNotes.map((note, index) => {
            const isListItem = /^\s*(?:[•·*\-–—]|\d+[.)])\s+\S/.test(note);
            return (
              <p
                key={`${note}-${index}`}
                style={{
                  fontSize: 11,
                  color: includeLettering ? 'var(--text-2)' : 'var(--text-4)',
                  textDecoration: includeLettering ? 'none' : 'line-through',
                  lineHeight: 1.45,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  paddingLeft: isListItem ? 6 : 0,
                  fontFamily: isListItem ? 'var(--mono)' : 'inherit',
                }}
                title={note}
              >
                {note}
              </p>
            );
          })}
        </div>
      </div>
      {onIncludeLetteringChange && (
        <button
          type="button"
          role="switch"
          aria-checked={includeLettering}
          onClick={() => onIncludeLetteringChange(scene.id, !includeLettering)}
          title={
            includeLettering
              ? 'Lettering será renderizado na imagem. Clique para remover.'
              : 'Lettering NÃO será renderizado. Clique para incluir.'
          }
          style={{
            flexShrink: 0,
            width: 30,
            height: 18,
            borderRadius: 999,
            border: '1px solid',
            borderColor: includeLettering ? 'rgba(245,158,11,0.55)' : 'var(--border)',
            background: includeLettering ? 'rgba(245,158,11,0.45)' : 'var(--surface-2)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background .15s, border-color .15s',
            padding: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 1,
              left: includeLettering ? 13 : 1,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: includeLettering ? '#FBBF24' : 'var(--text-4)',
              transition: 'left .15s, background .15s',
            }}
          />
        </button>
      )}
      <button
        onClick={handleCopy}
        className="btn btn-ghost"
        style={{ fontSize: 11, padding: '5px 8px', flexShrink: 0 }}
        title="Copiar indicação de lettering"
      >
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
};

export default SceneLettering;
