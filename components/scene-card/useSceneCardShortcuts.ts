import { useEffect, type RefObject } from 'react';

interface UseSceneCardShortcutsOptions {
  cardRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onGenerate?: () => void;
  onEdit?: () => void;
  onDownload?: () => void;
  onRecreatePrompt?: () => void;
}

const isEditableTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

/**
 * Atalhos só disparam quando o card está em foco (dentro do `cardRef`)
 * e nenhum input/textarea está ativo. Cmd/Ctrl + letra.
 */
export const useSceneCardShortcuts = ({
  cardRef,
  enabled,
  onGenerate,
  onEdit,
  onDownload,
  onRecreatePrompt,
}: UseSceneCardShortcutsOptions) => {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;
      if (isEditableTarget(event.target)) return;
      const container = cardRef.current;
      if (!container) return;
      if (!container.contains(document.activeElement)) return;
      const key = event.key.toLowerCase();
      if (key === 'g' && onGenerate) { event.preventDefault(); onGenerate(); }
      else if (key === 'e' && onEdit) { event.preventDefault(); onEdit(); }
      else if (key === 'd' && onDownload) { event.preventDefault(); onDownload(); }
      else if (key === 'r' && onRecreatePrompt) { event.preventDefault(); onRecreatePrompt(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, cardRef, onGenerate, onEdit, onDownload, onRecreatePrompt]);
};
