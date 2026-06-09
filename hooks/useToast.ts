import { useState, useCallback, useRef, useEffect } from 'react';
import type { ToastMessage } from '../components/Toast';

const TOAST_DURATION_MS = 3200;

/**
 * Gerencia a notificação toast: estado, exibição com auto-dismiss e limpeza.
 * Extraído de App.tsx — autocontido, sem dependências de outros estados.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ id: `${Date.now()}`, message, type });
    timerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  // Limpa o timer ao desmontar para evitar setState em componente desmontado.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { toast, showToast, dismissToast };
}
