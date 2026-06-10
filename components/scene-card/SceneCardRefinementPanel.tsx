import React, { useState } from 'react';
import type { Scene } from '../../types';

interface SceneCardRefinementPanelProps {
  scene: Scene;
  onApplySplitSuggestion?: (id: number) => void;
  onApplyAlternativePrompt?: (id: number) => void;
}

const SceneCardRefinementPanel: React.FC<SceneCardRefinementPanelProps> = ({
  scene,
  onApplySplitSuggestion,
  onApplyAlternativePrompt,
}) => {
  const [showRefinement, setShowRefinement] = useState(false);

  if (scene.isRefining) {
    return (
      <div
        role="status"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: 'rgba(245,158,11,0.07)',
          borderTop: '1px solid rgba(245,158,11,0.18)',
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '2px solid rgba(245,158,11,0.3)', borderTopColor: 'var(--amber)',
          animation: 'spin .7s linear infinite', flexShrink: 0,
        }} aria-hidden="true" />
        <span style={{ fontSize: 11, color: 'var(--amber)' }}>Refinando com IA…</span>
      </div>
    );
  }

  if (!scene.refinement) return null;

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setShowRefinement(v => !v)}
        aria-expanded={showRefinement}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', flex: 1 }}>
          Análise de refinamento
        </span>
        {scene.refinement.needsSplit && (
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.30)',
            color: 'var(--amber)', fontWeight: 600,
          }}>
            Divisão sugerida
          </span>
        )}
        <svg
          width={11} height={11} viewBox="0 0 24 24" fill="none"
          stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: showRefinement ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease', flexShrink: 0 }}
          aria-hidden="true"
        >
          <path d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {showRefinement && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {scene.refinement.needsSplit && scene.refinement.splitSuggestion && (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>
                  Dividir em {scene.refinement.splitSuggestion.length} sub-cenas
                </p>
                {onApplySplitSuggestion && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '3px 8px', color: 'var(--amber)', borderColor: 'rgba(245,158,11,0.30)' }}
                    onClick={() => onApplySplitSuggestion(scene.id)}
                  >
                    Aplicar divisão
                  </button>
                )}
              </div>
              {scene.refinement.splitReason && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.5 }}>
                  {scene.refinement.splitReason}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scene.refinement.splitSuggestion.map((sub, i) => (
                  <div key={i} style={{
                    padding: '7px 10px', borderRadius: 6,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', marginBottom: 3 }}>
                      Sub-cena {i + 1}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 4 }}>
                      {sub.description}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--mono)', lineHeight: 1.4 }}>
                      {sub.prompt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scene.refinement.alternativePrompt && (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.22)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet-text)' }}>
                  Prompt alternativo
                </p>
                {onApplyAlternativePrompt && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '3px 8px', color: 'var(--violet-text)', borderColor: 'rgba(139,92,246,0.30)' }}
                    onClick={() => onApplyAlternativePrompt(scene.id)}
                    title="Trocar o prompt atual pelo alternativo (o atual vira alternativo)"
                  >
                    Aplicar alternativo
                  </button>
                )}
              </div>
              {scene.refinement.alternativeReason && (
                <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
                  {scene.refinement.alternativeReason}
                </p>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
                {scene.refinement.alternativePrompt}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(SceneCardRefinementPanel);
