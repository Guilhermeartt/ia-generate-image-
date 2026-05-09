import React, { useState } from 'react';
import { XIcon, SparklesIcon } from './icons';

interface SceneSplitModalProps {
  isOpen: boolean;
  sceneLabel: string;
  onClose: () => void;
  onGenerate: (count: number, instructions: string) => void;
  isGenerating: boolean;
}

const COUNT_OPTIONS = [2, 3, 4];

const INSTRUCTION_SUGGESTIONS = [
  'Diferentes ângulos de câmera',
  'Ação e reação dos personagens',
  'Do geral para o detalhe',
  'Plano conjunto e close-up',
  'Antes e depois do momento principal',
];

const SceneSplitModal: React.FC<SceneSplitModalProps> = ({
  isOpen,
  sceneLabel,
  onClose,
  onGenerate,
  isGenerating,
}) => {
  const [count, setCount] = useState(2);
  const [instructions, setInstructions] = useState('');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">Dividir Cena em Planos</h2>
            <p className="text-xs text-slate-400 mt-0.5">{sceneLabel}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 text-slate-400 rounded-full hover:bg-slate-700 hover:text-white transition-colors"
          >
            <XIcon />
          </button>
        </header>

        <div className="p-6 flex flex-col gap-5">
          {/* Explicação */}
          <p className="text-sm text-slate-400 leading-relaxed">
            A IA vai analisar o prompt desta cena e gerar{' '}
            <span className="text-white font-semibold">{count} imagens distintas</span>, cada uma com
            um plano, ângulo ou detalhe diferente — como um storyboard expandido da mesma cena.
          </p>

          {/* Quantas imagens */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">
              Quantos planos?
            </label>
            <div className="flex gap-3">
              {COUNT_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 py-3 rounded-lg text-sm font-bold border-2 transition-all ${
                    count === n
                      ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {n} planos
                </button>
              ))}
            </div>
          </div>

          {/* Sugestões de instrução */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
              Como dividir? <span className="text-slate-500 normal-case font-normal">(opcional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {INSTRUCTION_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setInstructions(prev => prev === s ? '' : s)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    instructions === s
                      ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
                      : 'border-slate-600 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              disabled={isGenerating}
              rows={3}
              placeholder="Ex: foque nas expressões dos personagens e no ambiente ao fundo..."
              className="w-full bg-slate-900/70 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none disabled:opacity-50"
            />
          </div>

          {/* Aviso */}
          <div className="flex items-start gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/60">
            <span className="text-yellow-400 text-sm flex-shrink-0">⚡</span>
            <p className="text-xs text-slate-400">
              Cada plano é gerado separadamente — personagens da cena serão usados como referência visual quando disponíveis.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/60">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onGenerate(count, instructions)}
            disabled={isGenerating}
            className="flex items-center gap-2.5 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <SparklesIcon width={16} height={16} />
            )}
            {isGenerating ? 'Gerando planos...' : `Gerar ${count} planos`}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SceneSplitModal;
