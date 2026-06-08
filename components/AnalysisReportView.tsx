import React, { useEffect, useRef, useState } from 'react';
import type { Character, Scene } from '../types';

interface Props {
  characters: Character[];
  scenes: Scene[];
  fileName: string;
  globalStyle: string;
  onContinue: () => void;
  onNavigate?: (view: 'characters' | 'scenes' | 'costs') => void;
}

const COLLAPSED_LIMIT = 6;

const ScenesList: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const visible = expanded ? scenes : scenes.slice(0, COLLAPSED_LIMIT);
  const hasMore = scenes.length > COLLAPSED_LIMIT;

  const handleExpand = () => {
    setExpanded(true);
  };

  const handleCollapse = () => {
    setExpanded(false);
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <div ref={listRef} style={{ marginBottom: 44 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-4)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Cenas do roteiro
        </p>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{scenes.length} total</span>
      </div>

      {/* Scene rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible.map((scene, i) => (
          (() => {
            const visualStyle = scene.prompt_json?.visual_style?.style_family || scene.sceneGraphicStyle?.label || '';
            const shotType = scene.prompt_json?.camera?.shot_type || scene.style;
            const styleLabel = [visualStyle, shotType].filter(Boolean).join(' · ');

            return (
          <div
            key={scene.id}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '10px 16px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              opacity: !expanded && i >= COLLAPSED_LIMIT - 1 && hasMore ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {/* Order badge */}
            <span style={{
              flexShrink: 0, marginTop: 1,
              fontSize: 10, fontWeight: 700, color: 'var(--text-4)',
              background: 'var(--surface-3)', border: '1px solid var(--border-md)',
              borderRadius: 5, padding: '2px 7px', minWidth: 28, textAlign: 'center',
            }}>
              #{scene.order}
            </span>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
                marginBottom: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {scene.original_location}
              </p>
              <p style={{
                fontSize: 11, color: 'var(--text-4)', lineHeight: 1.45,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as any,
                overflow: 'hidden',
              }}>
                {scene.original_description}
              </p>
            </div>

            {/* Style badge */}
            {styleLabel && (
              <span style={{
                flexShrink: 0,
                fontSize: 10, color: 'var(--text-4)',
                background: 'var(--surface-3)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '2px 6px',
                whiteSpace: 'nowrap', marginTop: 1,
              }}>
                {styleLabel}
              </span>
            )}
          </div>
            );
          })()
        ))}
      </div>

      {/* Expand / collapse */}
      {hasMore && (
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          {expanded ? (
            <button
              onClick={handleCollapse}
              style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--text-3)', cursor: 'pointer',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '7px 20px',
                transition: 'all 0.12s',
              }}
            >
              ↑ Recolher
            </button>
          ) : (
            <button
              onClick={handleExpand}
              style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--indigo)', cursor: 'pointer',
                background: 'var(--indigo-s)', border: '1px solid var(--indigo-b)',
                borderRadius: 8, padding: '7px 20px',
                transition: 'all 0.12s',
              }}
            >
              Ver todas as {scenes.length} cenas ↓
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const AVATAR_COLORS = [
  { bg: 'linear-gradient(135deg,#4F8CFF,#7B5FF5)', border: 'rgba(79,140,255,0.4)' },
  { bg: 'linear-gradient(135deg,#FB7185,#C94094)', border: 'rgba(251,113,133,0.4)' },
  { bg: 'linear-gradient(135deg,#10B981,#22D3EE)', border: 'rgba(16,185,129,0.4)' },
  { bg: 'linear-gradient(135deg,#F59E0B,#F97316)', border: 'rgba(245,158,11,0.4)' },
  { bg: 'linear-gradient(135deg,#8B5CF6,#EC4899)', border: 'rgba(139,92,246,0.4)' },
  { bg: 'linear-gradient(135deg,#22D3EE,#4F8CFF)', border: 'rgba(34,211,238,0.4)' },
];

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return undefined;
    const steps = 30;
    const step = target / steps;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

const AnalysisReportView: React.FC<Props> = ({ characters, scenes, fileName, globalStyle, onContinue, onNavigate }) => {
  const sceneCount = useCountUp(scenes.length, 700);
  const charCount = useCountUp(characters.length, 900);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: '40px 24px 64px',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(16px)',
      transition: 'opacity 0.4s ease, transform 0.4s ease',
    }}>

      {/* ── Hero header ── */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        {/* Decorative clapperboard icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #4F8CFF 0%, #8B5CF6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: 28,
          boxShadow: '0 8px 32px rgba(79,140,255,0.35)',
        }}>
          🎬
        </div>

        <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8, letterSpacing: '-0.02em' }}>
          Roteiro analisado
        </p>
        <p style={{
          fontSize: 13, color: 'var(--text-4)',
          maxWidth: 360, margin: '0 auto',
          lineHeight: 1.6,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {fileName}
        </p>

        {globalStyle && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 14, padding: '5px 14px',
            background: 'var(--indigo-s)',
            border: '1px solid var(--indigo-b)',
            borderRadius: 20, fontSize: 12,
            color: 'var(--indigo)', fontWeight: 600,
          }}>
            🎨 {globalStyle}
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 40 }}>
        {/* Scenes tile */}
        <div style={{
          padding: '28px 28px',
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(79,140,255,0.12) 0%, rgba(79,140,255,0.04) 100%)',
          border: '1px solid rgba(79,140,255,0.2)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -20, right: -20,
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(79,140,255,0.08)',
          }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--indigo)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Cenas
          </p>
          <p style={{ fontSize: 52, fontWeight: 900, color: 'var(--text-1)', lineHeight: 1, letterSpacing: '-0.04em', marginBottom: 6 }}>
            {sceneCount}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-4)' }}>
            cena{scenes.length !== 1 ? 's' : ''} identificada{scenes.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Characters tile */}
        <div style={{
          padding: '28px 28px',
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 100%)',
          border: '1px solid rgba(139,92,246,0.2)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -20, right: -20,
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(139,92,246,0.08)',
          }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Personagens
          </p>
          <p style={{ fontSize: 52, fontWeight: 900, color: 'var(--text-1)', lineHeight: 1, letterSpacing: '-0.04em', marginBottom: 6 }}>
            {charCount}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-4)' }}>
            personagem{characters.length !== 1 ? 's' : ''} encontrado{characters.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Characters ── */}
      {characters.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <p style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-4)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Personagens identificados
            </p>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {characters.map((char, i) => {
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const initials = char.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              const firstScene = char.firstSceneOrder != null
                ? scenes.find(s => s.order === char.firstSceneOrder)
                : scenes.find(s =>
                    s.tagged_description?.toLowerCase().includes(char.name.toLowerCase()) ||
                    s.original_description?.toLowerCase().includes(char.name.toLowerCase())
                  );

              return (
                <div
                  key={char.name}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 16,
                    padding: '16px 20px',
                    borderRadius: 14,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    transition: 'border-color 0.12s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: color.bg,
                    border: `1.5px solid ${color.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, color: '#fff',
                    letterSpacing: '-0.02em',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}>
                    {initials || '?'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Name row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                        {char.name}
                      </p>

                      {/* Presence badge */}
                      {char.character_type === 'citado' ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 700,
                          color: 'var(--text-4)',
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border-md)',
                          borderRadius: 20, padding: '2px 8px',
                          whiteSpace: 'nowrap', letterSpacing: '0.02em',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-4)', display: 'inline-block' }} />
                          Citado
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 700,
                          color: '#10B981',
                          background: 'rgba(16,185,129,0.1)',
                          border: '1px solid rgba(16,185,129,0.25)',
                          borderRadius: 20, padding: '2px 8px',
                          whiteSpace: 'nowrap', letterSpacing: '0.02em',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                          Personagem
                        </span>
                      )}

                      {firstScene && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 600,
                          color: 'var(--text-4)',
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border-md)',
                          borderRadius: 5, padding: '2px 7px',
                          whiteSpace: 'nowrap',
                        }}>
                          <span style={{ opacity: 0.7 }}>cena</span> {firstScene.order}
                          <span style={{
                            display: 'inline-block', width: 1, height: 10,
                            background: 'var(--border-md)', margin: '0 2px',
                          }} />
                          {firstScene.original_location}
                        </span>
                      )}
                    </div>

                    {/* Origin / characteristics */}
                    <p style={{
                      fontSize: 12, color: 'var(--text-3)',
                      lineHeight: 1.55,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as any,
                      overflow: 'hidden',
                    }}>
                      {char.origin ?? char.physical_characteristics}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Scenes list ── */}
      {scenes.length > 0 && (
        <ScenesList scenes={scenes} />
      )}

      {/* ── CTA ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        padding: '32px 24px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)',
        border: '1px solid var(--border-md)',
      }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
          Pronto para começar a produção
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
          Navegue para a seção desejada ou abra o projeto completo
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <button
            onClick={() => { onContinue(); onNavigate?.('characters'); }}
            className="btn btn-ghost"
            style={{ fontSize: 13, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
              <circle cx="19" cy="11" r="2"/><path d="M23 21v-1a2 2 0 0 0-2-2h-1"/>
            </svg>
            Personagens
            <span style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 99 }}>
              {characters.length}
            </span>
          </button>
          <button
            onClick={() => { onContinue(); onNavigate?.('scenes'); }}
            className="btn btn-ghost"
            style={{ fontSize: 13, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18"/>
              <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
            </svg>
            Cenas
            <span style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 99 }}>
              {scenes.length}
            </span>
          </button>
          <button
            onClick={() => { onContinue(); onNavigate?.('costs'); }}
            className="btn btn-ghost"
            style={{ fontSize: 13, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Custos
          </button>
        </div>
        <button
          onClick={onContinue}
          className="btn btn-primary"
          style={{ fontSize: 13, padding: '10px 24px' }}
        >
          Abrir projeto completo →
        </button>
      </div>
    </div>
  );
};

export default AnalysisReportView;
