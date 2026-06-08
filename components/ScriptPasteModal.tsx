import React, { useEffect, useState, useMemo } from 'react';
import type { CsvRow } from '../types';
import { convertScriptToScenes } from '../services/geminiService';
import { SparklesIcon, XIcon } from './icons';

interface ScriptPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileReady: (file: File) => void;
  maxScenesLimit?: number;
  promptTemplate?: string;
}

const escapeCsv = (value: string): string => {
  const safe = String(value ?? '');
  if (/[",\n\r;]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
};

const rowsToCsv = (rows: CsvRow[]): string => {
  const header = ['scene_id', 'sub_id', 'order', 'loc', 'context', 'style'];
  const lines = rows.map(row => [
    row.scene_id,
    row.sub_id,
    row.order,
    row.loc,
    row.context,
    row.style || '',
  ].map(escapeCsv).join(','));
  return [header.join(','), ...lines].join('\n');
};

const EXAMPLE_SCRIPT = `CENA 1 - INT. APARTAMENTO - NOITE
Maria, 34 anos, observa a chuva pela janela. A sala tem luz baixa e uma mala aberta no chão. Paulo entra em silêncio segurando uma carta antiga.

CENA 2 - EXT. RUA - NOITE
Maria caminha rápido sob letreiros refletidos no asfalto molhado. Paulo aparece atrás dela, tentando explicar o conteúdo da carta.

CENA 3 - INT. ESTAÇÃO DE TREM - MADRUGADA
Os dois param diante da plataforma vazia. Maria decide partir, mas antes entrega a Paulo uma fotografia rasgada.`;

const TIPS = [
  {
    icon: (
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    title: 'Qualquer formato',
    text: 'Roteiros numerados, texto corrido, briefings, sinopses — a IA entende tudo.',
  },
  {
    icon: (
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4"/>
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      </svg>
    ),
    title: 'Nomeie personagens',
    text: 'Mencione nomes e características físicas para gerar perfis visuais consistentes.',
  },
  {
    icon: (
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
    title: 'Descreva ambientes',
    text: 'Locais com horário e atmosfera ajudam a criar cenas com luz e enquadramento ideais.',
  },
  {
    icon: (
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
    title: 'Revise depois',
    text: 'Cada cena gerada pode ser editada individualmente antes de gerar imagens.',
  },
];

/** Heuristic: estimate how many scenes a script might produce */
const estimateScenes = (text: string): number => {
  if (!text.trim()) return 0;
  const sceneMarkers = (text.match(/\b(cena|scene|ext\.|int\.|ato|act)\b/gi) || []).length;
  const paragraphs = text.trim().split(/\n{2,}/).filter(p => p.trim().length > 30).length;
  const raw = Math.max(sceneMarkers, Math.ceil(paragraphs * 0.8));
  return Math.max(1, raw);
};

const LoadingDots: React.FC = () => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const i = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 480);
    return () => clearInterval(i);
  }, []);
  return <span>{dots}</span>;
};

const ScriptPasteModal: React.FC<ScriptPasteModalProps> = ({
  isOpen, onClose, onFileReady, maxScenesLimit = 20, promptTemplate,
}) => {
  const [scriptText, setScriptText] = useState('');
  const [maxScenes, setMaxScenes] = useState(Math.min(80, maxScenesLimit));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMaxScenes(prev => Math.min(prev, maxScenesLimit));
  }, [maxScenesLimit]);

  const charCount = scriptText.trim().length;
  const wordCount = useMemo(() => scriptText.trim().split(/\s+/).filter(Boolean).length, [scriptText]);
  const estimatedScenes = useMemo(() => estimateScenes(scriptText), [scriptText]);
  const isReady = charCount >= 40;

  if (!isOpen) return null;

  const handleConvert = async () => {
    setIsLoading(true);
    setError('');
    try {
      const rows = await convertScriptToScenes(scriptText, maxScenes, promptTemplate);
      const csv = rowsToCsv(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const file = new File([blob], `roteiro_estruturado_${Date.now()}.csv`, { type: 'text/csv' });
      onFileReady(file);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao estruturar roteiro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.72)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card" style={{
        width: 'min(940px, 100%)', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(79,140,255,0.14)', border: '1px solid rgba(79,140,255,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--indigo)', flexShrink: 0,
          }}>
            <SparklesIcon width={15} height={15} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
              Roteiro livre
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
              Cole qualquer texto — a IA estrutura as cenas automaticamente.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fechar">
            <XIcon width={14} height={14} />
          </button>
        </div>

        {/* ── Body: 2-col on wide, 1-col on narrow ── */}
        <div style={{
          display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0,
        }}>
          {/* Left: textarea + controls */}
          <div style={{
            flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column',
            gap: 12, overflowY: 'auto', minWidth: 0,
          }}>
            {/* Textarea header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <label className="label" style={{ marginBottom: 0 }}>Roteiro</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {charCount > 0 && (
                  <span style={{
                    fontSize: 10, color: 'var(--text-4)',
                    fontFamily: 'var(--mono)', padding: '2px 6px',
                    background: 'var(--surface-2)', borderRadius: 4,
                    border: '1px solid var(--border)',
                  }}>
                    {wordCount.toLocaleString('pt-BR')} palavras
                  </span>
                )}
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => setScriptText(EXAMPLE_SCRIPT)}
                  title="Carregar exemplo"
                >
                  Exemplo
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => setScriptText('')}
                  disabled={!scriptText}
                >
                  Limpar
                </button>
              </div>
            </div>

            <textarea
              value={scriptText}
              onChange={e => setScriptText(e.target.value)}
              className="field"
              rows={14}
              placeholder="Cole o roteiro aqui — texto corrido, cenas numeradas, briefing narrativo ou qualquer formato..."
              style={{
                resize: 'vertical', minHeight: 240,
                transition: 'border-color .2s ease',
                borderColor: isReady ? 'rgba(79,140,255,0.4)' : undefined,
              }}
              disabled={isLoading}
              autoFocus
            />

            {/* Live estimate strip */}
            {charCount >= 40 && !isLoading && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(79,140,255,0.07)',
                border: '1px solid rgba(79,140,255,0.20)',
              }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span style={{ fontSize: 12, color: 'var(--text-3)', flex: 1 }}>
                  Estimativa: <strong style={{ color: 'var(--text-1)' }}>~{Math.min(estimatedScenes, maxScenes)} cenas</strong>
                  {' '}— a IA vai detalhar cada uma com local, contexto e estilo.
                </span>
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(79,140,255,0.08)',
                border: '1px solid rgba(79,140,255,0.22)',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: '2px solid rgba(79,140,255,0.3)',
                  borderTopColor: 'var(--indigo)',
                  animation: 'spin .8s linear infinite', flexShrink: 0,
                }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                    Estruturando roteiro com IA<LoadingDots />
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                    Isso pode levar alguns segundos dependendo do tamanho do texto.
                  </p>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && !isLoading && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderLeft: '3px solid #F87171',
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#F87171' }}>Erro ao processar</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.5 }}>{error}</p>
                </div>
              </div>
            )}

            {/* Limit control */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
            }}>
              <div style={{ flexShrink: 0 }}>
                <label className="label" style={{ marginBottom: 4 }}>Limite de cenas</label>
                <input
                  value={maxScenes}
                  type="number"
                  min={5}
                  max={maxScenesLimit}
                  onChange={e => setMaxScenes(Math.max(5, Math.min(maxScenesLimit, Number(e.target.value) || maxScenesLimit)))}
                  className="field"
                  style={{ width: 80 }}
                  disabled={isLoading}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.5 }}>
                Limite atual: <strong style={{ color: 'var(--text-2)' }}>{maxScenesLimit} cenas</strong>.
                Aumente no seu plano ou use sua própria chave de API.
              </p>
            </div>
          </div>

          {/* Right: tips panel (hidden on narrow) */}
          <div style={{
            width: 220, flexShrink: 0, padding: '16px 14px',
            borderLeft: '1px solid var(--border)', overflowY: 'auto',
            background: 'var(--surface-2)',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}
            className="script-tips-panel"
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-4)' }}>
              Dicas
            </p>
            {TIPS.map((tip, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    display: 'inline-flex', width: 22, height: 22,
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: 6, background: 'var(--surface-3)',
                    border: '1px solid var(--border)', color: 'var(--indigo)', flexShrink: 0,
                  }}>
                    {tip.icon}
                  </span>
                  <strong style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 600 }}>{tip.title}</strong>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5, paddingLeft: 29 }}>
                  {tip.text}
                </p>
              </div>
            ))}

            {/* Supported formats */}
            <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 8 }}>
                Formatos aceitos
              </p>
              {['Roteiro numerado', 'Texto corrido', 'Briefing narrativo', 'Argumento de filme', 'Storyboard textual'].map(fmt => (
                <div key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 8, flexShrink: 0,
        }}>
          <p style={{ fontSize: 11, color: 'var(--text-4)', flex: 1 }}>
            {isReady
              ? `${charCount.toLocaleString('pt-BR')} caracteres prontos para processar.`
              : 'Cole seu roteiro acima para continuar.'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={isLoading}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConvert}
              disabled={isLoading || !isReady}
              style={isReady && !isLoading ? { boxShadow: '0 0 12px rgba(79,140,255,0.3)' } : {}}
            >
              <SparklesIcon width={13} height={13} />
              {isLoading ? 'Estruturando…' : 'Estruturar roteiro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptPasteModal;
