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
    if (isOpen) {
      setPrompt(''); // Reset prompt when modal opens
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onConfirm(prompt);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="relative bg-transparent w-full h-full flex flex-col lg:flex-row items-stretch"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-800/70 rounded-full hover:bg-red-600 transition-colors z-20"
          aria-label="Fechar edição"
        >
          <XIcon />
        </button>

        {/* Image Panel */}
        <div className="flex-grow flex items-center justify-center p-4 lg:p-8 h-1/2 lg:h-full lg:w-2/3">
           <img 
              src={imageUrl} 
              alt="Imagem para editar" 
              className="w-auto h-auto max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
           />
        </div>

        {/* Controls Panel */}
        <form onSubmit={handleSubmit} className="bg-slate-800 h-1/2 lg:h-full lg:w-1/3 flex flex-col p-6 lg:p-8 border-t-2 lg:border-t-0 lg:border-l-2 border-slate-700">
           <h2 className="text-2xl font-bold text-white mb-4">Editar Imagem com IA</h2>
           <p className="text-slate-400 text-sm mb-6">Descreva as alterações que você deseja fazer na imagem. Seja o mais detalhado possível para obter os melhores resultados.</p>
           
           <div className="flex-grow flex flex-col">
              <label htmlFor="edit-prompt" className="text-sm font-medium text-slate-300 mb-2">
                Prompt de Edição:
              </label>
              <textarea
                id="edit-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: mude o fundo para uma praia ensolarada, adicione um chapéu na pessoa..."
                className="w-full h-full flex-grow bg-slate-900/70 border border-slate-600 rounded-md p-3 text-base text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
                disabled={isEditing}
              />
           </div>

           {error && (
              <div className="my-4 p-3 bg-red-900/50 border border-red-700 rounded-md">
                 <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

           <button
              type="submit"
              disabled={isEditing || !prompt.trim()}
              className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-3 text-lg font-semibold text-white bg-cyan-600 rounded-lg shadow-lg hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-wait transition-all"
            >
              {isEditing ? (
                  <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
              ) : (
                  <SparklesIcon width={24} height={24} />
              )}
              <span>{isEditing ? 'Aplicando Edição...' : 'Aplicar Edição'}</span>
            </button>
        </form>
      </div>
    </div>
  );
};

export default ImageEditModal;