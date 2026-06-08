import React from 'react';
import type { SavedAnalysis } from '../types';
import { HistoryIcon } from './icons';

interface HistoryLoaderProps {
  history: SavedAnalysis[];
  onLoad: (timestamp: number) => void;
  onClear: () => void;
}

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  if (hours < 24) return `há ${hours}h`;
  if (days === 1) return 'ontem';
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const HistoryLoader: React.FC<HistoryLoaderProps> = ({ history, onLoad, onClear }) => {
  return (
    <section className="recent-projects-section">
      <div className="section-hd" style={{ marginBottom: 12 }}>
        <div>
          <p className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HistoryIcon width={15} height={15} style={{ color: 'var(--cyan)' }} />
            Projetos recentes
          </p>
          <p className="section-sub">Retome análises salvas neste navegador.</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
          >
            Limpar
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon"><HistoryIcon width={18} height={18} /></span>
          <strong>Nenhum projeto salvo ainda</strong>
          <p>
            Quando você analisar um roteiro, o projeto fica salvo neste navegador.
            Entre com uma conta para salvar projetos na nuvem sem limites.
          </p>
        </div>
      ) : (
        <div className="recent-projects-grid">
          {history.slice(0, 6).map((item) => (
            <button key={item.timestamp} className="recent-project-card" onClick={() => onLoad(item.timestamp)}>
              <span className="recent-project-icon">
                <HistoryIcon width={15} height={15} />
              </span>
              <span className="recent-project-copy">
                <strong>{item.fileName.replace(/\.[^/.]+$/, '')}</strong>
                <span>
                  {item.scenes.length} cena{item.scenes.length !== 1 ? 's' : ''}
                  {' · '}
                  {item.characters.length} personagem{item.characters.length !== 1 ? 's' : ''}
                  {' · '}
                  {formatRelativeTime(item.timestamp)}
                </span>
              </span>
              <span className="recent-project-action">Abrir →</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default HistoryLoader;
