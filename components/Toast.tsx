import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  info: (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const ACCENT: Record<ToastType, { color: string; bg: string; border: string }> = {
  success: { color: '#34D399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)' },
  error:   { color: '#F87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.28)'  },
  info:    { color: '#60A5FA', bg: 'rgba(79,140,255,0.12)', border: 'rgba(79,140,255,0.28)' },
};

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      // Trigger enter animation
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [toast?.id]);

  if (!toast) return null;

  const accent = ACCENT[toast.type];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 10,
        background: 'var(--surface-3)',
        border: `1px solid ${accent.border}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.28), 0 0 0 1px ${accent.border}`,
        maxWidth: 320,
        minWidth: 200,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.22s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease',
        cursor: 'pointer',
      }}
      onClick={onDismiss}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <span style={{
        display: 'inline-flex',
        width: 24, height: 24,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 6,
        background: accent.bg,
        border: `1px solid ${accent.border}`,
        color: accent.color,
        flexShrink: 0,
      }}>
        {ICONS[toast.type]}
      </span>

      {/* Message */}
      <span style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-1)',
        flex: 1,
        lineHeight: 1.4,
      }}>
        {toast.message}
      </span>

      {/* Dismiss */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-4)', borderRadius: 4,
          padding: 0, flexShrink: 0,
          transition: 'color .15s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}
        aria-label="Fechar notificação"
      >
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

export default Toast;
