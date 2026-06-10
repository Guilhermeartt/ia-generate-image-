import { useCallback, useRef, useState } from 'react';

export interface UseDraftPatchResult<P> {
  /** Patch acumulado durante uma edição contínua (drag, digitação). */
  draft: P | null;
  /** Marca o início de uma edição. Idempotente. */
  begin: () => void;
  /** Acumula mudanças no patch atual. */
  patch: (changes: P) => void;
  /** Finaliza e retorna o patch acumulado. Limpa o draft. */
  commit: () => P | null;
  /** Cancela sem commit. */
  cancel: () => void;
  /** True enquanto houver patch em andamento. */
  hasDraft: boolean;
}

/**
 * Mantém um patch local enquanto o usuário arrasta/digita, sem chamar callbacks pesados a cada frame.
 * O caller decide quando commit acontece (pointerUp, debounce, blur) e usa o draft em conjunto com o
 * estado-base para renderizar o preview.
 */
export function useDraftPatch<P extends object>(): UseDraftPatchResult<P> {
  const ref = useRef<P | null>(null);
  const [, force] = useState(0);
  const tick = useCallback(() => force(v => v + 1), []);

  const begin = useCallback(() => {
    if (!ref.current) {
      ref.current = {} as P;
      tick();
    }
  }, [tick]);

  const patch = useCallback((changes: P) => {
    ref.current = { ...(ref.current ?? ({} as P)), ...changes } as P;
    tick();
  }, [tick]);

  const commit = useCallback((): P | null => {
    const captured = ref.current;
    if (captured) {
      ref.current = null;
      tick();
    }
    return captured;
  }, [tick]);

  const cancel = useCallback(() => {
    if (ref.current) {
      ref.current = null;
      tick();
    }
  }, [tick]);

  return {
    draft: ref.current,
    begin,
    patch,
    commit,
    cancel,
    hasDraft: ref.current !== null,
  };
}
