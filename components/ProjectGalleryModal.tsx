import React, { useState } from 'react';
import type { Character, Scene } from '../types';
import { XIcon, SparklesIcon, RevertIcon } from './icons';

export interface ProjectImageItem {
  id: string;
  label: string;
  sublabel: string;
  imageUrl: string;
  mimeType: string;
  hasPrevious: boolean;
  previousImageUrl?: string;
  previousMimeType?: string;
  itemType: 'character' | 'scene';
  itemKey: string | number;
}

interface ProjectGalleryModalProps {
  isOpen: boolean;
  characters: Character[];
  scenes: Scene[];
  onClose: () => void;
  onApplyEdit: (
    item: ProjectImageItem,
    sourceUrl: string,
    sourceMimeType: string,
    prompt: string
  ) => Promise<void>;
  isEditing: boolean;
}

const buildImageList = (characters: Character[], scenes: Scene[]): ProjectImageItem[] => {
  const items: ProjectImageItem[] = [];
  characters.forEach(c => {
    if (c.imageUrl && c.imageMimeType) {
      items.push({
        id: `char-${c.name}`, label: c.name, sublabel: 'Personagem',
        imageUrl: c.imageUrl, mimeType: c.imageMimeType,
        hasPrevious: !!(c.previousImageUrl && c.previousImageMimeType),
        previousImageUrl: c.previousImageUrl, previousMimeType: c.previousImageMimeType,
        itemType: 'character', itemKey: c.name,
      });
    }
  });
  scenes.forEach(s => {
    if (s.imageUrl && s.imageMimeType) {
      items.push({
        id: `scene-${s.id}`, label: `Cena ${s.scene_id}-${s.sub_id}`, sublabel: s.original_location,
        imageUrl: s.imageUrl, mimeType: s.imageMimeType,
        hasPrevious: !!(s.previousImageUrl && s.previousImageMimeType),
        previousImageUrl: s.previousImageUrl, previousMimeType: s.previousImageMimeType,
        itemType: 'scene', itemKey: s.id,
      });
    }
  });
  return items;
};

const FILTERS = [
  { key: 'all'        as const, label: (n: number) => `Todas (${n})` },
  { key: 'characters' as const, label: (n: number) => `Personagens (${n})` },
  { key: 'scenes'     as const, label: (n: number) => `Cenas (${n})` },
];

const ProjectGalleryModal: React.FC<ProjectGalleryModalProps> = ({
  isOpen, characters, scenes, onClose, onApplyEdit, isEditing,
}) => {
  const [selectedItem, setSelectedItem]   = useState<ProjectImageItem | null>(null);
  const [showingPrevious, setShowingPrevious] = useState(false);
  const [prompt, setPrompt]               = useState('');
  const [filter, setFilter]               = useState<'all' | 'characters' | 'scenes'>('all');
  const [editError, setEditError]         = useState<string | null>(null);

  if (!isOpen) return null;

  const allItems  = buildImageList(characters, scenes);
  const charCount = allItems.filter(i => i.itemType === 'character').length;
  const sceneCount= allItems.filter(i => i.itemType === 'scene').length;
  const filtered  = filter === 'characters' ? allItems.filter(i => i.itemType === 'character')
                  : filter === 'scenes'     ? allItems.filter(i => i.itemType === 'scene')
                  : allItems;

  const activeUrl      = showingPrevious && selectedItem?.previousImageUrl ? selectedItem.previousImageUrl : selectedItem?.imageUrl;
  const activeMimeType = showingPrevious && selectedItem?.previousMimeType ? selectedItem.previousMimeType : selectedItem?.mimeType;

  const handleSelect = (item: ProjectImageItem) => {
    setSelectedItem(item); setShowingPrevious(false); setPrompt(''); setEditError(null);
  };

  const handleApply = async () => {
    if (!selectedItem || !activeUrl || !activeMimeType || !prompt.trim()) return;
    setEditError(null);
    try {
      await onApplyEdit(selectedItem, activeUrl, activeMimeType, prompt);
      setPrompt('');
    } catch (e: any) {
      setEditError(e.message || 'Erro ao aplicar edição.');
    }
  };

  const filterCounts: Record<string, number> = { all: allItems.length, characters: charCount, scenes: sceneCount };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn .2s ease both',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1000, maxHeight: '92vh',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Galeria do Projeto</p>
            <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
              {allItems.length} imagem{allItems.length !== 1 ? 's' : ''} gerada{allItems.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isEditing}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-3)',
            }}
          >
            <XIcon width={14} height={14} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* Left — grid */}
          <div style={{
            flex: '0 0 60%', display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {/* Filter pills */}
            <div style={{ padding: '10px 14px 8px', display: 'flex', gap: 6, flexShrink: 0 }}>
              {FILTERS.map(f => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    style={{
                      padding: '4px 12px', borderRadius: 99,
                      fontSize: 11, fontWeight: 600,
                      background: active ? 'var(--indigo)' : 'var(--surface-2)',
                      color: active ? '#fff' : 'var(--text-3)',
                      border: active ? '1px solid transparent' : '1px solid var(--border)',
                      cursor: 'pointer', transition: 'all .12s ease',
                    }}
                  >
                    {f.label(filterCounts[f.key])}
                  </button>
                );
              })}
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-4)', fontSize: 13,
              }}>
                Nenhuma imagem nesta categoria.
              </div>
            ) : (
              <div style={{
                flex: 1, overflowY: 'auto', padding: '0 14px 14px',
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                alignContent: 'start',
              }}>
                {filtered.map(item => {
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      style={{
                        position: 'relative', borderRadius: 8, overflow: 'hidden',
                        border: isSelected ? '2px solid var(--indigo)' : '2px solid var(--border)',
                        boxShadow: isSelected ? '0 0 0 3px var(--indigo-s)' : 'none',
                        background: 'var(--surface-2)',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'border-color .12s ease, box-shadow .12s ease',
                        padding: 0,
                      }}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.label}
                        style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                      />

                      {/* Label gradient */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
                        padding: '16px 8px 6px',
                      }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.sublabel}
                        </p>
                      </div>

                      {/* Type badge */}
                      <div style={{ position: 'absolute', top: 5, left: 5 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: item.itemType === 'character' ? 'var(--indigo)' : '#0D9488',
                          color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>
                          {item.itemType === 'character' ? 'Personagem' : 'Cena'}
                        </span>
                      </div>

                      {/* Previous badge */}
                      {item.hasPrevious && (
                        <div style={{ position: 'absolute', top: 5, right: 5 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            background: 'rgba(245,158,11,0.85)', color: '#fff',
                          }}>
                            +anterior
                          </span>
                        </div>
                      )}

                      {/* Selected overlay */}
                      {isSelected && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(99,102,241,0.12)', pointerEvents: 'none',
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right — edit panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 16, overflowY: 'auto' }}>
            {!selectedItem ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 10, color: 'var(--text-4)', textAlign: 'center',
              }}>
                <svg width={40} height={40} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ opacity: 0.4 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p style={{ fontSize: 13 }}>Selecione uma imagem na galeria para editar</p>
              </div>
            ) : (
              <>
                {/* Preview */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="label">Imagem selecionada</span>
                    {selectedItem.hasPrevious && (
                      <button
                        onClick={() => setShowingPrevious(v => !v)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
                          cursor: 'pointer', transition: 'all .12s ease',
                          background: showingPrevious ? 'rgba(245,158,11,0.12)' : 'var(--surface-2)',
                          border: showingPrevious ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border)',
                          color: showingPrevious ? '#FCD34D' : 'var(--text-3)',
                        }}
                      >
                        <RevertIcon width={11} height={11} />
                        {showingPrevious ? 'Versão anterior' : 'Ver anterior'}
                      </button>
                    )}
                  </div>

                  <div style={{
                    position: 'relative', borderRadius: 8, overflow: 'hidden',
                    border: '1px solid var(--border)', background: 'var(--surface-2)',
                  }}>
                    <img
                      src={activeUrl}
                      alt="Selecionada"
                      style={{ width: '100%', maxHeight: 180, objectFit: 'contain', display: 'block' }}
                    />
                    {showingPrevious && (
                      <div style={{
                        position: 'absolute', top: 6, left: 6,
                        background: 'rgba(245,158,11,0.85)', color: '#fff',
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      }}>
                        Versão anterior
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                      background: selectedItem.itemType === 'character' ? 'var(--indigo-s)' : 'rgba(13,148,136,0.12)',
                      color: selectedItem.itemType === 'character' ? '#818CF8' : '#2DD4BF',
                      border: `1px solid ${selectedItem.itemType === 'character' ? 'var(--indigo-b)' : 'rgba(13,148,136,0.3)'}`,
                    }}>
                      {selectedItem.itemType === 'character' ? 'Personagem' : 'Cena'}
                    </span>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{selectedItem.label}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedItem.sublabel}</p>
                  </div>
                </div>

                {/* Prompt */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 100 }}>
                  <label className="label" style={{ marginBottom: 6 }}>O que deseja alterar?</label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    disabled={isEditing}
                    rows={5}
                    placeholder="Ex: mude o fundo para um ambiente noturno, adicione chuva, troque a roupa para camisa vermelha…"
                    className="field"
                    style={{ flex: 1, resize: 'none', fontSize: 12, minHeight: 100 }}
                  />
                </div>

                {showingPrevious && (
                  <p style={{ fontSize: 11, color: '#FCD34D', display: 'flex', alignItems: 'center', gap: 6, marginTop: -8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FCD34D', flexShrink: 0, display: 'inline-block' }} />
                    A edição será aplicada na versão anterior
                  </p>
                )}

                {editError && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 7,
                    background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
                  }}>
                    <p style={{ fontSize: 12, color: 'var(--red)' }}>{editError}</p>
                  </div>
                )}

                <button
                  onClick={handleApply}
                  disabled={isEditing || !prompt.trim()}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '10px 16px' }}
                >
                  {isEditing
                    ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                    : <SparklesIcon width={15} height={15} />}
                  {isEditing ? 'Aplicando edição…' : 'Aplicar Edição'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectGalleryModal;
