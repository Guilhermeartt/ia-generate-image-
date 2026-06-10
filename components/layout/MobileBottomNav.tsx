import React from 'react';
import { APP_VIEWS, type AppView } from '@/config/views';
import { SparklesIcon } from '@/components/icons';

interface MobileBottomNavProps {
  /** Sem arquivo carregado, o botão Início fica destacado. */
  hasFile: boolean;
  isDone: boolean;
  activeView: AppView;
  onHome: () => void;
  onNavigate: (view: AppView) => void;
}

/**
 * Barra de navegação fixa exibida apenas em telas estreitas (≤780px),
 * onde a <nav> da sidebar fica oculta. Extraída de App.tsx; as views
 * derivam do registry em config/views.
 */
const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  hasFile,
  isDone,
  activeView,
  onHome,
  onNavigate,
}) => (
  <nav className="mobile-bottom-nav" aria-label="Navegação principal mobile">
    <button className={!hasFile && activeView !== 'svg-editor' ? 'active' : ''} onClick={onHome}>
      <SparklesIcon width={15} height={15} />
      Início
    </button>
    {APP_VIEWS.map((item) => (
      <button
        key={item.id}
        className={(isDone || item.id === 'svg-editor') && activeView === item.id ? 'active' : ''}
        disabled={!isDone && item.id !== 'svg-editor'}
        onClick={() => onNavigate(item.id)}
      >
        {item.icon}
        {item.shortLabel}
      </button>
    ))}
  </nav>
);

export default MobileBottomNav;
