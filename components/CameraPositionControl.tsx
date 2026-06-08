import React, { useMemo, useRef } from 'react';
import {
  CAMERA_HEIGHT_OPTIONS,
  CAMERA_POSITION_OPTIONS,
  type CameraHeightId,
  type CameraPositionId,
} from '../utils/promptModules';

interface CameraPositionControlProps {
  position: CameraPositionId | '';
  height: CameraHeightId | '';
  disabled?: boolean;
  onChange: (position: CameraPositionId | '', height: CameraHeightId | '') => void;
}

const POSITION_ANGLES: Record<CameraPositionId, number> = {
  front: 180,
  'front-right': 135,
  right: 90,
  'back-right': 45,
  back: 0,
  'back-left': -45,
  left: -90,
  'front-left': -135,
  'over-shoulder': 155,
};

const normalizeDeg = (deg: number) => {
  let next = deg % 360;
  if (next > 180) next -= 360;
  if (next < -180) next += 360;
  return next;
};

const angleDistance = (a: number, b: number) => Math.abs(normalizeDeg(a - b));

const orbitPoint = (angleDeg: number, radiusX: number, radiusY: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.sin(rad) * radiusX,
    y: Math.cos(rad) * radiusY,
    z: Math.cos(rad),
  };
};

const POSITION_MARKERS = CAMERA_POSITION_OPTIONS.map(option => {
  const point = orbitPoint(POSITION_ANGLES[option.id], 122, 42);
  return {
    option,
    x: point.x,
    y: point.y,
    z: point.z,
    baseTop: 74 - point.y,
    baseZIndex: Math.round(40 + point.z * 20),
    baseOpacity: 0.48 + ((point.z + 1) / 2) * 0.42,
    baseScale: 0.8 + ((point.z + 1) / 2) * 0.18,
    yaw: -POSITION_ANGLES[option.id] * 0.6,
  };
});

const positionForAngle = (deg: number): CameraPositionId => {
  const normalized = normalizeDeg(deg);
  let best = CAMERA_POSITION_OPTIONS[0].id;
  let bestDistance = Infinity;
  for (const option of CAMERA_POSITION_OPTIONS) {
    const distance = angleDistance(normalized, POSITION_ANGLES[option.id]);
    if (distance < bestDistance) {
      best = option.id;
      bestDistance = distance;
    }
  }
  return best;
};

const CameraGlyph: React.FC<{ active?: boolean; scale?: number; yaw?: number }> = ({ active, scale = 1, yaw = 0 }) => (
  <div
    aria-hidden="true"
    style={{
      width: 28,
      height: 22,
      transform: `scale(${scale}) rotateY(${yaw}deg)`,
      transformStyle: 'preserve-3d',
      position: 'relative',
      filter: active ? 'drop-shadow(0 0 10px rgba(167,139,250,0.62))' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.28))',
    }}
  >
    <div style={{
      position: 'absolute',
      left: 4,
      top: 4,
      width: 18,
      height: 14,
      borderRadius: 4,
      background: active ? 'linear-gradient(135deg, #A78BFA, #6D5DF6)' : 'linear-gradient(135deg, #6366F1, #4338CA)',
      border: '1px solid rgba(255,255,255,0.26)',
    }} />
    <div style={{
      position: 'absolute',
      right: 0,
      top: 7,
      width: 10,
      height: 8,
      clipPath: 'polygon(0 18%, 100% 0, 100% 100%, 0 82%)',
      background: active ? '#C4B5FD' : '#818CF8',
      borderRadius: 2,
    }} />
    <div style={{
      position: 'absolute',
      left: 8,
      bottom: 0,
      width: 9,
      height: 4,
      borderRadius: 3,
      background: '#0F172A',
      opacity: 0.9,
    }} />
  </div>
);

const SubjectGlyph: React.FC = () => (
  <div aria-hidden="true" style={{ position: 'relative', width: 36, height: 58 }}>
    <div style={{
      position: 'absolute',
      left: 10,
      top: 0,
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: 'linear-gradient(180deg, #F8FAFC, #CBD5E1)',
      boxShadow: '0 5px 14px rgba(0,0,0,0.28)',
    }} />
    <div style={{
      position: 'absolute',
      left: 7,
      top: 15,
      width: 22,
      height: 42,
      borderRadius: '14px 14px 9px 9px',
      background: 'linear-gradient(180deg, #CBD5E1, #64748B)',
      boxShadow: '0 12px 24px rgba(0,0,0,0.32)',
    }} />
  </div>
);

const CameraPositionControl: React.FC<CameraPositionControlProps> = ({
  position,
  height,
  disabled,
  onChange,
}) => {
  const dragRef = useRef<{ x: number; startAngle: number; lastPosition: CameraPositionId | '' } | null>(null);
  const activePosition = position || 'front';

  const markerLayout = useMemo(() => (
    POSITION_MARKERS.map(marker => {
      const active = marker.option.id === activePosition;
      return {
        ...marker,
        active,
        scale: active ? 1.34 : marker.baseScale,
        zIndex: marker.baseZIndex + (active ? 60 : 0),
      };
    })
  ), [activePosition]);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    dragRef.current = {
      x: event.clientX,
      startAngle: POSITION_ANGLES[activePosition],
      lastPosition: activePosition,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || disabled) return;
    const nextAngle = normalizeDeg(drag.startAngle - (event.clientX - drag.x) * 0.72);
    const nextPosition = positionForAngle(nextAngle);
    if (nextPosition !== drag.lastPosition) {
      drag.lastPosition = nextPosition;
      onChange(nextPosition, height || 'eye');
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    dragRef.current = null;
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' }}>
      <div
        data-camera-position-canvas="simulated"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: 'relative',
          flex: '1 1 280px',
          minWidth: 230,
          minHeight: 154,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'radial-gradient(circle at 50% 32%, rgba(99,102,241,0.20), rgba(15,23,42,0.40) 58%, rgba(2,6,23,0.58))',
          overflow: 'hidden',
          opacity: disabled ? 0.62 : 1,
          touchAction: 'none',
          cursor: disabled ? 'not-allowed' : 'grab',
          userSelect: 'none',
          contain: 'layout paint',
        }}
      >
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 82,
          width: 270,
          height: 92,
          transform: 'translate(-50%, -50%) rotateX(62deg)',
          borderRadius: '50%',
          border: '2px solid rgba(129,140,248,0.28)',
          background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.16), rgba(99,102,241,0.04) 58%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          inset: 'auto 0 0',
          height: 74,
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.13) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          transform: 'perspective(260px) rotateX(58deg)',
          transformOrigin: '50% 100%',
          opacity: 0.48,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 58,
          transform: 'translate(-50%, -50%)',
          zIndex: 75,
          pointerEvents: 'none',
        }}>
          <SubjectGlyph />
        </div>

        {markerLayout.map(marker => (
          <button
            key={marker.option.id}
            type="button"
            onPointerDown={event => event.stopPropagation()}
            onClick={() => !disabled && onChange(marker.option.id, height || 'eye')}
            disabled={disabled}
            title={marker.option.label}
            aria-label={marker.option.label}
            style={{
              position: 'absolute',
              left: `calc(50% + ${marker.x}px)`,
              top: marker.baseTop,
              transform: 'translate(-50%, -50%)',
              zIndex: marker.zIndex,
              width: marker.option.id === 'over-shoulder' ? 42 : 34,
              height: 30,
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              borderRadius: marker.option.id === 'over-shoulder' ? 8 : 999,
              border: `1px solid ${marker.active ? 'rgba(196,181,253,0.92)' : 'rgba(129,140,248,0.26)'}`,
              background: marker.active ? 'rgba(124,58,237,0.36)' : 'rgba(15,23,42,0.35)',
              color: '#C4B5FD',
              opacity: marker.active ? 1 : marker.baseOpacity,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'transform .14s ease, opacity .14s ease, border-color .14s ease, background .14s ease',
              backdropFilter: 'blur(4px)',
            }}
          >
            {marker.option.id === 'over-shoulder'
              ? <span style={{ fontSize: 9, fontWeight: 800 }}>OTS</span>
              : <CameraGlyph active={marker.active} scale={marker.scale} yaw={marker.yaw} />}
          </button>
        ))}
      </div>

      <div style={{ flex: '1 1 150px', minWidth: 140, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
          Altura
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CAMERA_HEIGHT_OPTIONS.map(option => {
            const active = (height || 'eye') === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(position || 'front', option.id)}
                disabled={disabled}
                className="btn btn-ghost"
                style={{
                  fontSize: 11,
                  padding: '5px 8px',
                  color: active ? '#C4B5FD' : 'var(--text-3)',
                  borderColor: active ? 'rgba(139,92,246,0.55)' : 'var(--border-md)',
                  background: active ? 'rgba(139,92,246,0.12)' : undefined,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.35, marginTop: 8 }}>
          Arraste para girar a câmera em volta do assunto.
        </p>

        {(position || height) && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            disabled={disabled}
            style={{
              marginTop: 7,
              fontSize: 11,
              color: 'var(--text-4)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Limpar posição
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(CameraPositionControl);
