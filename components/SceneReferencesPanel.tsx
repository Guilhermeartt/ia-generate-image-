import React, { useRef, useState } from 'react';
import type { SceneReference, SceneReferenceKind } from '../types';

type RefKindMeta = {
  label: string;
  short: string;
  hint: string;
  targetPlaceholder: string;
  color: string;
  bg: string;
  border: string;
};

export const REF_KIND_META: Record<SceneReferenceKind, RefKindMeta> = {
  spatial: {
    label: 'Espacial',
    short: 'ESP',
    hint: 'Influencia composição, cenário, enquadramento e profundidade. Não copia literalmente — orienta o espaço.',
    targetPlaceholder: 'Onde aplicar (ex: cenário, fundo, layout do ambiente)',
    color: '#A5B4FC',
    bg: 'rgba(99,102,241,0.12)',
    border: 'rgba(99,102,241,0.40)',
  },
  object: {
    label: 'Objeto',
    short: 'OBJ',
    hint: 'Insere um elemento localizado preservando identidade visual. Não reestrutura a cena nem vira estilo global.',
    targetPlaceholder: 'Onde inserir (ex: sobre a mesa, na mão da pessoa, na parede)',
    color: '#FCD34D',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.45)',
  },
  screen: {
    label: 'Tela',
    short: 'TELA',
    hint: 'Conteúdo a aparecer APENAS dentro de uma tela já presente na cena (celular, tablet, notebook, monitor). Preserva moldura e ambiente.',
    targetPlaceholder: 'Em qual tela (ex: tela do tablet, monitor do notebook, celular na mão)',
    color: '#5EEAD4',
    bg: 'rgba(20,184,166,0.10)',
    border: 'rgba(20,184,166,0.45)',
  },
};

export const REF_KINDS: SceneReferenceKind[] = ['spatial', 'object', 'screen'];

interface SceneReferencesPanelProps {
  references: SceneReference[];
  onChange: (updater: (current: SceneReference[] | undefined) => SceneReference[] | undefined) => void;
  disabled?: boolean;
}

const SceneReferencesPanel: React.FC<SceneReferencesPanelProps> = ({ references, onChange, disabled = false }) => {
  const fileEl = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const enabledCount = references.filter(r => r.enabled !== false).length;

  const addFromFiles = (files: FileList | null) => {
    if (!files) return;
    const items = Array.from(files).filter(f =>
      ['image/png', 'image/jpeg', 'image/webp'].includes(f.type)
    );
    items.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        const [hdr, b64] = dataUrl.split(',');
        const mime = hdr.match(/:(.*?);/)?.[1] || file.type;
        const newRef: SceneReference = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label: file.name.replace(/\.[^.]+$/, '').slice(0, 40),
          base64Data: b64,
          mimeType: mime,
          previewUrl: dataUrl,
          kind: 'object',
          enabled: true,
        };
        onChange(current => [...(current ?? []), newRef]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    if (!disabled) setIsDragging(true);
  };
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    if (disabled) return;
    addFromFiles(event.dataTransfer.files);
  };

  const removeRef = (refId: string) => {
    onChange(current => (current ?? []).filter(r => r.id !== refId));
    if (editingId === refId) setEditingId(null);
  };
  const toggleRef = (refId: string) => {
    onChange(current =>
      (current ?? []).map(r => (r.id === refId ? { ...r, enabled: r.enabled === false ? true : false } : r))
    );
  };
  const updateField = (refId: string, patch: Partial<SceneReference>) => {
    onChange(current =>
      (current ?? []).map(r => (r.id === refId ? { ...r, ...patch } : r))
    );
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        padding: '9px 10px',
        borderRadius: 8,
        background: isDragging
          ? 'rgba(245,158,11,0.12)'
          : enabledCount > 0 ? 'rgba(245,158,11,0.07)' : 'var(--surface-2)',
        border: `1px solid ${isDragging ? 'rgba(245,158,11,0.58)' : enabledCount > 0 ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`,
        transition: 'background .15s, border-color .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: references.length > 0 ? 8 : 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={enabledCount > 0 ? '#FCD34D' : 'var(--text-4)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          <p style={{
            fontSize: 10, fontWeight: 800,
            color: enabledCount > 0 ? '#FCD34D' : 'var(--text-4)',
            textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0,
          }}>
            Referências da cena
          </p>
          {references.length > 0 && (
            <span style={{
              fontSize: 10, fontFamily: 'var(--mono)',
              color: enabledCount > 0 ? '#FCD34D' : 'var(--text-4)',
              padding: '0 5px', borderRadius: 4,
              background: enabledCount > 0 ? 'rgba(245,158,11,0.18)' : 'var(--surface-3)',
            }}>
              {enabledCount}/{references.length}
            </span>
          )}
        </div>
        <button
          onClick={() => fileEl.current?.click()}
          disabled={disabled}
          style={{
            fontSize: 11, color: 'var(--amber)',
            background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            padding: 0, opacity: disabled ? 0.5 : 1, fontWeight: 600,
          }}
          title="Adicione imagens de objetos, logos ou referências externas que serão sempre incluídas ao gerar esta cena"
        >
          + Adicionar
        </button>
        <input
          ref={fileEl}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={e => { addFromFiles(e.target.files); if (e.target) e.target.value = ''; }}
          style={{ display: 'none' }}
        />
      </div>

      {references.length === 0 ? (
        <div
          onClick={() => !disabled && fileEl.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'rgba(245,158,11,0.72)' : 'rgba(245,158,11,0.22)'}`,
            borderRadius: 7,
            padding: '8px 10px',
            textAlign: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: isDragging ? 'rgba(245,158,11,0.08)' : 'transparent',
            transition: 'background .15s, border-color .15s',
          }}
          onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = 'rgba(245,158,11,0.45)'; }}
          onMouseLeave={e => (e.currentTarget.style.borderColor = isDragging ? 'rgba(245,158,11,0.72)' : 'rgba(245,158,11,0.22)')}
        >
          <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5, margin: 0 }}>
            {isDragging ? (
              <span style={{ color: 'var(--amber)' }}>Solte as imagens aqui para adicionar como referência.</span>
            ) : (
              <>
                <span style={{ color: 'var(--amber)' }}>Adicione objetos, logos ou imagens externas</span>
                {' '}para incluir nesta cena toda vez que ela for gerada.
              </>
            )}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {references.map((ref, i) => {
            const isEnabled = ref.enabled !== false;
            const isEditing = editingId === ref.id;
            const kind = (ref.kind ?? 'object') as SceneReferenceKind;
            const meta = REF_KIND_META[kind];
            return (
              <div
                key={ref.id}
                style={{
                  position: 'relative',
                  width: isEditing ? '100%' : 64,
                  borderRadius: 8,
                  border: `1px solid ${isEnabled ? meta.border : 'var(--border)'}`,
                  background: isEnabled ? meta.bg : 'var(--surface)',
                  overflow: 'hidden',
                  transition: 'border-color .15s, background .15s',
                }}
              >
                <div style={{ display: 'flex', gap: 8, padding: isEditing ? 8 : 0, alignItems: 'flex-start' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={() => setEditingId(prev => prev === ref.id ? null : ref.id)}
                      title={`${meta.label}${ref.label ? ' · ' + ref.label : ''}`}
                      style={{
                        width: isEditing ? 56 : 62,
                        height: isEditing ? 42 : 46,
                        padding: 0,
                        border: 'none',
                        cursor: 'pointer',
                        background: 'var(--surface-3)',
                        display: 'block',
                        opacity: isEnabled ? 1 : 0.45,
                        filter: isEnabled ? 'none' : 'grayscale(1)',
                      }}
                    >
                      <img
                        src={ref.previewUrl}
                        alt={ref.label || `Ref ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </button>
                    <span style={{
                      position: 'absolute', top: -5, left: -5,
                      width: 15, height: 15, borderRadius: '50%',
                      background: isEnabled ? meta.color : 'var(--text-4)',
                      color: '#0a0a12', fontSize: 9, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--mono)',
                    }}>
                      {i + 1}
                    </span>
                    <span
                      title={meta.hint}
                      style={{
                        position: 'absolute', bottom: -5, right: -5,
                        padding: '1px 4px', borderRadius: 4,
                        background: '#0a0a12',
                        color: isEnabled ? meta.color : 'var(--text-4)',
                        border: `1px solid ${isEnabled ? meta.border : 'var(--border)'}`,
                        fontSize: 8, fontWeight: 800, letterSpacing: '0.05em',
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {meta.short}
                    </span>
                  </div>

                  {isEditing && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                      <div>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                          {REF_KINDS.map(k => {
                            const km = REF_KIND_META[k];
                            const isSel = k === kind;
                            return (
                              <button
                                key={k}
                                onClick={() => updateField(ref.id, { kind: k })}
                                disabled={disabled}
                                title={km.hint}
                                style={{
                                  flex: 1, fontSize: 10, fontWeight: 700,
                                  padding: '4px 6px', borderRadius: 5,
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  background: isSel ? km.bg : 'var(--surface)',
                                  color: isSel ? km.color : 'var(--text-3)',
                                  border: `1px solid ${isSel ? km.border : 'var(--border)'}`,
                                  letterSpacing: '0.02em',
                                  transition: 'background .12s, color .12s, border-color .12s',
                                }}
                              >
                                {km.label}
                              </button>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.4, margin: 0 }}>
                          {meta.hint}
                        </p>
                      </div>

                      <input
                        type="text"
                        value={ref.label ?? ''}
                        placeholder="Rótulo (ex: logo da marca, caneca, dashboard)"
                        onChange={e => updateField(ref.id, { label: e.target.value })}
                        disabled={disabled}
                        className="field"
                        style={{ fontSize: 11, padding: '4px 6px' }}
                      />
                      <input
                        type="text"
                        value={ref.target ?? ''}
                        placeholder={meta.targetPlaceholder}
                        onChange={e => updateField(ref.id, { target: e.target.value })}
                        disabled={disabled}
                        className="field"
                        style={{ fontSize: 11, padding: '4px 6px' }}
                      />
                      <textarea
                        value={ref.blendNote ?? ''}
                        placeholder="Observação opcional (ex: discreto, perspectiva frontal, manter brilho de tela)"
                        onChange={e => updateField(ref.id, { blendNote: e.target.value })}
                        disabled={disabled}
                        rows={2}
                        className="field"
                        style={{ fontSize: 11, padding: '4px 6px', resize: 'none' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          fontSize: 11, color: 'var(--text-3)', cursor: disabled ? 'not-allowed' : 'pointer',
                        }}>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => toggleRef(ref.id)}
                            disabled={disabled}
                            style={{ width: 12, height: 12, accentColor: meta.color, cursor: 'pointer' }}
                          />
                          Usar na próxima geração
                        </label>
                        <button
                          onClick={() => removeRef(ref.id)}
                          disabled={disabled}
                          style={{
                            marginLeft: 'auto', fontSize: 11, color: 'var(--red)',
                            background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', padding: 0,
                          }}
                          title="Remover esta referência"
                        >
                          Remover
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            fontSize: 11, color: 'var(--text-4)',
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          }}
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', gap: 4 }}>
                    <button
                      onClick={() => toggleRef(ref.id)}
                      disabled={disabled}
                      title={isEnabled ? 'Clique para desativar' : 'Clique para ativar'}
                      style={{
                        fontSize: 9, fontWeight: 700,
                        background: 'none', border: 'none',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        color: isEnabled ? meta.color : 'var(--text-4)',
                        padding: 0, letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isEnabled ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() => removeRef(ref.id)}
                      disabled={disabled}
                      title="Remover"
                      style={{
                        fontSize: 11, color: 'var(--text-4)',
                        background: 'none', border: 'none',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        padding: '0 2px',
                      }}
                      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.color = 'var(--red)'; }}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-4)')}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!editingId && (
            <button
              onClick={() => fileEl.current?.click()}
              disabled={disabled}
              title="Adicionar mais referências"
              style={{
                width: 62, height: 46, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                border: '2px dashed rgba(245,158,11,0.3)', background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(245,158,11,0.6)', fontSize: 18,
              }}
            >
              +
            </button>
          )}
        </div>
      )}

      {references.length > 0 && (() => {
        const counts: Record<SceneReferenceKind, number> = { spatial: 0, object: 0, screen: 0 };
        references
          .filter(r => r.enabled !== false)
          .forEach(r => { counts[(r.kind ?? 'object') as SceneReferenceKind]++; });
        const summaryParts = REF_KINDS
          .filter(k => counts[k] > 0)
          .map(k => `${counts[k]} ${REF_KIND_META[k].label.toLowerCase()}${counts[k] > 1 ? 's' : ''}`);
        return (
          <p style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 6, lineHeight: 1.45 }}>
            {enabledCount > 0
              ? <>✦ <span style={{ color: '#FCD34D' }}>{summaryParts.join(' · ')}</span> — cada papel é aplicado isoladamente (espacial não copia literal, objeto é localizado, tela vai só dentro do display). Clique na miniatura para editar.</>
              : 'Nenhuma referência ativa — clique em ON para ativar.'}
          </p>
        );
      })()}
    </div>
  );
};

export default SceneReferencesPanel;
