import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const COLORS = ['#7C3AED', '#06B6D4', '#F97316', '#FACC15', '#EC4899'];
const SHAPE_PATHS = [
  'circle(50%)',
  'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
  'polygon(25% 7%, 75% 7%, 100% 50%, 75% 93%, 25% 93%, 0 50%)',
  'inset(8% round 18%)',
  'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 94%, 50% 72%, 21% 94%, 32% 57%, 2% 35%, 39% 35%)',
];

const DiagonalShapesOverlay: React.FC<{ durationFrames: number }> = ({
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const progress = interpolate(frame, [0, Math.max(1, durationFrames - 1)], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const travel = interpolate(progress, [0, 1], [-0.72 * width, 1.72 * width]);
  const size = Math.max(width, height) * 0.3;
  const overlayOpacity = interpolate(
    progress,
    [0, 0.08, 0.9, 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const bandWidth = Math.max(width, height) * 0.42;

  return (
    <AbsoluteFill
      data-transition-overlay="diagonal-shapes"
      style={{ pointerEvents: 'none', overflow: 'hidden', opacity: overlayOpacity }}
    >
      <div
        data-transition-ribbon="shadow"
        style={{
          position: 'absolute',
          left: travel - bandWidth * 0.1,
          top: '50%',
          width: bandWidth,
          height: height * 2.2,
          background: 'rgba(2, 6, 23, .34)',
          filter: `blur(${Math.max(10, width * 0.009)}px)`,
          transform: 'translate(-50%, -50%) rotate(22deg)',
        }}
      />
      <div
        data-transition-ribbon="main"
        style={{
          position: 'absolute',
          left: travel,
          top: '50%',
          width: bandWidth,
          height: height * 2.2,
          overflow: 'hidden',
          background: 'linear-gradient(90deg, #4C1D95 0%, #7C3AED 20%, #0E7490 52%, #0891B2 100%)',
          boxShadow: '0 0 0 1px rgba(255,255,255,.14), 0 28px 70px rgba(2,6,23,.36)',
          transform: 'translate(-50%, -50%) rotate(22deg)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent 0 12%, rgba(255,255,255,.2) 12% 14%, transparent 14% 74%, rgba(255,255,255,.32) 74% 75%, transparent 75%)',
          }}
        />
      </div>
      {COLORS.map((color, index) => {
        const stagger = index * 0.035;
        const localProgress = interpolate(
          progress,
          [stagger, Math.min(1, 0.78 + stagger)],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        const offset = (index - 2) * size * 0.72;
        const x = travel + offset * 0.38;
        const y = height * 0.5 - offset;
        const rotation = -12 + index * 17 + localProgress * (index % 2 === 0 ? 38 : -30);
        const scale = interpolate(localProgress, [0, 0.16, 1], [0.72, 1.06, 1]);
        return (
          <div
            key={color}
            data-transition-shape={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              background: color,
              clipPath: SHAPE_PATHS[index],
              border: '1px solid rgba(255,255,255,.32)',
              transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12), 0 20px 48px rgba(2,6,23,.3)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(145deg, rgba(255,255,255,.3), transparent 42%, rgba(15,23,42,.16))',
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default DiagonalShapesOverlay;
