import React, { useState, useMemo } from 'react';
import type { Scene } from '../types';

interface Props {
  scenes: Scene[];
  fileName?: string;
}

const SceneTableView: React.FC<Props> = ({ scenes, fileName = 'cenas' }) => {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<'order' | 'scene_id' | 'location' | 'style'>('order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scenes
      .filter(s =>
        !q ||
        s.original_location.toLowerCase().includes(q) ||
        s.original_description.toLowerCase().includes(q) ||
        s.image_prompt.toLowerCase().includes(q) ||
        (s.detected_characters ?? []).some(c => c.toLowerCase().includes(q)) ||
        `${s.scene_id}.${s.sub_id}`.includes(q)
      )
      .sort((a, b) => {
        let va: string | number = a[sortCol === 'location' ? 'original_location' : sortCol] as any;
        let vb: string | number = b[sortCol === 'location' ? 'original_location' : sortCol] as any;
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [scenes, search, sortCol, sortDir]);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const exportCsv = () => {
    const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const header = ['Cena', 'Ordem', 'Local', 'Trecho Original', 'Personagens', 'Estilo Visual', 'Tipo de Plano', 'Prompt de Imagem', 'Tem Imagem'];
    const rows = scenes.map(s => [
      `${s.scene_id}.${s.sub_id}`,
      s.order,
      s.original_location,
      s.original_description,
      (s.detected_characters ?? []).join(', '),
      s.prompt_json?.visual_style?.style_family || s.sceneGraphicStyle?.label || '',
      s.style,
      s.image_prompt,
      s.imageUrl ? 'Sim' : 'Não',
    ].map(v => esc(String(v))));
    const csv = [header.map(h => esc(h)), ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName.replace(/\.[^.]+$/, '')}_cenas.csv`;
    a.click();
  };

  const SortIcon: React.FC<{ col: typeof sortCol }> = ({ col }) => {
    if (sortCol !== col) return (
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.25 }}>
        <line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 5 19 12"/>
      </svg>
    );
    return sortDir === 'asc' ? (
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 5 19 12"/>
      </svg>
    ) : (
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 19 19 12"/>
      </svg>
    );
  };

  const thStyle: React.CSSProperties = {
    padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    background: 'var(--surface-2)', cursor: 'pointer', userSelect: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

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
            placeholder="Filtrar cenas…"
            className="field"
            style={{ paddingLeft: 30, fontSize: 12, width: '100%' }}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
          {filtered.length} de {scenes.length}
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
            <col style={{ width: 64 }} />
            <col style={{ width: 48 }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '38%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: 52 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle} onClick={() => toggleSort('scene_id')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Cena <SortIcon col="scene_id" /></span>
              </th>
              <th style={thStyle} onClick={() => toggleSort('order')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}># <SortIcon col="order" /></span>
              </th>
              <th style={thStyle} onClick={() => toggleSort('location')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Local <SortIcon col="location" /></span>
              </th>
              <th style={{ ...thStyle, cursor: 'default' }}>Trecho do roteiro</th>
              <th style={{ ...thStyle, cursor: 'default' }}>Personagens</th>
              <th style={thStyle} onClick={() => toggleSort('style')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Visual / Plano <SortIcon col="style" /></span>
              </th>
              <th style={{ ...thStyle, cursor: 'default', textAlign: 'center' }}>IMG</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-4)' }}>
                  Nenhuma cena encontrada
                </td>
              </tr>
            )}
            {filtered.map((scene, i) => {
              const isExpanded = expandedId === scene.id;
              const rowBg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)';
              const characters = scene.detected_characters ?? [];
              const sceneLabel = `${scene.scene_id}.${scene.sub_id}`;
              const visualStyle = scene.prompt_json?.visual_style?.style_family || scene.sceneGraphicStyle?.label || '';
              const shotType = scene.prompt_json?.camera?.shot_type || scene.style;

              return (
                <React.Fragment key={scene.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : scene.id)}
                    style={{
                      background: isExpanded ? 'rgba(99,102,241,0.06)' : rowBg,
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                    }}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = rowBg; }}
                  >
                    {/* Cena */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                        color: '#818CF8', background: 'rgba(99,102,241,0.12)',
                        padding: '2px 7px', borderRadius: 5,
                      }}>
                        {sceneLabel}
                      </span>
                    </td>
                    {/* Ordem */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', fontSize: 12, color: 'var(--text-4)', fontFamily: 'var(--mono)' }}>
                      {scene.order}
                    </td>
                    {/* Local */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 500, color: 'var(--text-2)',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {scene.original_location}
                      </span>
                    </td>
                    {/* Trecho */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <p style={{
                        fontSize: 11, color: 'var(--text-3)', lineHeight: 1.55,
                        display: '-webkit-box', WebkitLineClamp: isExpanded ? undefined : 3,
                        WebkitBoxOrient: 'vertical', overflow: isExpanded ? 'visible' : 'hidden',
                        fontStyle: 'italic',
                      }}>
                        {scene.original_description}
                      </p>
                    </td>
                    {/* Personagens */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {characters.length === 0
                          ? <span style={{ fontSize: 10, color: 'var(--text-4)' }}>—</span>
                          : characters.map(c => (
                            <span key={c} style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                              background: 'rgba(52,211,153,0.12)', color: '#34D399',
                              border: '1px solid rgba(52,211,153,0.2)', whiteSpace: 'nowrap',
                            }}>
                              {c}
                            </span>
                          ))
                        }
                      </div>
                    </td>
                    {/* Visual / Plano */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      {visualStyle || shotType ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          {visualStyle && (
                            <span style={{ fontSize: 11, color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {visualStyle}
                            </span>
                          )}
                          {shotType && (
                            <span style={{ fontSize: 10, color: 'var(--text-4)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {shotType}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-4)' }}>—</span>
                      )}
                    </td>
                    {/* IMG */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', textAlign: 'center' }}>
                      {scene.imageUrl
                        ? <img src={scene.imageUrl} alt="" style={{ width: 36, height: 24, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                        : <span style={{ fontSize: 10, color: 'var(--text-4)' }}>—</span>
                      }
                    </td>
                  </tr>

                  {/* Expanded row: full details */}
                  {isExpanded && (
                    <tr style={{ background: 'rgba(99,102,241,0.04)', borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={7} style={{ padding: '0 12px 14px 12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 10 }}>
                          {/* Trecho completo */}
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                              Trecho completo do roteiro
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, fontStyle: 'italic', borderLeft: '2px solid rgba(99,102,241,0.4)', paddingLeft: 10 }}>
                              {scene.original_description}
                            </p>
                          </div>
                          {/* Prompt de imagem */}
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                              Prompt de imagem
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, fontFamily: 'var(--mono)', background: 'var(--surface-2)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                              {scene.image_prompt || '—'}
                            </p>
                          </div>
                        </div>
                        {scene.imageUrl && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                              Imagem gerada
                            </p>
                            <img src={scene.imageUrl} alt={`Cena ${sceneLabel}`} style={{ height: 80, borderRadius: 6, border: '1px solid var(--border)', objectFit: 'cover' }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <p style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'right' }}>
        Clique em uma linha para ver o trecho completo e o prompt gerado.
      </p>
    </div>
  );
};

export default SceneTableView;
