import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SHOT_TYPE_OPTIONS } from '../utils/promptModules';

type IconProps = { width?: number; height?: number };

const baseSvg = (children: React.ReactNode, w = 22, h = 22) => (
  <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

// ── Inline schematic icons for each shot type ────────────────────────────────
const DefaultIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <path d="M12 3l1.6 3.4L17 8l-3.4 1.6L12 13l-1.6-3.4L7 8l3.4-1.6L12 3z" />
    <path d="M5 17l.9 1.9L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-1.1L5 17z" />
    <path d="M19 14l.7 1.4L21 16l-1.3.7L19 18l-.7-1.3L17 16l1.3-.6L19 14z" />
  </>, width, height,
);

const CloseUpIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="11" r="5" />
    <path d="M8 21c.6-2.4 2.2-4 4-4s3.4 1.6 4 4" />
  </>, width, height,
);

const MediumShotIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="9" r="2.8" />
    <path d="M6 21c.5-3.8 3-6 6-6s5.5 2.2 6 6" />
  </>, width, height,
);

const WideShotIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="11" r="1.4" />
    <path d="M11 12.4v3.6M13 12.4v3.6M11 13.6l-1 1.6M13 13.6l1 1.6" />
    <path d="M5 19h14" />
  </>, width, height,
);

const PanoramicIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <rect x="2" y="7" width="20" height="10" rx="1.5" />
    <path d="M4 14l3-3 3 3 4-4 3 3 3-2" />
    <circle cx="7" cy="10" r=".6" fill="currentColor" />
  </>, width, height,
);

const AmericanShotIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="7.5" r="2.2" />
    <path d="M8.5 21V13.5C8.5 11.7 10 10.2 12 10.2s3.5 1.5 3.5 3.3V21" />
  </>, width, height,
);

const DetailShotIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 10.5v3M10.5 12h3" />
  </>, width, height,
);

const HighAngleIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 7l4 4 4-4" />
    <circle cx="12" cy="16" r="1.6" />
    <path d="M10.5 19c0-1 .7-1.6 1.5-1.6s1.5.6 1.5 1.6" />
  </>, width, height,
);

const LowAngleIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="8" r="1.6" />
    <path d="M10.5 11c0-1 .7-1.6 1.5-1.6s1.5.6 1.5 1.6" />
    <path d="M8 17l4-4 4 4" />
  </>, width, height,
);

const OverShoulderIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="14" cy="10" r="2" />
    <path d="M11 16c.4-2 1.5-3 3-3s2.6 1 3 3" />
    <path d="M3 21c0-3 1.5-5 4-6.2" />
    <circle cx="6" cy="13" r="2.2" />
  </>, width, height,
);

const PovIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </>, width, height,
);

const EstablishingIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 17l4-5 3 3 3-4 4 4 4-3" />
    <circle cx="7" cy="7.5" r="1" />
  </>, width, height,
);

const AerialDroneIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 10V6M12 14v4M10 12H6M14 12h4" />
    <circle cx="5" cy="5" r="2" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
  </>, width, height,
);

const MacroIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <circle cx="10" cy="10" r="6" />
    <path d="M14.5 14.5l6 6" />
    <path d="M10 7v6M7 10h6" />
  </>, width, height,
);

const DutchAngleIcon: React.FC<IconProps> = ({ width, height }) => baseSvg(
  <>
    <g transform="rotate(-18 12 12)">
      <rect x="4" y="6" width="16" height="12" rx="1.5" />
      <path d="M7 14l3-3 3 3 3-2" />
    </g>
  </>, width, height,
);

const SHOT_ICONS: Record<string, React.FC<IconProps>> = {
  'Close-up': CloseUpIcon,
  'Medium Shot': MediumShotIcon,
  'Wide Shot': WideShotIcon,
  'Panoramic Shot': PanoramicIcon,
  'American Shot': AmericanShotIcon,
  'Detail Shot': DetailShotIcon,
  'High-Angle Shot': HighAngleIcon,
  'Low-Angle Shot': LowAngleIcon,
  'Over-the-Shoulder Shot': OverShoulderIcon,
  'POV Shot': PovIcon,
  'Establishing Shot': EstablishingIcon,
  'Aerial/Drone Shot': AerialDroneIcon,
  'Macro Shot': MacroIcon,
  'Dutch Angle': DutchAngleIcon,
};

const SHOT_DESCRIPTIONS: Record<string, string> = {
  'Close-up': 'Rosto/objeto em primeiro plano',
  'Medium Shot': 'Da cintura para cima',
  'Wide Shot': 'Personagem por inteiro no ambiente',
  'Panoramic Shot': 'Vista horizontal ampla',
  'American Shot': 'Cintura/joelhos visíveis',
  'Detail Shot': 'Detalhe muito específico em foco',
  'High-Angle Shot': 'Câmera acima olhando para baixo',
  'Low-Angle Shot': 'Câmera abaixo olhando para cima',
  'Over-the-Shoulder Shot': 'Por cima do ombro de um personagem',
  'POV Shot': 'Ponto de vista do personagem',
  'Establishing Shot': 'Plano de abertura do local',
  'Aerial/Drone Shot': 'Vista de drone / aérea',
  'Macro Shot': 'Aproximação extrema de detalhe',
  'Dutch Angle': 'Câmera inclinada (tensão/desconforto)',
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const POPOVER_MAX_HEIGHT = 340;
const POPOVER_GAP = 4;

const ShotTypeSelector: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; placement: 'bottom' | 'top' } | null>(null);

  const recalcPosition = () => {
    const btn = wrapRef.current?.querySelector('button');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const placement: 'bottom' | 'top' = spaceBelow < POPOVER_MAX_HEIGHT + POPOVER_GAP && spaceAbove > spaceBelow ? 'top' : 'bottom';
    const top = placement === 'bottom' ? rect.bottom + POPOVER_GAP : Math.max(8, rect.top - POPOVER_GAP - POPOVER_MAX_HEIGHT);
    setPos({ top, left: rect.left, width: rect.width, placement });
  };

  useLayoutEffect(() => {
    if (open) recalcPosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onReflow = () => recalcPosition();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open]);

  const SelectedIcon = value ? SHOT_ICONS[value] : DefaultIcon;
  const selectedLabel = value || 'Melhor plano para a cena';

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1 }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="field"
        style={{
          fontSize: 12,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '6px 10px',
        }}
        title="Aplicado automaticamente no prompt JSON ao selecionar"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ display: 'inline-flex', color: value ? 'var(--text-1)' : 'var(--text-4)', flexShrink: 0 }}>
          {SelectedIcon ? <SelectedIcon width={18} height={18} /> : null}
        </span>
        <span style={{ flex: 1, color: value ? 'var(--text-1)' : 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel}
        </span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          role="listbox"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            minWidth: 260,
            zIndex: 1000,
            background: 'rgba(15,15,22,0.98)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            padding: 6,
            maxHeight: POPOVER_MAX_HEIGHT,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => handleSelect('')}
            role="option"
            aria-selected={value === ''}
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid ' + (value === '' ? 'rgba(99,102,241,0.45)' : 'transparent'),
              background: value === '' ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: 'var(--text-2)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 12,
            }}
            onMouseEnter={e => { if (value !== '') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (value !== '') e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ display: 'inline-flex', color: '#A5B4FC', flexShrink: 0 }}>
              <DefaultIcon width={20} height={20} />
            </span>
            <span style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>Melhor plano para a cena</div>
              <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 1 }}>IA escolhe o enquadramento ideal</div>
            </span>
          </button>

          {SHOT_TYPE_OPTIONS.map(shot => {
            const Icon = SHOT_ICONS[shot];
            const selected = value === shot;
            return (
              <button
                key={shot}
                type="button"
                onClick={() => handleSelect(shot)}
                role="option"
                aria-selected={selected}
                title={SHOT_DESCRIPTIONS[shot]}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 4,
                  padding: '8px 6px',
                  borderRadius: 6,
                  border: '1px solid ' + (selected ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.04)'),
                  background: selected ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontSize: 11,
                  transition: 'background .12s ease, border-color .12s ease',
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ display: 'inline-flex', color: selected ? '#A5B4FC' : 'var(--text-2)' }}>
                  {Icon ? <Icon width={26} height={26} /> : null}
                </span>
                <span style={{ color: 'var(--text-1)', fontWeight: 500, lineHeight: 1.2 }}>
                  {shot}
                </span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default ShotTypeSelector;
