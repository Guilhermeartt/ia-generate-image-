import React, { useState, useMemo } from 'react';
import type { StoryboardRow } from '../types';

const TIPO_COLORS: Record<string, { bg: string; color: string }> = {
  'Narração':       { bg: 'rgba(99,102,241,0.15)',  color: '#818CF8' },
  'Entrevista':     { bg: 'rgba(52,211,153,0.15)',  color: '#34D399' },
  'B-roll':         { bg: 'rgba(251,191,36,0.15)',  color: '#FBBF24' },
  'Motion Graphics':{ bg: 'rgba(236,72,153,0.15)',  color: '#F472B6' },
  'Animação':       { bg: 'rgba(167,139,250,0.15)', color: '#A78BFA' },
  'Produto':        { bg: 'rgba(34,211,238,0.15)',  color: '#22D3EE' },
  'Depoimento':     { bg: 'rgba(52,211,153,0.15)',  color: '#6EE7B7' },
  'Abertura':       { bg: 'rgba(239,68,68,0.15)',   color: '#F87171' },
  'Encerramento':   { bg: 'rgba(107,114,128,0.15)', color: '#9CA3AF' },
  'Transição':      { bg: 'rgba(156,163,175,0.12)', color: '#6B7280' },
};

interface Props {
  rows: StoryboardRow[];
  fileName?: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

const StoryboardReviewView: React.FC<Props> = ({ rows, fileName = 'storyboard', onConfirm, isLoading }) => {
  const [search, setSearch] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.imagem.toLowerCase().includes(q) ||
      r.locucao.toLowerCase().includes(q) ||
      r.lettering.toLowerCase().includes(q) ||
      r.tipo_cena.toLowerCase().includes(q) ||
      r.local.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const exportCsv = () => {
    const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const header = ['Ordem', 'Local', 'Tipo de Cena', 'Locução', 'Imagem', 'Lettering'];
    const dataRows = rows.map(r => [r.ordem, r.local, r.tipo_cena, r.locucao, r.imagem, r.lettering].map(v => esc(String(v))));
    const csv = [header.map(h => esc(h)), ...dataRows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName.replace(/\.[^.]+$/, '')}_storyboard.csv`;
    a.click();
  };

  const thStyle: React.CSSProperties = {
    padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    background: 'var(--surface-2)', userSelect: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
            Estrutura do Storyboard
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-4)', margin: '4px 0 0' }}>
            {rows.length} {rows.length === 1 ? 'cena identificada' : 'cenas identificadas'} — revise e confirme para iniciar a análise completa.
          </p>
        </div>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="btn btn-primary"
          style={{ fontSize: 13, padding: '9px 20px', flexShrink: 0 }}
        >
          {isLoading ? 'Analisando…' : 'Iniciar análise completa →'}
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar linhas…"
            className="field"
            style={{ paddingLeft: 30, fontSize: 12, width: '100%' }}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
          {filtered.length} de {rows.length}
        </span>
        <button onClick={exportCsv} className="btn btn-ghost" style={{ fontSize: 12, flexShrink: 0 }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 52 }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Local</th>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Locução</th>
              <th style={thStyle}>Imagem</th>
              <th style={thStyle}>Lettering</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-4)' }}>
                  Nenhuma linha encontrada
                </td>
              </tr>
            )}
            {filtered.map((row, i) => {
              const isExpanded = expandedIdx === i;
              const rowBg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)';
              const tipoStyle = TIPO_COLORS[row.tipo_cena] ?? { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-3)' };

              return (
                <React.Fragment key={i}>
                  <tr
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    style={{
                      background: isExpanded ? 'rgba(99,102,241,0.06)' : rowBg,
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                    }}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = rowBg; }}
                  >
                    {/* # */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', fontSize: 12, color: 'var(--text-4)', fontFamily: 'var(--mono)', textAlign: 'center' }}>
                      {row.ordem}
                    </td>
                    {/* Local */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {row.local || <span style={{ color: 'var(--text-4)' }}>—</span>}
                      </span>
                    </td>
                    {/* Tipo */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      {row.tipo_cena ? (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
                          background: tipoStyle.bg, color: tipoStyle.color,
                          border: `1px solid ${tipoStyle.color}33`, whiteSpace: 'nowrap',
                        }}>
                          {row.tipo_cena}
                        </span>
                      ) : <span style={{ fontSize: 10, color: 'var(--text-4)' }}>—</span>}
                    </td>
                    {/* Locução */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <p style={{
                        fontSize: 11, color: 'var(--text-3)', lineHeight: 1.55, fontStyle: 'italic', margin: 0,
                        display: '-webkit-box', WebkitLineClamp: isExpanded ? undefined : 3,
                        WebkitBoxOrient: 'vertical', overflow: isExpanded ? 'visible' : 'hidden',
                      }}>
                        {row.locucao || <span style={{ color: 'var(--text-4)', fontStyle: 'normal' }}>—</span>}
                      </p>
                    </td>
                    {/* Imagem */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <p style={{
                        fontSize: 11, color: 'var(--text-2)', lineHeight: 1.55, margin: 0,
                        display: '-webkit-box', WebkitLineClamp: isExpanded ? undefined : 3,
                        WebkitBoxOrient: 'vertical', overflow: isExpanded ? 'visible' : 'hidden',
                      }}>
                        {row.imagem || <span style={{ color: 'var(--text-4)' }}>—</span>}
                      </p>
                    </td>
                    {/* Lettering */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      {row.lettering ? (
                        <span style={{
                          fontSize: 11, fontFamily: 'var(--mono)', color: '#FBBF24',
                          background: 'rgba(251,191,36,0.08)', padding: '2px 6px', borderRadius: 4,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {row.lettering}
                        </span>
                      ) : <span style={{ fontSize: 10, color: 'var(--text-4)' }}>—</span>}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr style={{ background: 'rgba(99,102,241,0.04)', borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={6} style={{ padding: '0 12px 14px 12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, paddingTop: 10 }}>
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Locução completa</p>
                            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, fontStyle: 'italic', borderLeft: '2px solid rgba(99,102,241,0.4)', paddingLeft: 10, margin: 0 }}>
                              {row.locucao || '—'}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Descrição visual</p>
                            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>{row.imagem || '—'}</p>
                          </div>
                          {row.lettering && (
                            <div>
                              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Lettering</p>
                              <p style={{ fontSize: 12, fontFamily: 'var(--mono)', color: '#FBBF24', lineHeight: 1.65, margin: 0 }}>{row.lettering}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'right', margin: 0 }}>
        Clique em uma linha para expandir. Quando estiver pronto, clique em "Iniciar análise completa".
      </p>
    </div>
  );
};

export default StoryboardReviewView;
