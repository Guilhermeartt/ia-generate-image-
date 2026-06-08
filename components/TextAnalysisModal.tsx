import React, { useState } from 'react';
import type { AnalysisModalState, Character, Scene, TextError } from '../types';
import { XIcon } from './icons';

interface TextAnalysisModalProps {
  state: AnalysisModalState | null;
  onClose: () => void;
  /** Fallback: edita a imagem diretamente com inpainting genérico (sem bounding box). */
  onApplyCorrection: (item: Character | Scene, originalText: string, suggestion: string) => void;
  /** Abordagem A: regenera a cena inteira com prompt corrigido. */
  onRegenerateWithCorrection: (item: Character | Scene, originalText: string, correction: string) => void;
  /** Abordagem B: inpainting seletivo na região exata do erro (requer boundingBox). */
  onInpaintCorrection: (item: Character | Scene, error: TextError) => void;
}

/* ── Ícones locais ─────────────────────────────────────────────── */
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const WarnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);
const RegenerateIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
);
const BrushIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 114.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1 1 2.48 1.02 3.5 1.02 2.98 0 5.5-2.56 5.5-5.06 0-1.67-1.34-3-3-3z"/>
  </svg>
);
const EditPencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

/* ── Tooltip de estratégia ─────────────────────────────────────── */
type Strategy = 'A' | 'B' | 'fallback';

const StrategyBadge: React.FC<{ type: Strategy }> = ({ type }) => {
  const map: Record<Strategy, { label: string; color: string; bg: string; border: string; title: string }> = {
    A: {
      label: 'Regenerar',
      color: '#818CF8',
      bg: 'rgba(99,102,241,0.1)',
      border: 'rgba(99,102,241,0.25)',
      title: 'Regenera a cena inteira com prompt corrigido — mais confiável para composição',
    },
    B: {
      label: 'Inpainting',
      color: 'var(--green)',
      bg: 'rgba(16,185,129,0.1)',
      border: 'rgba(16,185,129,0.25)',
      title: 'Corrige apenas a região exata do erro — mais rápido, preserva o restante da imagem',
    },
    fallback: {
      label: 'Edição direta',
      color: 'var(--amber)',
      bg: 'rgba(245,158,11,0.1)',
      border: 'rgba(245,158,11,0.25)',
      title: 'Edição genérica da imagem completa — fallback quando bounding box não está disponível',
    },
  };
  const s = map[type];
  return (
    <span
      title={s.title}
      style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '1px 5px', borderRadius: 4,
        color: s.color, background: s.bg, border: `1px solid ${s.border}`,
        cursor: 'help',
      }}
    >
      {s.label}
    </span>
  );
};

/* ── ErrorRow ──────────────────────────────────────────────────── */
const ErrorRow: React.FC<{
  error: TextError;
  index: number;
  isScene: boolean;
  onRegenerate: (orig: string, sug: string) => void;
  onInpaint: (error: TextError) => void;
  onFallback: (orig: string, sug: string) => void;
  isApplying: boolean;
}> = ({ error, index, isScene, onRegenerate, onInpaint, onFallback, isApplying }) => {
  const [orig, setOrig] = useState(error.originalText);
  const [sug,  setSug]  = useState(error.suggestedCorrection);
  const [open, setOpen]  = useState(false);
  const hasBB  = !!error.boundingBox;
  const canAct = orig.trim().length > 0 && sug.trim().length > 0 && !isApplying;

  return (
    <div style={{
      border: '1px solid var(--border-md)',
      borderRadius: 8,
      overflow: 'hidden',
      background: 'var(--surface-2)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px' }}>
        <span style={{
          flexShrink: 0, minWidth: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', fontSize: 10, fontWeight: 700,
          background: 'rgba(245,158,11,0.15)', color: 'var(--amber)',
          border: '1px solid rgba(245,158,11,0.3)',
        }}>{index + 1}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--red)',
              background: 'rgba(248,113,113,0.08)', padding: '1px 6px', borderRadius: 4,
              textDecoration: 'line-through', wordBreak: 'break-all',
            }}>
              {error.originalText}
            </span>
            <span style={{ color: 'var(--text-4)', fontSize: 11 }}>→</span>
            <span style={{
              fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--green)',
              background: 'rgba(16,185,129,0.08)', padding: '1px 6px', borderRadius: 4,
              wordBreak: 'break-all',
            }}>
              {error.suggestedCorrection}
            </span>
            {hasBB && (
              <span title="Posição detectada — inpainting disponível" style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                color: 'var(--green)', background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)', cursor: 'help',
              }}>
                📍 localizado
              </span>
            )}
          </div>
          {error.explanation && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>
              {error.explanation}
            </p>
          )}
        </div>

        <button
          onClick={() => setOpen(o => !o)}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: 'var(--indigo)', fontWeight: 600,
            background: 'var(--indigo-s)', border: '1px solid var(--indigo-b)',
            borderRadius: 5, padding: '3px 8px', cursor: 'pointer',
          }}
        >
          <EditPencilIcon />
          {open ? 'Fechar' : 'Corrigir'}
        </button>
      </div>

      {/* Expanded correction panel */}
      {open && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {/* Edit fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                Texto errado na imagem
              </label>
              <input
                value={orig}
                onChange={e => setOrig(e.target.value)}
                placeholder="Texto exato na imagem"
                style={{
                  width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-md)',
                  borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--red)',
                  fontFamily: 'var(--mono)', outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                Substituir por
              </label>
              <input
                value={sug}
                onChange={e => setSug(e.target.value)}
                placeholder="Correção"
                style={{
                  width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-md)',
                  borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--green)',
                  fontFamily: 'var(--mono)', outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Strategy buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

            {/* A — Regenerar (scenes only) */}
            {isScene && (
              <button
                onClick={() => onRegenerate(orig, sug)}
                disabled={!canAct}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 7,
                  background: canAct ? 'rgba(99,102,241,0.12)' : 'var(--surface-3)',
                  border: `1px solid ${canAct ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                  color: canAct ? '#A5B4FC' : 'var(--text-4)',
                  cursor: canAct ? 'pointer' : 'not-allowed',
                  fontSize: 12, fontWeight: 600, width: '100%', textAlign: 'left',
                  transition: 'background .15s',
                }}
              >
                <RegenerateIcon />
                <span style={{ flex: 1 }}>
                  {isApplying ? 'Processando…' : 'Regenerar cena com prompt corrigido'}
                </span>
                <StrategyBadge type="A" />
              </button>
            )}

            {/* B — Inpainting seletivo (requer boundingBox) */}
            <button
              onClick={() => onInpaint({ ...error, originalText: orig, suggestedCorrection: sug })}
              disabled={!canAct || !hasBB}
              title={!hasBB ? 'Posição do texto não detectada — use outra estratégia' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 7,
                background: canAct && hasBB ? 'rgba(16,185,129,0.1)' : 'var(--surface-3)',
                border: `1px solid ${canAct && hasBB ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
                color: canAct && hasBB ? 'var(--green)' : 'var(--text-4)',
                cursor: canAct && hasBB ? 'pointer' : 'not-allowed',
                fontSize: 12, fontWeight: 600, width: '100%', textAlign: 'left',
                transition: 'background .15s',
              }}
            >
              <BrushIcon />
              <span style={{ flex: 1 }}>
                {isApplying ? 'Processando…' : hasBB
                  ? 'Corrigir na região exata (inpainting)'
                  : 'Inpainting indisponível — posição não detectada'}
              </span>
              <StrategyBadge type="B" />
            </button>

            {/* Fallback — edição genérica */}
            <button
              onClick={() => onFallback(orig, sug)}
              disabled={!canAct}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 7,
                background: 'var(--surface-3)',
                border: '1px solid var(--border)',
                color: canAct ? 'var(--text-3)' : 'var(--text-4)',
                cursor: canAct ? 'pointer' : 'not-allowed',
                fontSize: 12, fontWeight: 500, width: '100%', textAlign: 'left',
                transition: 'background .15s',
              }}
            >
              <EditPencilIcon />
              <span style={{ flex: 1 }}>
                {isApplying ? 'Processando…' : 'Editar imagem completa (fallback)'}
              </span>
              <StrategyBadge type="fallback" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Main modal ────────────────────────────────────────────────── */
const TextAnalysisModal: React.FC<TextAnalysisModalProps> = ({
  state, onClose, onApplyCorrection, onRegenerateWithCorrection, onInpaintCorrection,
}) => {
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);

  if (!state) return null;
  const { item, result } = state;
  const itemName = 'name' in item ? item.name : `Cena ${item.scene_id}`;
  const isScene  = 'scene_id' in item;

  const errors  = result.errors ?? [];
  const hasErrors = result.errorFound || errors.length > 0;
  const hasText   = (result.transcribedText ?? '').trim().length > 0;

  const withBusy = async (index: number, fn: () => Promise<void> | void) => {
    setApplyingIndex(index);
    try { await fn(); } finally { setApplyingIndex(null); }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 860, maxHeight: '92vh',
          background: 'var(--surface)',
          border: '1px solid var(--border-md)',
          borderRadius: 12,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              ...(hasErrors
                ? { background: 'rgba(245,158,11,0.12)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.25)' }
                : { background: 'rgba(16,185,129,0.12)', color: 'var(--green)',  border: '1px solid rgba(16,185,129,0.25)' }
              ),
            }}>
              {hasErrors ? <WarnIcon /> : <CheckIcon />}
              {hasErrors
                ? `${errors.length} erro${errors.length !== 1 ? 's' : ''} detectado${errors.length !== 1 ? 's' : ''}`
                : 'Sem erros detectados'}
            </div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
              Análise de Texto — <span style={{ color: '#818CF8' }}>{itemName}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'var(--surface-2)', color: 'var(--text-3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflow: 'auto',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
        }}>
          {/* Left: image + transcription */}
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, borderRight: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Imagem analisada
            </p>
            <div style={{
              flex: 1, background: 'var(--surface-2)', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 8, minHeight: 140,
            }}>
              <img
                src={item.imageUrl ?? ''}
                alt={`Imagem de ${itemName}`}
                style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 6 }}
              />
            </div>

            {/* Texto transcrito */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Texto transcrito
              </p>
              <div style={{
                background: 'var(--surface-2)', borderRadius: 8,
                border: '1px solid var(--border)', padding: '10px 12px', minHeight: 44,
              }}>
                {hasText
                  ? <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, fontStyle: 'italic' }}>"{result.transcribedText}"</p>
                  : <p style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <InfoIcon /> Nenhum texto detectado na imagem.
                    </p>
                }
              </div>
            </div>

            {/* Legenda das estratégias */}
            {hasErrors && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', padding: '10px 12px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Estratégias de correção
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { badge: 'A' as const, desc: 'Regenerar — refaz a cena com prompt corrigido. Mais confiável, mas gera nova imagem.' },
                    { badge: 'B' as const, desc: 'Inpainting — corrige só a região exata. Rápido, preserva o resto. Requer localização.' },
                    { badge: 'fallback' as const, desc: 'Edição direta — envia imagem completa para edição. Fallback universal.' },
                  ].map(({ badge, desc }) => (
                    <div key={badge} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <StrategyBadge type={badge} />
                      <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: errors */}
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {errors.length > 0 ? `Erros encontrados (${errors.length})` : 'Resultado da análise'}
            </p>

            {errors.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {errors.map((err, i) => (
                  <ErrorRow
                    key={i}
                    error={err}
                    index={i}
                    isScene={isScene}
                    onRegenerate={(orig, sug) => withBusy(i, () => onRegenerateWithCorrection(item, orig, sug))}
                    onInpaint={(e)            => withBusy(i, () => onInpaintCorrection(item, e))}
                    onFallback={(orig, sug)   => withBusy(i, () => onApplyCorrection(item, orig, sug))}
                    isApplying={applyingIndex === i}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: 24, textAlign: 'center',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)',
                }}>
                  <CheckIcon />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>
                    {hasText ? 'Texto correto' : 'Sem texto na imagem'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                    {hasText
                      ? 'Nenhum erro ortográfico ou gramatical detectado.'
                      : 'Esta imagem não contém texto visível para analisar.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, gap: 8,
        }}>
          {errors.length > 1 && (
            <p style={{ flex: 1, fontSize: 11, color: 'var(--text-3)' }}>
              Expanda cada erro para escolher a estratégia de correção.
            </p>
          )}
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 13 }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextAnalysisModal;
