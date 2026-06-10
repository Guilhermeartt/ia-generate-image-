import { useCallback, useEffect, useState } from 'react';
import { hashForView, viewFromHash, type AppView } from '@/config/views';

export type ScenesViewMode = 'cards' | 'table';

interface UseNavigationOptions {
  /** Espelha a view ativa no hash da URL apenas com projeto carregado. */
  syncHash: boolean;
}

/**
 * Estado de navegação do app: view ativa, modo de exibição das cenas,
 * painel de propriedades e relatório de análise. Extraído de App.tsx.
 *
 * Com projeto carregado (`syncHash`), a view ativa é espelhada no hash da
 * URL (#/cenas), habilitando voltar/avançar do navegador. Navegação do
 * usuário (`navigateTo`) empilha entrada no histórico; mudanças
 * programáticas (`setActiveView` — restauração de rascunho, carga de
 * projeto, reset) apenas substituem o hash.
 */
export function useNavigation({ syncHash }: UseNavigationOptions) {
  const [activeView, setActiveView] = useState<AppView>(() =>
    viewFromHash(window.location.hash) === 'svg-editor' ? 'svg-editor' : 'characters',
  );
  const [scenesViewMode, setScenesViewMode] = useState<ScenesViewMode>('cards');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showAnalysisReport, setShowAnalysisReport] = useState(false);

  const navigateTo = useCallback(
    (view: AppView) => {
      setActiveView(view);
      if ((syncHash || view === 'svg-editor') && window.location.hash !== hashForView(view)) {
        window.location.hash = hashForView(view);
      }
    },
    [syncHash],
  );

  const toggleRightPanel = useCallback(() => setShowRightPanel((v) => !v), []);

  // Voltar/avançar do navegador (ou hash editado manualmente).
  useEffect(() => {
    const onHashChange = () => {
      const view = viewFromHash(window.location.hash);
      if (view && (syncHash || view === 'svg-editor')) {
        setActiveView(view);
      } else if (!syncHash && activeView === 'svg-editor') {
        setActiveView('characters');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [activeView, syncHash]);

  // Mantém o hash espelhando a view ativa sem poluir o histórico.
  useEffect(() => {
    if (!syncHash) {
      if (activeView === 'svg-editor') {
        if (window.location.hash !== hashForView(activeView)) {
          history.replaceState(null, '', hashForView(activeView));
        }
        return;
      }
      // Projeto fechado: hash de view não faz mais sentido.
      if (viewFromHash(window.location.hash)) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      return;
    }
    if (window.location.hash !== hashForView(activeView)) {
      history.replaceState(null, '', hashForView(activeView));
    }
  }, [syncHash, activeView]);

  return {
    activeView,
    setActiveView,
    navigateTo,
    scenesViewMode,
    setScenesViewMode,
    showRightPanel,
    setShowRightPanel,
    toggleRightPanel,
    showAnalysisReport,
    setShowAnalysisReport,
  };
}
