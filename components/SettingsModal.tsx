import React, { useState, useEffect } from 'react';
import type { AppSettings } from '../types';
import { XIcon } from './icons';
import { DEFAULT_PROMPTS } from '../config/prompts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialSettings, onSave }) => {
  const [currentSettings, setCurrentSettings] = useState<AppSettings>(initialSettings);

  useEffect(() => {
    setCurrentSettings(initialSettings);
  }, [initialSettings, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(currentSettings);
  };

  const handleRestoreDefaults = () => {
    if (window.confirm('Tem certeza de que deseja restaurar todos os prompts para os valores padrão?')) {
        setCurrentSettings(DEFAULT_PROMPTS);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Configurações de Prompt da IA</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 rounded-full hover:bg-slate-700 hover:text-white"
            aria-label="Fechar configurações"
          >
            <XIcon />
          </button>
        </header>

        <main className="p-6 space-y-6 overflow-y-auto">
          <div>
            <label htmlFor="generalContextPrompt" className="block text-sm font-medium text-slate-300 mb-1">
              Prompt de Contexto Geral
            </label>
            <p className="text-xs text-slate-500 mb-2">Usado para analisar todo o roteiro e criar um resumo do estilo visual e da atmosfera.</p>
            <textarea
              id="generalContextPrompt"
              name="generalContextPrompt"
              value={currentSettings.generalContextPrompt}
              onChange={handleInputChange}
              className="w-full bg-slate-900/70 border border-slate-600 rounded-md p-2 text-sm text-slate-300 focus:ring-cyan-500 focus:border-cyan-500"
              rows={5}
            />
          </div>

          <div>
            <label htmlFor="characterGenerationPrompt" className="block text-sm font-medium text-slate-300 mb-1">
              Prompt de Geração de Personagem
            </label>
            <p className="text-xs text-slate-500 mb-2">Usado para extrair nomes de personagens e descrições físicas do roteiro.</p>
            <textarea
              id="characterGenerationPrompt"
              name="characterGenerationPrompt"
              value={currentSettings.characterGenerationPrompt}
              onChange={handleInputChange}
              className="w-full bg-slate-900/70 border border-slate-600 rounded-md p-2 text-sm text-slate-300 focus:ring-cyan-500 focus:border-cyan-500"
              rows={5}
            />
          </div>
          
          <div>
            <label htmlFor="characterImagePrompt" className="block text-sm font-medium text-slate-300 mb-1">
              Prompt Padrão de Imagem de Personagem
            </label>
            <p className="text-xs text-slate-500 mb-2">O template para gerar retratos. Use <code className="text-cyan-400 bg-slate-700 px-1 rounded">{'{physical_characteristics}'}</code> como um placeholder.</p>
            <textarea
              id="characterImagePrompt"
              name="characterImagePrompt"
              value={currentSettings.characterImagePrompt}
              onChange={handleInputChange}
              className="w-full bg-slate-900/70 border border-slate-600 rounded-md p-2 text-sm text-slate-300 focus:ring-cyan-500 focus:border-cyan-500"
              rows={5}
            />
          </div>

          <div>
            <label htmlFor="sceneAnalysisPrompt" className="block text-sm font-medium text-slate-300 mb-1">
              Prompt de Análise de Cena
            </label>
            <p className="text-xs text-slate-500 mb-2">Usado para analisar cada cena, marcar personagens e criar um prompt de imagem. Use <code className="text-cyan-400 bg-slate-700 px-1 rounded">{'{character_list}'}</code>, <code className="text-cyan-400 bg-slate-700 px-1 rounded">{'{location}'}</code>, e <code className="text-cyan-400 bg-slate-700 px-1 rounded">{'{description}'}</code> como placeholders.</p>
            <textarea
              id="sceneAnalysisPrompt"
              name="sceneAnalysisPrompt"
              value={currentSettings.sceneAnalysisPrompt}
              onChange={handleInputChange}
              className="w-full bg-slate-900/70 border border-slate-600 rounded-md p-2 text-sm text-slate-300 focus:ring-cyan-500 focus:border-cyan-500"
              rows={8}
            />
          </div>
        </main>

        <footer className="flex items-center justify-between p-4 border-t border-slate-700 flex-shrink-0 bg-slate-800/50">
           <button
            onClick={handleRestoreDefaults}
            className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors"
          >
            Restaurar Padrões
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-300 bg-transparent rounded-md hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors"
            >
              Salvar Alterações
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;