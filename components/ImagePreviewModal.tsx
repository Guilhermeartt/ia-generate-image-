import React from 'react';
import { XIcon } from './icons';

interface ImagePreviewModalProps {
  imageUrl: string;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageUrl, onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="relative max-w-6xl w-full max-h-[90vh] p-4"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image container
      >
        <img 
          src={imageUrl} 
          alt="Pré-visualização" 
          className="w-auto h-auto max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl mx-auto" 
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-800/70 rounded-full hover:bg-red-600 transition-colors"
          aria-label="Fechar pré-visualização"
        >
          <XIcon />
        </button>
      </div>
    </div>
  );
};

export default ImagePreviewModal;