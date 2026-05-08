import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ImageRegion } from '../types';
import { XIcon, CropIcon } from './icons';

interface ImageRegionSelectorModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onConfirm: (region: ImageRegion | null) => void;
}

const ImageRegionSelectorModal: React.FC<ImageRegionSelectorModalProps> = ({ isOpen, imageUrl, onClose, onConfirm }) => {
  const [selection, setSelection] = useState<ImageRegion | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      clearSelection();
      setIsDrawing(false);
    }
  }, [isOpen, clearSelection]);

  const getCoordinates = (e: React.MouseEvent<HTMLDivElement>): { x: number; y: number } => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    setStartPoint(coords);
    setIsDrawing(true);
    setSelection({ ...coords, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !imageRef.current) return;
    const coords = getCoordinates(e);
    
    const imageRect = imageRef.current.getBoundingClientRect();
    const containerRect = containerRef.current!.getBoundingClientRect();
    
    // Clamp coordinates to be within the visible image area
    const clampedX = Math.max(0, Math.min(coords.x, imageRect.width));
    const clampedY = Math.max(0, Math.min(coords.y, imageRect.height));

    const width = Math.abs(clampedX - startPoint.x);
    const height = Math.abs(clampedY - startPoint.y);
    const newX = Math.min(startPoint.x, clampedX);
    const newY = Math.min(startPoint.y, clampedY);
    
    setSelection({ x: newX, y: newY, width, height });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Selecionar Região para Análise</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 rounded-full hover:bg-slate-700 hover:text-white"
            aria-label="Fechar"
          >
            <XIcon />
          </button>
        </header>

        <main className="p-6 flex-grow flex items-center justify-center overflow-auto bg-slate-900/50">
          <div
            ref={containerRef}
            className="relative select-none cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Selecione uma região"
              className="max-w-full max-h-[65vh] object-contain block"
            />
            {selection && (
              <div
                className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/20 pointer-events-none"
                style={{
                  left: selection.x,
                  top: selection.y,
                  width: selection.width,
                  height: selection.height,
                }}
              />
            )}
          </div>
        </main>
        
        <p className="text-center text-sm text-slate-400 bg-slate-800 pt-2 pb-4">Clique e arraste na imagem para selecionar uma área.</p>

        <footer className="flex items-center justify-between p-4 border-t border-slate-700 flex-shrink-0 bg-slate-800/50">
          <button
            onClick={() => onConfirm(null)}
            className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors"
          >
            Analisar Imagem Inteira
          </button>
          <div className="flex items-center gap-3">
             {selection && selection.width > 0 && (
                <button onClick={clearSelection} className="text-sm text-slate-400 hover:text-white">
                    Limpar Seleção
                </button>
             )}
            <button
              onClick={() => onConfirm(selection)}
              disabled={!selection || selection.width < 5 || selection.height < 5}
              className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
            >
              <CropIcon />
              Analisar Região Selecionada
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ImageRegionSelectorModal;