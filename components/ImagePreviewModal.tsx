import React from 'react';
import { XIcon } from './icons';

interface ImagePreviewModalProps {
  imageUrl: string;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageUrl, onClose }) => {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn .2s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
      >
        <img
          src={imageUrl}
          alt="Pré-visualização"
          style={{
            maxWidth: '90vw', maxHeight: '90vh',
            objectFit: 'contain', borderRadius: 10,
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            display: 'block',
          }}
        />
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
            transition: 'background .12s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
        >
          <XIcon width={14} height={14} />
        </button>
      </div>
    </div>
  );
};

export default ImagePreviewModal;
