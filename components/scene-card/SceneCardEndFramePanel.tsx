import React from 'react';
import type { Scene } from '../../types';
import Spinner from '../ui/Spinner';
import { DownloadIcon } from '../icons';

interface SceneCardEndFramePanelProps {
  scene: Scene;
  onPreview: (url: string) => void;
}

const SceneCardEndFramePanel: React.FC<SceneCardEndFramePanelProps> = ({ scene, onPreview }) => {
  if (!(scene.endFrameUrl || scene.endFrameIsLoading || scene.endFrameError)) return null;

  const handleDownload = () => {
    if (!scene.endFrameUrl) return;
    const ext = (scene.endFrameMimeType ?? 'image/png').split('/')[1] || 'png';
    const link = document.createElement('a');
    link.href = scene.endFrameUrl;
    link.download = `Cena_${scene.scene_id}-${scene.sub_id}_frame_final.${ext}`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="card" style={{ marginTop: 6, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--green-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span style={{ color: 'var(--green-text)' }}>Frames para vídeo</span>
        </p>
        <span style={{ fontSize: 10, color: 'var(--text-4)' }}>Início → Fim · Runway / Kling / Pika</span>
      </div>

      <div className="scene-end-frame-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frame inicial</p>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '16/9', background: 'var(--surface-2)' }}>
            {scene.imageUrl ? (
              <button
                type="button"
                onClick={() => onPreview(scene.imageUrl!)}
                aria-label="Ampliar frame inicial"
                style={{ display: 'block', width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}
              >
                <img src={scene.imageUrl} alt="Frame inicial" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                <p style={{ fontSize: 11, color: 'var(--text-4)' }}>Gere a cena primeiro</p>
              </div>
            )}
          </div>
        </div>

        <div className="scene-end-frame-arrow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--green-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
          <span style={{ fontSize: 9, color: 'var(--text-4)', letterSpacing: '0.04em' }}>MOVER</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frame final</p>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${scene.endFrameUrl ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`, aspectRatio: '16/9', background: 'var(--surface-2)', position: 'relative' }}>
            {scene.endFrameIsLoading ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 80 }}>
                <Spinner size={16} />
                <p style={{ fontSize: 10, color: 'var(--text-4)' }}>Gerando…</p>
              </div>
            ) : scene.endFrameError ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 10, textAlign: 'center', minHeight: 80 }} role="alert">
                <p style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>Erro</p>
                <p style={{ fontSize: 10, color: 'rgba(248,113,113,0.6)', marginTop: 2, lineHeight: 1.4 }}>{scene.endFrameError}</p>
              </div>
            ) : scene.endFrameUrl ? (
              <>
                <button
                  type="button"
                  onClick={() => onPreview(scene.endFrameUrl!)}
                  aria-label="Ampliar frame final"
                  style={{ display: 'block', width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}
                >
                  <img src={scene.endFrameUrl} alt="Frame final" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  aria-label="Baixar frame final"
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    padding: 4, borderRadius: 5,
                    background: 'rgba(0,0,0,0.55)', border: 'none',
                    cursor: 'pointer', color: '#fff', display: 'flex',
                  }}
                >
                  <DownloadIcon width={11} height={11} />
                </button>
              </>
            ) : null}
          </div>
          {scene.endFrameUrl && scene.endFrameCostBRL !== undefined && (
            <p style={{ fontSize: 10, color: 'var(--green-text)', fontFamily: 'var(--mono)' }}>
              R${scene.endFrameCostBRL.toFixed(3).replace('.', ',')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(SceneCardEndFramePanel);
