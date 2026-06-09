import React, { useState } from 'react';
import type { Scene } from '../types';
import { EditIcon, DownloadIcon } from './icons';
import Spinner from './ui/Spinner';
import { modelLabelShort } from '../utils/imageHelpers';

interface SceneSplitGridProps {
  scene: Scene;
  onClearSplit: () => void;
  onPreview: (url: string) => void;
  /** Quando presente, exibe o botão de editar cada plano. */
  onEditSplit?: (split: { id: string; imageUrl: string }) => void;
}

/**
 * Grade de planos gerados ao dividir uma cena: miniaturas com preview, editar
 * (via callback — o modal de edição vive no SceneCard) e download. Detém apenas
 * o estado de hover. Retorna null sem planos.
 */
const SceneSplitGrid: React.FC<SceneSplitGridProps> = ({ scene, onClearSplit, onPreview, onEditSplit }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!scene.splitImages || scene.splitImages.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: 6, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="9" height="18" rx="1" />
            <rect x="13" y="3" width="9" height="18" rx="1" />
          </svg>
          Planos gerados ({scene.splitImages.length})
        </p>
        <button
          onClick={onClearSplit}
          style={{ fontSize: 11, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color .12s' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-4)')}
        >
          ✕ Limpar
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {scene.splitImages.map((img, idx) => (
          <div
            key={img.id}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              position: 'relative',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              aspectRatio: '16/9',
            }}
          >
            {img.isLoading ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Spinner size={14} />
                <p style={{ fontSize: 10, color: 'var(--text-4)' }}>Plano {idx + 1}</p>
              </div>
            ) : img.error ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>Erro</p>
                <p style={{ fontSize: 10, color: 'rgba(248,113,113,0.5)', marginTop: 2 }}>{img.error}</p>
              </div>
            ) : img.imageUrl ? (
              <>
                <button
                  onClick={() => onPreview(img.imageUrl!)}
                  style={{ display: 'block', width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}
                >
                  <img
                    src={img.imageUrl}
                    alt={`Plano ${idx + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      transition: 'transform .3s ease',
                      transform: hoveredIdx === idx ? 'scale(1.04)' : 'scale(1)',
                    }}
                  />
                </button>

                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 55%)',
                    padding: '0 6px 6px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    opacity: hoveredIdx === idx ? 1 : 0,
                    transition: 'opacity .15s ease',
                    pointerEvents: 'none',
                  }}
                >
                  <p style={{ fontSize: 10, color: '#fff', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {img.prompt}
                  </p>
                </div>

                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    display: 'flex',
                    gap: 3,
                    opacity: hoveredIdx === idx ? 1 : 0,
                    transition: 'opacity .15s',
                  }}
                >
                  {onEditSplit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSplit({ id: img.id, imageUrl: img.imageUrl! });
                      }}
                      title="Editar imagem"
                      style={{ padding: 4, borderRadius: 5, background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', transition: 'background .12s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.75)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.65)')}
                    >
                      <EditIcon width={11} height={11} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const ext = (img.imageMimeType ?? 'image/png').split('/')[1] || 'png';
                      const link = document.createElement('a');
                      link.href = img.imageUrl!;
                      link.download = `Cena_${scene.scene_id}-${scene.sub_id}_plano_${idx + 1}.${ext}`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    title="Baixar"
                    style={{ padding: 4, borderRadius: 5, background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', transition: 'background .12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16,185,129,0.75)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.65)')}
                  >
                    <DownloadIcon width={11} height={11} />
                  </button>
                </div>

                <div style={{ position: 'absolute', top: 4, left: 4, display: 'flex', gap: 3, alignItems: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.65)', color: '#fff', fontFamily: 'var(--mono)' }}>
                    {idx + 1}
                  </span>
                  {(img.modelUsed || img.costBRL !== undefined) && (
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {img.modelUsed && <span style={{ color: '#A5B4FC', fontWeight: 700 }}>{modelLabelShort(img.modelUsed)}</span>}
                      {img.costBRL !== undefined && (
                        <span style={{ color: '#34D399', fontFamily: 'var(--mono)' }}>R${img.costBRL.toFixed(3).replace('.', ',')}</span>
                      )}
                    </span>
                  )}
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SceneSplitGrid;
