// ── Motor de animação de slot (entrada/saída) ────────────────────────────────
// Helper puro e independente de framework que reproduz o MESMO vocabulário visual
// do lettering do vídeo (ver components/video/StoryboardComposition.tsx): dado o
// tipo de entrada/saída e o progresso 0→1 de cada fase, devolve um estilo CSS
// ({ opacity, transform, filter }). Reutilizável no preview do editor, no card
// estático (frame assentado) e, futuramente, na composição Remotion.

import type {
  VideoKenBurnsConfig,
  VideoLetteringEnterAnimation,
  VideoLetteringExitAnimation,
} from '../../types';

export interface SlotAnimation {
  enter: VideoLetteringEnterAnimation;
  exit: VideoLetteringExitAnimation;
  /** Início da entrada, em segundos relativos ao clipe/cena. Default 0. */
  startSeconds?: number;
  /** Fim (gatilho da saída). Ausente = permanece até o fim. */
  endSeconds?: number;
  enterDurationSeconds?: number;
  exitDurationSeconds?: number;
  kenBurns?: VideoKenBurnsConfig;
  kenBurnsDurationSeconds?: number;
}

export interface EnterExitStyle {
  opacity: number;
  transform?: string;
  /** Movimento interno do conteúdo, mantendo a caixa/máscara exterior fixa. */
  contentTransform?: string;
  filter?: string;
}

const DEFAULT_ENTER_SECONDS = 0.5;
const DEFAULT_EXIT_SECONDS = 0.5;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, t: number): number => from + (to - from) * clamp01(t);

const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const easeOutBounce = (t: number): number => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) {
    const x = t - 1.5 / d1;
    return n1 * x * x + 0.75;
  }
  if (t < 2.5 / d1) {
    const x = t - 2.25 / d1;
    return n1 * x * x + 0.9375;
  }
  const x = t - 2.625 / d1;
  return n1 * x * x + 0.984375;
};

const kenBurnsTransform = (
  config: VideoKenBurnsConfig | undefined,
  progress: number,
): string | undefined => {
  if (!config || config.direction === 'none') return undefined;
  const intensity = Math.max(0, Math.min(0.4, config.intensity));
  const eased = clamp01(progress);
  switch (config.direction) {
    case 'zoom-in':
      return `scale(${1 + intensity * eased})`;
    case 'zoom-out':
      return `scale(${1 + intensity - intensity * eased})`;
    case 'pan-left':
      return `scale(${1 + intensity}) translateX(${lerp(intensity * 50, -intensity * 50, eased)}%)`;
    case 'pan-right':
      return `scale(${1 + intensity}) translateX(${lerp(-intensity * 50, intensity * 50, eased)}%)`;
    case 'pan-up':
      return `scale(${1 + intensity}) translateY(${lerp(intensity * 50, -intensity * 50, eased)}%)`;
    case 'pan-down':
      return `scale(${1 + intensity}) translateY(${lerp(-intensity * 50, intensity * 50, eased)}%)`;
    default:
      return undefined;
  }
};

/**
 * Estilo CSS para um slot dado o progresso de entrada e de saída (cada um 0→1).
 * Espelha o mapeamento do lettering: offsets em px, escala, blur e opacidade.
 */
export const enterExitStyle = (
  enter: VideoLetteringEnterAnimation,
  exit: VideoLetteringExitAnimation,
  enterProgress: number,
  exitProgress: number,
): EnterExitStyle => {
  const eP = clamp01(enterProgress);
  const xP = clamp01(exitProgress);

  let offsetX = 0;
  let offsetY = 0;
  let scale = 1;
  let skew = 0;
  let blur = 0;

  // ── Entrada ──
  if (enter === 'slide-left') offsetX += lerp(-48, 0, eP);
  else if (enter === 'slide-up') offsetY += lerp(30, 0, eP);
  else if (enter === 'rise') offsetY += lerp(80, 0, eP);
  else if (enter === 'zoom') scale *= lerp(0.88, 1, eP);
  else if (enter === 'bounce') scale *= easeOutBounce(eP);
  else if (enter === 'pop') scale *= easeOutBack(eP);
  else if (enter === 'blur-in') blur += lerp(24, 0, eP);
  else if (enter === 'glitch') offsetX += (1 - eP) * 6;

  // ── Saída ──
  if (exit === 'slide-right') offsetX += lerp(0, 48, xP);
  else if (exit === 'slide-down') offsetY += lerp(0, 30, xP);
  else if (exit === 'zoom') scale *= lerp(1, 0.88, xP);
  else if (exit === 'pop-out') scale *= lerp(1, 1.4, xP);
  else if (exit === 'blur-out') blur += lerp(0, 24, xP);
  else if (exit === 'swipe-out') {
    offsetX += lerp(0, 120, xP);
    skew += lerp(0, -8, xP);
  }

  const opacity = (enter === 'none' ? 1 : eP) * (exit === 'none' ? 1 : 1 - xP);

  const transforms: string[] = [];
  if (offsetX !== 0 || offsetY !== 0) transforms.push(`translate(${offsetX}px, ${offsetY}px)`);
  if (scale !== 1) transforms.push(`scale(${scale})`);
  if (skew !== 0) transforms.push(`skewX(${skew}deg)`);

  return {
    opacity,
    transform: transforms.length ? transforms.join(' ') : undefined,
    filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
  };
};

/** Estilo do slot num instante `t` (segundos), a partir da sua configuração. */
export const slotStyleAtTime = (animation: SlotAnimation, t: number): EnterExitStyle => {
  const start = animation.startSeconds ?? 0;
  const enterDuration = Math.max(0.01, animation.enterDurationSeconds ?? DEFAULT_ENTER_SECONDS);
  const exitDuration = Math.max(0.01, animation.exitDurationSeconds ?? DEFAULT_EXIT_SECONDS);

  const enterProgress = clamp01((t - start) / enterDuration);
  const exitProgress =
    animation.endSeconds == null
      ? 0
      : clamp01((t - (animation.endSeconds - exitDuration)) / exitDuration);

  const style = enterExitStyle(animation.enter, animation.exit, enterProgress, exitProgress);
  const kenBurnsDuration = Math.max(0.1, animation.kenBurnsDurationSeconds ?? 5);
  const kenBurnsProgress = clamp01((t - start) / kenBurnsDuration);
  const kenBurns = kenBurnsTransform(animation.kenBurns, kenBurnsProgress);
  return {
    ...style,
    contentTransform: kenBurns,
  };
};

/** Duração total sugerida para uma timeline de preview, dado o conjunto de animações. */
export const previewDurationSeconds = (animations: SlotAnimation[]): number => {
  let max = 2;
  for (const animation of animations) {
    const start = animation.startSeconds ?? 0;
    const enterDuration = animation.enterDurationSeconds ?? DEFAULT_ENTER_SECONDS;
    const settled = start + enterDuration + 1.2;
    const kenBurnsEnd = animation.kenBurns
      ? start + (animation.kenBurnsDurationSeconds ?? 5)
      : 0;
    max = Math.max(
      max,
      animation.endSeconds != null ? animation.endSeconds + 0.6 : settled,
      kenBurnsEnd,
    );
  }
  return max;
};
