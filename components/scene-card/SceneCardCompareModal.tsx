import React, { useCallback, useEffect, useRef, useState } from 'react';

interface SceneCardCompareModalProps {
  previousUrl: string;
  currentUrl: string;
  onClose: () => void;
}

const SceneCardCompareModal: React.FC<SceneCardCompareModalProps> = ({
  previousUrl,
  currentUrl,
  onClose,
}) => {
  const [mode, setMode] = useState<'slider' | 'side-by-side'>('slider');
  const [position, setPosition] = useState(50);
  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const positionFromClientX = useCallback((clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setPosition(ratio * 100);
  }, []);

  return (
    <div
      className="sc-compare-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Comparar versões da imagem"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sc-compare-wrap">
        <div className="sc-compare-head">
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
            Comparar versões
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar comparação"
            style={{
              padding: 4, background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          ref={stageRef}
          className="sc-compare-stage"
          style={{ aspectRatio: '16/9' }}
          onPointerDown={(event) => {
            if (mode !== 'slider') return;
            draggingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            positionFromClientX(event.clientX);
          }}
          onPointerMove={(event) => {
            if (!draggingRef.current || mode !== 'slider') return;
            positionFromClientX(event.clientX);
          }}
          onPointerUp={(event) => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
          }}
        >
          {mode === 'slider' ? (
            <>
              <img src={previousUrl} alt="Versão anterior" className="sc-compare-img" />
              <img
                src={currentUrl}
                alt="Versão atual"
                className="sc-compare-img is-overlay"
                style={{ ['--clip' as string]: `inset(0 ${100 - position}% 0 0)` } as React.CSSProperties}
              />
              <div className="sc-compare-divider" style={{ left: `${position}%` }} />
              <div className="sc-compare-handle" style={{ left: `${position}%` }} role="separator" aria-valuemin={0} aria-valuemax={100} aria-valuenow={position} aria-orientation="vertical" />
              <span className="sc-compare-side-label" style={{ top: 10, left: 10 }}>Antes</span>
              <span className="sc-compare-side-label" style={{ top: 10, right: 10, left: 'auto' }}>Depois</span>
            </>
          ) : (
            <div className="sc-compare-side-by-side">
              <div>
                <span className="sc-compare-side-label">Anterior</span>
                <img src={previousUrl} alt="Versão anterior" />
              </div>
              <div>
                <span className="sc-compare-side-label">Atual</span>
                <img src={currentUrl} alt="Versão atual" />
              </div>
            </div>
          )}
        </div>

        <div className="sc-compare-foot">
          <div className="sc-compare-mode-toggle" role="group" aria-label="Modo de comparação">
            <button
              type="button"
              className={mode === 'slider' ? 'is-active' : ''}
              onClick={() => setMode('slider')}
              aria-pressed={mode === 'slider'}
            >
              Slider
            </button>
            <button
              type="button"
              className={mode === 'side-by-side' ? 'is-active' : ''}
              onClick={() => setMode('side-by-side')}
              aria-pressed={mode === 'side-by-side'}
            >
              Lado a lado
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-4)' }}>
            Esc para fechar
          </p>
        </div>
      </div>
    </div>
  );
};

export default SceneCardCompareModal;
