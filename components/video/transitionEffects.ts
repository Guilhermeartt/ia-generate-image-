import { interpolate } from 'remotion';
import type { VideoClipTransition } from '@/types';

export interface TransitionVisual {
  transform?: string;
  transformOrigin?: string;
  opacity?: number;
  clipPath?: string;
  filter?: string;
  maskImage?: string;
  WebkitMaskImage?: string;
}

interface TransitionStyleArgs {
  type: VideoClipTransition;
  enterProgress: number;
  exitProgress: number;
  isIncoming: boolean;
}

const polygonPoints = (
  pointCount: number,
  radius: number,
  innerRadius?: number,
): string => Array.from({ length: pointCount }, (_, index) => {
  const angle = -Math.PI / 2 + (index / pointCount) * Math.PI * 2;
  const pointRadius = innerRadius !== undefined && index % 2 === 1 ? innerRadius : radius;
  const x = 50 + Math.cos(angle) * pointRadius;
  const y = 50 + Math.sin(angle) * pointRadius;
  return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
}).join(', ');

const shapeReveal = (
  progress: number,
  shape: 'diamond' | 'hexagon' | 'star',
): TransitionVisual => {
  if (progress >= 0.999) return {};
  if (shape === 'diamond') {
    return { clipPath: `polygon(${polygonPoints(4, progress * 112)})` };
  }
  if (shape === 'hexagon') {
    return { clipPath: `polygon(${polygonPoints(6, progress * 132)})` };
  }
  return {
    clipPath: `polygon(${polygonPoints(10, progress * 190, progress * 132)})`,
  };
};

export const transitionStyle = ({
  type,
  enterProgress,
  exitProgress,
  isIncoming,
}: TransitionStyleArgs): TransitionVisual => {
  switch (type) {
    case 'cut':
    case 'fade-black':
    case 'fade-white':
      return {};
    case 'crossfade':
      return isIncoming ? { opacity: enterProgress } : {};
    case 'blur':
      return isIncoming
        ? { opacity: enterProgress, filter: `blur(${interpolate(enterProgress, [0, 1], [18, 0])}px)` }
        : { filter: `blur(${interpolate(exitProgress, [0, 1], [0, 18])}px)` };
    case 'zoom':
      return isIncoming
        ? { opacity: enterProgress, transform: `scale(${interpolate(enterProgress, [0, 1], [0.72, 1])})` }
        : { transform: `scale(${interpolate(exitProgress, [0, 1], [1, 1.18])})` };
    case 'zoom-blur':
      return isIncoming
        ? {
            opacity: enterProgress,
            transform: `scale(${interpolate(enterProgress, [0, 1], [1.16, 1])})`,
            filter: `blur(${interpolate(enterProgress, [0, 1], [20, 0])}px)`,
          }
        : {
            opacity: interpolate(exitProgress, [0, 1], [1, 0.55]),
            transform: `scale(${interpolate(exitProgress, [0, 1], [1, 0.94])})`,
            filter: `blur(${interpolate(exitProgress, [0, 1], [0, 12])}px)`,
          };
    case 'whip-left':
    case 'whip-right': {
      const direction = type === 'whip-left' ? -1 : 1;
      return isIncoming
        ? {
            opacity: enterProgress,
            transform: `translateX(${interpolate(enterProgress, [0, 1], [-direction * 12, 0])}%) scale(${interpolate(enterProgress, [0, 1], [1.12, 1])})`,
            filter: `blur(${interpolate(enterProgress, [0, 1], [24, 0])}px)`,
          }
        : {
            opacity: interpolate(exitProgress, [0, 1], [1, 0.4]),
            transform: `translateX(${interpolate(exitProgress, [0, 1], [0, direction * 12])}%) scale(${interpolate(exitProgress, [0, 1], [1, 1.12])})`,
            filter: `blur(${interpolate(exitProgress, [0, 1], [0, 20])}px)`,
          };
    }
    case 'iris':
      return isIncoming
        ? { clipPath: `circle(${interpolate(enterProgress, [0, 1], [0, 72])}% at 50% 50%)` }
        : {};
    case 'clock-wipe': {
      if (!isIncoming) return {};
      const angle = Math.max(0.1, enterProgress * 360);
      const maskImage = `conic-gradient(from -90deg at 50% 50%, #000 0deg ${angle}deg, transparent ${angle}deg 360deg)`;
      return { maskImage, WebkitMaskImage: maskImage };
    }
    case 'shape-diamond':
      return isIncoming ? shapeReveal(enterProgress, 'diamond') : {};
    case 'shape-hexagon':
      return isIncoming ? shapeReveal(enterProgress, 'hexagon') : {};
    case 'shape-star':
      return isIncoming ? shapeReveal(enterProgress, 'star') : {};
    case 'shape-diagonal':
      return isIncoming
        ? {
            clipPath: `polygon(0 0, ${interpolate(enterProgress, [0, 1], [-35, 100])}% 0, ${interpolate(enterProgress, [0, 1], [0, 135])}% 100%, 0 100%)`,
            transform: `scale(${interpolate(enterProgress, [0, 1], [1.025, 1])})`,
          }
        : {};
    case 'slide-left':
      return isIncoming
        ? { transform: `translateX(${interpolate(enterProgress, [0, 1], [100, 0])}%)` }
        : { transform: `translateX(${interpolate(exitProgress, [0, 1], [0, -100])}%)` };
    case 'slide-right':
      return isIncoming
        ? { transform: `translateX(${interpolate(enterProgress, [0, 1], [-100, 0])}%)` }
        : { transform: `translateX(${interpolate(exitProgress, [0, 1], [0, 100])}%)` };
    case 'slide-up':
      return isIncoming
        ? { transform: `translateY(${interpolate(enterProgress, [0, 1], [100, 0])}%)` }
        : { transform: `translateY(${interpolate(exitProgress, [0, 1], [0, -100])}%)` };
    case 'slide-down':
      return isIncoming
        ? { transform: `translateY(${interpolate(enterProgress, [0, 1], [-100, 0])}%)` }
        : { transform: `translateY(${interpolate(exitProgress, [0, 1], [0, 100])}%)` };
    case 'wipe-left':
      return isIncoming ? { clipPath: `inset(0 ${interpolate(enterProgress, [0, 1], [100, 0])}% 0 0)` } : {};
    case 'wipe-right':
      return isIncoming ? { clipPath: `inset(0 0 0 ${interpolate(enterProgress, [0, 1], [100, 0])}%)` } : {};
    case 'wipe-up':
      return isIncoming ? { clipPath: `inset(${interpolate(enterProgress, [0, 1], [100, 0])}% 0 0 0)` } : {};
    case 'wipe-down':
      return isIncoming ? { clipPath: `inset(0 0 ${interpolate(enterProgress, [0, 1], [100, 0])}% 0)` } : {};
    default:
      return {};
  }
};
