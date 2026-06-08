import React, { useState, useEffect } from 'react';
import { XIcon, SparklesIcon } from './icons';

interface ImageEditModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onConfirm: (prompt: string) => Promise<void>;
  isEditing: boolean;
  error: string | null;
}

const ImageEditModal: React.FC<ImageEditModalProps> = ({ isOpen, imageUrl, onClose, onConfirm, isEditing, error }) => {
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (isOpen) setPrompt('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) onConfirm(prompt);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn .2s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'row',
          width: '90vw', maxWidth: 900,
          height: '80vh', maxHeight: 640,
          borderRadius: 12, overflow: 'hidden',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Image panel */}
        <div style={{
          flex: 1, background: 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, overflow: 'hidden',
        }}>
          <img
            src={imageUrl}
            alt="Imagem para editar"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>

        {/* Controls panel */}
        <form
          onSubmit={handleSubmit}
          style={{
            width: 320, flexShrink: 0,
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            padding: '24px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Editar com IA</h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-3)',
              }}
            >
              <XIcon width={13} height={13} />
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 14 }}>
            Descreva as alterações que deseja fazer. Seja específico para obter os melhores resultados.
          </p>

          <label className="label" style={{ marginBottom: 6 }}>Prompt de Edição</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: mude o fundo para uma praia, adicione um chapéu..."
            className="field"
            style={{ flex: 1, resize: 'none', fontSize: 13, minHeight: 120 }}
            disabled={isEditing}
          />

          {error && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 7,
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
            }}>
              <p style={{ fontSize: 12, color: 'var(--red)' }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isEditing || !prompt.trim()}
            className="btn btn-primary"
            style={{ marginTop: 16, width: '100%', justifyContent: 'center', fontSize: 14, padding: '10px 16px' }}
          >
            {isEditing
              ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
              : <SparklesIcon width={15} height={15} />}
            {isEditing ? 'Aplicando…' : 'Aplicar Edição'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImageEditModal;
