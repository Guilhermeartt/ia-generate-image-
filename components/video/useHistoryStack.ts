import { useCallback, useRef, useState } from 'react';

interface HistoryEntry<T> {
  label: string;
  snapshot: T;
}

export interface UseHistoryStackResult<T> {
  push: (label: string, snapshot: T) => void;
  undo: () => HistoryEntry<T> | undefined;
  redo: () => HistoryEntry<T> | undefined;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
  lastLabel: string | undefined;
}

const MAX_ENTRIES = 50;

/**
 * Histórico simples para undo/redo. O caller decide o formato do snapshot
 * (idealmente um diff mínimo do que mudou).
 */
export const useHistoryStack = <T,>(): UseHistoryStackResult<T> => {
  const undoStackRef = useRef<HistoryEntry<T>[]>([]);
  const redoStackRef = useRef<HistoryEntry<T>[]>([]);
  const [, force] = useState(0);
  const tick = useCallback(() => force(v => v + 1), []);

  const push = useCallback(
    (label: string, snapshot: T) => {
      undoStackRef.current = [...undoStackRef.current, { label, snapshot }].slice(-MAX_ENTRIES);
      redoStackRef.current = [];
      tick();
    },
    [tick],
  );

  const undo = useCallback((): HistoryEntry<T> | undefined => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return undefined;
    const entry = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, entry];
    tick();
    return entry;
  }, [tick]);

  const redo = useCallback((): HistoryEntry<T> | undefined => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return undefined;
    const entry = stack[stack.length - 1];
    redoStackRef.current = stack.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, entry];
    tick();
    return entry;
  }, [tick]);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    tick();
  }, [tick]);

  return {
    push,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    clear,
    lastLabel: undoStackRef.current[undoStackRef.current.length - 1]?.label,
  };
};
