import React from 'react';
import type { SavedAnalysis } from '../types';
import { HistoryIcon } from './icons';

interface HistoryLoaderProps {
  history: SavedAnalysis[];
  onLoad: (timestamp: number) => void;
  onClear: () => void;
}

const HistoryLoader: React.FC<HistoryLoaderProps> = ({ history, onLoad, onClear }) => {
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-300 flex items-center gap-2">
            <HistoryIcon width={20} height={20} />
            Análises Recentes
        </h2>
        <button onClick={onClear} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
          Limpar Histórico
        </button>
      </div>
      <div className="space-y-3">
        {history.map((item) => (
          <div key={item.timestamp} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center justify-between hover:border-cyan-500/30 transition-colors">
            <div>
              <p className="font-semibold text-cyan-400">{item.fileName}</p>
              <p className="text-xs text-slate-500">
                Salvo em: {new Date(item.timestamp).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => onLoad(item.timestamp)}
              className="px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors"
            >
              Carregar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryLoader;