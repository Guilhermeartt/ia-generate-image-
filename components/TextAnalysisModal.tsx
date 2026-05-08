import React, { useState, useEffect } from 'react';
import type { AnalysisModalState, Character, Scene } from '../types';
import { XIcon } from './icons';

interface TextAnalysisModalProps {
  state: AnalysisModalState | null;
  onClose: () => void;
  onApplyCorrection: (item: Character | Scene, originalText: string, suggestion: string) => void;
}

const TextAnalysisModal: React.FC<TextAnalysisModalProps> = ({ state, onClose, onApplyCorrection }) => {
  if (!state) {
    return null;
  }

  const { item, result } = state;
  const itemName = 'name' in item ? item.name : `Cena ${item.scene_id}`;
  
  const [originalForCorrection, setOriginalForCorrection] = useState('');
  const [suggestionForCorrection, setSuggestionForCorrection] = useState('');

  useEffect(() => {
    setOriginalForCorrection(result.originalText || '');
    setSuggestionForCorrection(result.suggestedCorrection || '');
  }, [result, item]);

  const canApplyCorrection = originalForCorrection.trim().length > 0 && suggestionForCorrection.trim().length > 0;

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
          <h2 className="text-xl font-bold text-white">Análise de Texto para: <span className="text-cyan-400">{itemName}</span></h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 rounded-full hover:bg-slate-700 hover:text-white"
            aria-label="Fechar"
          >
            <XIcon />
          </button>
        </header>

        <main className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
          <div className="flex flex-col items-center justify-center bg-slate-900/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-slate-300 mb-2">Imagem Analisada</h3>
            <img 
                src={item.imageUrl} 
                alt={`Imagem de ${itemName}`} 
                className="rounded-md shadow-lg max-w-full max-h-80 object-contain"
            />
          </div>
          
          <div className="bg-slate-900/50 p-4 rounded-lg flex flex-col">
             <div className="flex-grow space-y-4">
                <div>
                    <label className="text-xs font-semibold text-slate-400">Texto Transcrito pela IA:</label>
                    <div className="bg-slate-700/50 p-3 rounded-md min-h-[44px] text-slate-300 text-sm">
                        {(result.transcribedText && result.transcribedText.trim() !== '')
                            ? <p className="italic">"{result.transcribedText}"</p>
                            : <p className="text-slate-500 italic">Nenhum texto detectado.</p>
                        }
                    </div>
                    {result.errorFound && result.explanation && (
                        <p className="text-xs text-slate-400 mt-2">
                            <span className="font-semibold text-yellow-400">Nota da IA:</span> {result.explanation}
                        </p>
                    )}
                </div>

                <hr className="border-slate-700" />

                <div>
                    <h4 className="text-base font-semibold text-slate-300 mb-2">Solicitar Correção Manual</h4>
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="original-text-input" className="text-xs font-semibold text-slate-400">Texto a ser Substituído:</label>
                            <input
                                id="original-text-input"
                                type="text"
                                value={originalForCorrection}
                                onChange={(e) => setOriginalForCorrection(e.target.value)}
                                placeholder="Texto exato da imagem a ser corrigido"
                                className="w-full bg-slate-900/80 text-red-400 font-mono text-sm focus:outline-none placeholder-slate-500 px-3 py-2 border border-slate-600 rounded-md focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="suggestion-text-input" className="text-xs font-semibold text-slate-400">Substituir por:</label>
                            <input
                                id="suggestion-text-input"
                                type="text"
                                value={suggestionForCorrection}
                                onChange={(e) => setSuggestionForCorrection(e.target.value)}
                                placeholder="Novo texto corrigido"
                                className="w-full bg-slate-900/80 text-green-300 font-mono text-sm focus:outline-none placeholder-slate-500 px-3 py-2 border border-slate-600 rounded-md focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            />
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </main>

        <footer className="flex items-center justify-end p-4 border-t border-slate-700 flex-shrink-0 bg-slate-800/50 gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={() => onApplyCorrection(item, originalForCorrection, suggestionForCorrection)}
            disabled={!canApplyCorrection}
            className="px-6 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            Corrigir Imagem
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TextAnalysisModal;