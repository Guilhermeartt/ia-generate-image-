import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionLogEntry } from '../hooks/useActionLog';

interface ActionLogProps {
  entries: ActionLogEntry[];
  nowTick: number;
  onClear: () => void;
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(totalSeconds < 10 ? 2 : 1)}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
};

const formatClock = (ts: number): string => {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const StatusDot: React.FC<{ status: ActionLogEntry['status'] }> = ({ status }) => {
  if (status === 'running') {
    return (
      <span
        aria-label="executando"
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          border: '2px solid rgba(79,140,255,0.30)',
          borderTopColor: '#4F8CFF',
          animation: 'spin .8s linear infinite',
          flexShrink: 0,
        }}
      />
    );
  }
  if (status === 'success') {
    return (
      <span
        aria-label="concluído"
        style={{
          width: 10, height: 10, borderRadius: '50%',
          background: '#10B981',
          boxShadow: '0 0 6px rgba(16,185,129,0.55)',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span
      aria-label="erro"
      style={{
        width: 10, height: 10, borderRadius: '50%',
        background: '#F87171',
        boxShadow: '0 0 6px rgba(248,113,113,0.55)',
        flexShrink: 0,
      }}
    />
  );
};

const ActionLog: React.FC<ActionLogProps> = ({ entries, nowTick, onClear }) => {
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const running = useMemo(() => entries.filter((e) => e.status === 'running'), [entries]);
  const totalCount = entries.length;
  const runningCount = running.length;

  useEffect(() => {
    if (!collapsed && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [totalCount, collapsed]);

  if (totalCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 90,
        width: collapsed ? 220 : 360,
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--surface, rgba(20,22,28,0.96))',
        border: '1px solid var(--border-md, rgba(255,255,255,0.10))',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(79,140,255,0.06)',
        backdropFilter: 'blur(14px)',
        overflow: 'hidden',
        transition: 'width 0.22s ease',
        fontFamily: 'var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          borderBottom: collapsed ? 'none' : '1px solid var(--border, rgba(255,255,255,0.06))',
          cursor: 'pointer',
          userSelect: 'none',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))',
        }}
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? 'Expandir log' : 'Colapsar log'}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: runningCount > 0 ? '#4F8CFF' : '#10B981',
            boxShadow: runningCount > 0
              ? '0 0 8px rgba(79,140,255,0.7)'
              : '0 0 8px rgba(16,185,129,0.55)',
            animation: runningCount > 0 ? 'pulse-dot 1.6s ease-in-out infinite' : undefined,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1, #fff)', letterSpacing: '0.02em' }}>
          LOG DE AÇÕES
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-4, rgba(255,255,255,0.55))',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '1px 6px',
            marginLeft: 'auto',
          }}
        >
          {runningCount > 0 ? `${runningCount} em curso` : `${totalCount} concluídas`}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          title="Limpar log"
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text-4, rgba(255,255,255,0.55))',
            borderRadius: 6,
            padding: '1px 6px',
            fontSize: 10,
            cursor: 'pointer',
            lineHeight: 1.4,
          }}
        >
          limpar
        </button>
        <span
          style={{
            color: 'var(--text-4, rgba(255,255,255,0.55))',
            fontSize: 10,
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform .2s',
            display: 'inline-block',
          }}
        >
          ▾
        </span>
      </div>

      {/* List */}
      {!collapsed && (
        <div
          ref={listRef}
          style={{
            maxHeight: 260,
            overflowY: 'auto',
            padding: '6px 0',
          }}
        >
          {entries.map((entry) => {
            const endRef = entry.endedAt ?? nowTick;
            const duration = endRef - entry.startedAt;
            const isRunning = entry.status === 'running';
            const color = entry.status === 'error'
              ? '#F87171'
              : isRunning
                ? 'var(--text-1, #fff)'
                : 'var(--text-2, rgba(255,255,255,0.78))';
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '5px 12px',
                  borderLeft: isRunning ? '2px solid #4F8CFF' : '2px solid transparent',
                  background: isRunning ? 'rgba(79,140,255,0.06)' : 'transparent',
                }}
              >
                <span style={{ marginTop: 3 }}>
                  <StatusDot status={entry.status} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color,
                      lineHeight: 1.4,
                      fontWeight: isRunning ? 600 : 500,
                      wordBreak: 'break-word',
                    }}
                  >
                    {entry.label}
                  </div>
                  {entry.detail && (
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-4, rgba(255,255,255,0.5))',
                        marginTop: 1,
                        lineHeight: 1.4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {entry.detail}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 9,
                      color: 'var(--text-4, rgba(255,255,255,0.45))',
                      marginTop: 2,
                      display: 'flex',
                      gap: 8,
                    }}
                  >
                    <span>{formatClock(entry.startedAt)}</span>
                    <span>•</span>
                    <span
                      style={{
                        color: isRunning ? '#4F8CFF' : entry.status === 'error' ? '#F87171' : '#34D399',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatDuration(duration)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionLog;
