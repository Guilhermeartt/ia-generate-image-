import { useCallback, useEffect, useRef, useState } from 'react';

export type ActionStatus = 'running' | 'success' | 'error';

export interface ActionLogEntry {
  id: string;
  label: string;
  startedAt: number;
  endedAt?: number;
  status: ActionStatus;
  detail?: string;
}

export interface UseActionLogApi {
  entries: ActionLogEntry[];
  hasRunning: boolean;
  nowTick: number;
  start: (label: string, detail?: string) => string;
  update: (id: string, patch: Partial<Pick<ActionLogEntry, 'label' | 'detail'>>) => void;
  finish: (id: string, status?: ActionStatus, detail?: string) => void;
  finishAll: (status?: ActionStatus) => void;
  clear: () => void;
}

const TICK_MS = 100;
let _seq = 0;
const nextId = (): string => `act_${Date.now().toString(36)}_${(_seq++).toString(36)}`;

export const useActionLog = (): UseActionLogApi => {
  const [entries, setEntries] = useState<ActionLogEntry[]>([]);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasRunning = entries.some((e) => e.status === 'running');

  useEffect(() => {
    if (hasRunning && intervalRef.current == null) {
      intervalRef.current = setInterval(() => setNowTick(Date.now()), TICK_MS);
    } else if (!hasRunning && intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setNowTick(Date.now());
    }
    return () => {
      if (intervalRef.current != null && !hasRunning) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasRunning]);

  useEffect(() => () => {
    if (intervalRef.current != null) clearInterval(intervalRef.current);
  }, []);

  const start = useCallback((label: string, detail?: string): string => {
    const id = nextId();
    const entry: ActionLogEntry = {
      id,
      label,
      startedAt: Date.now(),
      status: 'running',
      detail,
    };
    setEntries((prev) => [...prev, entry]);
    return id;
  }, []);

  const update = useCallback((id: string, patch: Partial<Pick<ActionLogEntry, 'label' | 'detail'>>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const finish = useCallback((id: string, status: ActionStatus = 'success', detail?: string) => {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== id || e.status !== 'running') return e;
      return { ...e, status, endedAt: Date.now(), detail: detail ?? e.detail };
    }));
  }, []);

  const finishAll = useCallback((status: ActionStatus = 'success') => {
    setEntries((prev) => prev.map((e) => (
      e.status === 'running' ? { ...e, status, endedAt: Date.now() } : e
    )));
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, hasRunning, nowTick, start, update, finish, finishAll, clear };
};
