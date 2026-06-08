import React, { useEffect, useState } from 'react';

interface BatchProgressBarProps {
  current: number;
  total: number;
  itemName: string;
}

/**
 * Floating progress bar rendered at the bottom of the content area.
 * Appears with a slide-up animation when `current`/`total` are provided,
 * and disappears when unmounted.
 */
const BatchProgressBar: React.FC<BatchProgressBarProps> = ({ current, total, itemName }) => {
  const [visible, setVisible] = useState(false);

  // Trigger enter animation on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : 18}px)`,
        opacity: visible ? 1 : 0,
        transition: 'transform 0.28s cubic-bezier(0.2,0,0,1), opacity 0.22s ease',
        zIndex: 80,
        pointerEvents: 'none',
        minWidth: 280,
        maxWidth: 420,
        width: 'calc(100% - 48px)',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-md)',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(79,140,255,0.08)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Top row: spinner + label + counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Spinner */}
          <div style={{
            width: 14, height: 14, flexShrink: 0,
            border: '2px solid var(--indigo-b)',
            borderTopColor: 'var(--indigo)',
            borderRadius: '50%',
            animation: 'spin .8s linear infinite',
          }} />

          {/* Item name */}
          <span style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {itemName}
          </span>

          {/* Counter badge */}
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            fontWeight: 600,
            color: '#818CF8',
            flexShrink: 0,
            background: 'var(--indigo-s)',
            border: '1px solid var(--indigo-b)',
            borderRadius: 6,
            padding: '1px 7px',
            whiteSpace: 'nowrap',
          }}>
            {current} / {total}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4,
          background: 'var(--surface-3)',
          borderRadius: 99,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--indigo), #22D3EE)',
            borderRadius: 99,
            transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: '0 0 8px rgba(79,140,255,0.5)',
          }} />
        </div>

        {/* Percentage label */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: -4,
        }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            color: 'var(--text-4)',
          }}>
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default BatchProgressBar;
