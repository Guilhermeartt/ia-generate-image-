import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {
  Scene,
  SceneTemplateElement,
  SceneTemplateSlotOverride,
  SceneVideoLettering,
  VideoAudioTrack,
  VideoClipTransition,
  VideoKenBurnsConfig,
  VideoLetteringPosition,
  VideoTransitionEasing,
} from '@/types';
import { placeClipsOnTimeline } from './videoScenes';
import { listSlots } from '../svg-editor/svgDocument';
import { buildSceneSlotStyles, resolveSlotContents } from '../svg-editor/templateBinding';
import { slotStyleAtTime, type EnterExitStyle } from '../svg-editor/slotAnimation';
import { renderTemplate } from '../svg-editor/templateRender';

export interface StoryboardVideoScene {
  id: string;
  sceneId: number;
  parentSceneId: number;
  sourceId: string;
  sourceLabel: string;
  parentSceneClipIndex: number;
  parentSceneClipCount: number;
  imageUrl: string;
  title: string;
  location: string;
  description: string;
  lettering: SceneVideoLettering;
  durationSeconds: number;
  kenBurns: VideoKenBurnsConfig;
  transitionIn: VideoClipTransition;
  transitionDurationSeconds: number;
  transitionEasing: VideoTransitionEasing;
  hasOverride: boolean;
  parentSceneOffsetSeconds: number;
  parentSceneDurationSeconds: number;
  /** Modelo de cena aplicado (id do template). Resolvido para markup via templateMarkups. */
  templateId?: string;
  /** Instância editável do modelo para esta cena. */
  templateOverrides?: Record<string, SceneTemplateSlotOverride>;
  /** Elementos adicionados sobre o modelo somente nesta cena. */
  templateElements?: SceneTemplateElement[];
}

export interface StoryboardCompositionProps {
  scenes: StoryboardVideoScene[];
  showCaptions: boolean;
  fps: number;
  audio?: VideoAudioTrack;
  /** Markup dos modelos por id, para clipes que usam um modelo de cena. */
  templateMarkups?: Record<string, string>;
}

const kenBurnsTransform = (
  config: VideoKenBurnsConfig,
  progress: number,
): { transform: string } => {
  const intensity = Math.max(0, Math.min(0.4, config.intensity));
  const eased = progress;
  switch (config.direction) {
    case 'zoom-in':
      return { transform: `scale(${1 + intensity * eased})` };
    case 'zoom-out':
      return { transform: `scale(${1 + intensity - intensity * eased})` };
    case 'pan-left':
      return {
        transform: `scale(${1 + intensity}) translateX(${interpolate(eased, [0, 1], [intensity * 50, -intensity * 50])}%)`,
      };
    case 'pan-right':
      return {
        transform: `scale(${1 + intensity}) translateX(${interpolate(eased, [0, 1], [-intensity * 50, intensity * 50])}%)`,
      };
    case 'pan-up':
      return {
        transform: `scale(${1 + intensity}) translateY(${interpolate(eased, [0, 1], [intensity * 50, -intensity * 50])}%)`,
      };
    case 'pan-down':
      return {
        transform: `scale(${1 + intensity}) translateY(${interpolate(eased, [0, 1], [-intensity * 50, intensity * 50])}%)`,
      };
    case 'none':
    default:
      return { transform: 'none' };
  }
};

// ─── Easing das transições (ease-in / ease-out / ease-in-out / linear) ───
const EASING_FN: Record<VideoTransitionEasing, (t: number) => number> = {
  'linear': Easing.linear,
  'ease-in': Easing.in(Easing.cubic),
  'ease-out': Easing.out(Easing.cubic),
  'ease-in-out': Easing.inOut(Easing.cubic),
};

const resolveEasing = (easing: VideoTransitionEasing | undefined): ((t: number) => number) =>
  EASING_FN[easing ?? 'ease-in-out'] ?? EASING_FN['ease-in-out'];

interface TransitionVisual {
  transform?: string;
  opacity?: number;
  clipPath?: string;
  filter?: string;
}

interface TransitionStyleArgs {
  type: VideoClipTransition;
  enterProgress: number;
  exitProgress: number;
  isIncoming: boolean;
}

/**
 * Estilo aplicado a um clipe para uma transição.
 *
 * - `isIncoming`: o clipe está ENTRANDO (usa enterProgress 0→1).
 * - caso contrário: o clipe está SAINDO para dar lugar ao próximo (usa exitProgress 0→1),
 *   e `type` é a transição do PRÓXIMO clipe.
 *
 * Crossfade/blur mantêm o clipe de saída opaco e só revelam o de entrada por cima,
 * evitando o "buraco" escuro no meio. Slides usam empurrão (push) para nunca abrir
 * vão. Fades são tratados por overlay de cor (ver ClipLayer).
 */
const transitionStyle = ({ type, enterProgress, exitProgress, isIncoming }: TransitionStyleArgs): TransitionVisual => {
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

/**
 * Funde o estilo de entrada (deste clipe) com o de saída (rumo ao próximo) sem que um
 * sobrescreva o outro: concatena transforms/filters, MULTIPLICA opacidades e mantém o
 * clipPath definido. Era exatamente o bug antigo — o spread `{...in, ...out}` zerava a
 * transição de entrada sempre que havia uma transição de saída.
 */
const mergeTransitionVisuals = (
  incoming: TransitionVisual,
  outgoing: TransitionVisual,
): React.CSSProperties => {
  const transforms = [incoming.transform, outgoing.transform]
    .filter((value): value is string => typeof value === 'string' && value !== 'none');
  const filters = [incoming.filter, outgoing.filter]
    .filter((value): value is string => typeof value === 'string' && !/blur\(0(?:px)?\)/.test(value));
  const opacity = (incoming.opacity ?? 1) * (outgoing.opacity ?? 1);
  return {
    transform: transforms.length ? transforms.join(' ') : undefined,
    filter: filters.length ? filters.join(' ') : undefined,
    opacity,
    clipPath: incoming.clipPath ?? outgoing.clipPath,
  };
};

interface ClipLayerProps {
  clip: StoryboardVideoScene;
  durationFrames: number;
  transitionInFrames: number;
  nextTransitionInFrames: number;
  nextTransitionType: VideoClipTransition;
  nextTransitionEasing: VideoTransitionEasing;
  showCaptions: boolean;
  fps: number;
  templateMarkup?: string;
}

const isFadeColorTransition = (type: VideoClipTransition): boolean =>
  type === 'fade-black' || type === 'fade-white';

const ClipLayer: React.FC<ClipLayerProps> = ({
  clip,
  durationFrames,
  transitionInFrames,
  nextTransitionInFrames,
  nextTransitionType,
  nextTransitionEasing,
  showCaptions,
  fps,
  templateMarkup,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const baseSize = Math.min(width, height);

  // ── Modelo de cena (template): substitui a imagem/lettering quando presente ──
  const templateSlots = useMemo(
    () => (templateMarkup ? listSlots(templateMarkup) : []),
    [templateMarkup],
  );
  const templateComposed = useMemo(() => {
    if (!templateMarkup) return null;
    const syntheticScene = {
      imageUrl: clip.imageUrl,
      lettering_notes: clip.lettering.text ? [clip.lettering.text] : [],
      original_description: clip.description,
      original_location: clip.location,
    } as unknown as Scene;
    const contents = resolveSlotContents(templateSlots, syntheticScene, clip.templateOverrides);
    const localTime = frame / fps;
    const animatedById: Record<string, EnterExitStyle> = {};
    for (const slot of templateSlots) {
      const animationOverride = clip.templateOverrides?.[slot.id]?.animation;
      const animation = animationOverride === null ? undefined : animationOverride ?? slot.animation;
      if (animation) animatedById[slot.id] = slotStyleAtTime(animation, localTime);
    }
    const styleById = buildSceneSlotStyles(templateSlots, clip.templateOverrides, animatedById);
    const additionalStyleById: Record<string, EnterExitStyle> = {};
    for (const element of clip.templateElements ?? []) {
      if (element.animation) {
        additionalStyleById[element.id] = slotStyleAtTime(element.animation, localTime);
      }
    }
    return renderTemplate(templateMarkup, contents, {
      styleById,
      additionalElements: clip.templateElements,
      additionalStyleById,
    });
  }, [templateMarkup, templateSlots, clip, frame, fps]);

  // Ken Burns com aceleração suave (ease-in-out) nas pontas — movimento mais premium.
  const kenBurnsProgress = interpolate(frame, [0, Math.max(1, durationFrames - 1)], [0, 1], {
    easing: Easing.inOut(Easing.sin),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const kenBurns = kenBurnsTransform(clip.kenBurns, kenBurnsProgress);

  const enterEasing = resolveEasing(clip.transitionEasing);
  const exitEasing = resolveEasing(nextTransitionEasing);

  const enterProgress = transitionInFrames === 0
    ? 1
    : interpolate(frame, [0, transitionInFrames], [0, 1], {
        easing: enterEasing,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const exitStart = Math.max(0, durationFrames - nextTransitionInFrames);
  const exitProgress = nextTransitionInFrames === 0
    ? 0
    : interpolate(frame, [exitStart, durationFrames], [0, 1], {
        easing: exitEasing,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  const incomingStyle = transitionStyle({
    type: clip.transitionIn,
    enterProgress,
    exitProgress: 0,
    isIncoming: true,
  });
  const outgoingStyle = transitionStyle({
    type: nextTransitionType,
    enterProgress: 1,
    exitProgress,
    isIncoming: false,
  });
  const transitionCss = mergeTransitionVisuals(incomingStyle, outgoingStyle);

  // Overlay de cor para fades (preto/branco). Como esses clipes ficam sequenciais
  // (sem overlap), o de saída escurece por completo e o de entrada surge a partir
  // da cor — um verdadeiro fade-to-color sem sobreposição fantasma.
  const enterFade = isFadeColorTransition(clip.transitionIn) ? 1 - enterProgress : 0;
  const exitFade = isFadeColorTransition(nextTransitionType) ? exitProgress : 0;
  const fadeOverlayOpacity = Math.max(enterFade, exitFade);
  const fadeColor = enterFade >= exitFade
    ? (clip.transitionIn === 'fade-white' ? '#ffffff' : '#000000')
    : (nextTransitionType === 'fade-white' ? '#ffffff' : '#000000');

  // Quando há modelo de cena, ele é a apresentação completa do clipe: substitui a
  // imagem nua + gradientes + lettering (os textos vêm dos slots do modelo).
  if (templateComposed != null) {
    return (
      <AbsoluteFill style={transitionCss}>
        <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: kenBurns.transform,
              transformOrigin: 'center center',
            }}
            dangerouslySetInnerHTML={{ __html: templateComposed }}
          />
        </AbsoluteFill>
        {fadeOverlayOpacity > 0 && (
          <AbsoluteFill
            style={{ background: fadeColor, opacity: fadeOverlayOpacity, pointerEvents: 'none' }}
          />
        )}
      </AbsoluteFill>
    );
  }

  const letteringStartFrame = Math.max(
    0,
    Math.round((clip.lettering.startSeconds ?? 0.2) * fps) - Math.round(clip.parentSceneOffsetSeconds * fps),
  );
  const parentDurationFrames = Math.max(
    1,
    Math.round(clip.parentSceneDurationSeconds * fps),
  );
  const configuredEndSeconds = clip.lettering.endSeconds ?? clip.parentSceneDurationSeconds;
  const letteringEndFrame = Math.max(
    letteringStartFrame + 1,
    Math.round(configuredEndSeconds * fps) - Math.round(clip.parentSceneOffsetSeconds * fps),
  );
  const safeLetteringEnd = Math.min(durationFrames, letteringEndFrame);

  const enterDurFrames = Math.max(1, Math.round((clip.lettering.enterDurationSeconds ?? 0.35) * fps));
  const exitDurFrames = Math.max(1, Math.round((clip.lettering.exitDurationSeconds ?? 0.25) * fps));

  const letteringEnter = interpolate(
    frame,
    [letteringStartFrame, Math.min(safeLetteringEnd, letteringStartFrame + enterDurFrames)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const letteringExit = interpolate(
    frame,
    [Math.max(letteringStartFrame, safeLetteringEnd - exitDurFrames), safeLetteringEnd],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const isLetteringActive = frame >= letteringStartFrame && frame < safeLetteringEnd
    && parentDurationFrames > 0;

  const enterAnim = clip.lettering.enterAnimation ?? 'slide-up';
  const exitAnim = clip.lettering.exitAnimation ?? 'fade';

  // Easing helpers
  const easeOutBack = (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const easeOutBounce = (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { const x = t - 1.5 / d1; return n1 * x * x + 0.75; }
    if (t < 2.5 / d1) { const x = t - 2.25 / d1; return n1 * x * x + 0.9375; }
    const x = t - 2.625 / d1;
    return n1 * x * x + 0.984375;
  };

  // ─── Enter offsets/transforms ───
  let enterOffsetX = 0;
  let enterOffsetY = 0;
  let enterScale = 1;
  let enterBlur = 0;
  let enterGlitchOffset = 0;
  let typewriterRatio = 1;

  if (enterAnim === 'slide-left') enterOffsetX = interpolate(letteringEnter, [0, 1], [-48, 0]);
  else if (enterAnim === 'slide-up') enterOffsetY = interpolate(letteringEnter, [0, 1], [30, 0]);
  else if (enterAnim === 'rise') enterOffsetY = interpolate(letteringEnter, [0, 1], [80, 0]);
  else if (enterAnim === 'zoom') enterScale = interpolate(letteringEnter, [0, 1], [0.88, 1]);
  else if (enterAnim === 'bounce') enterScale = easeOutBounce(letteringEnter);
  else if (enterAnim === 'pop') enterScale = easeOutBack(letteringEnter);
  else if (enterAnim === 'blur-in') enterBlur = interpolate(letteringEnter, [0, 1], [24, 0]);
  else if (enterAnim === 'typewriter') typewriterRatio = letteringEnter;
  else if (enterAnim === 'glitch') enterGlitchOffset = (1 - letteringEnter) * baseSize * 0.012;

  // ─── Exit offsets/transforms ───
  let exitOffsetX = 0;
  let exitOffsetY = 0;
  let exitScale = 1;
  let exitBlur = 0;
  let exitSkew = 0;

  if (exitAnim === 'slide-right') exitOffsetX = interpolate(letteringExit, [0, 1], [0, 48]);
  else if (exitAnim === 'slide-down') exitOffsetY = interpolate(letteringExit, [0, 1], [0, 30]);
  else if (exitAnim === 'zoom') exitScale = interpolate(letteringExit, [0, 1], [1, 0.88]);
  else if (exitAnim === 'pop-out') exitScale = interpolate(letteringExit, [0, 1], [1, 1.4]);
  else if (exitAnim === 'blur-out') exitBlur = interpolate(letteringExit, [0, 1], [0, 24]);
  else if (exitAnim === 'swipe-out') { exitOffsetX = interpolate(letteringExit, [0, 1], [0, 120]); exitSkew = interpolate(letteringExit, [0, 1], [0, -8]); }
  // dissolve uses opacity only

  const letteringOpacity =
    (enterAnim === 'none' ? 1 : letteringEnter)
    * (exitAnim === 'none' ? 1 : 1 - letteringExit)
    * (clip.lettering.textOpacity ?? 1);

  const style = clip.lettering.style;
  const isBox = style === 'box';
  const isCinematic = style === 'cinematic';
  const isTitle = style === 'title';
  const isLowerThird = style === 'lower-third';
  const isGlass = style === 'glass';
  const isNeon = style === 'neon';
  const isSubtitle = style === 'subtitle';
  const isMarker = style === 'marker';
  const isGradient = style === 'gradient';
  const isOutline = style === 'outline';
  const isCgBox = style === 'cg-box';

  // ── Estilo CG (cg-box): chanfro, logo e ajuste fino de posição ──
  const chamferSide = clip.lettering.chamferSide ?? 'none';
  const chamferSize = Math.max(0, Math.min(60, clip.lettering.chamferSize ?? 0));
  const cgClipPath = !isCgBox || chamferSide === 'none' || chamferSize === 0
    ? undefined
    : chamferSide === 'left' ? `polygon(${chamferSize}% 0, 100% 0, 100% 100%, 0 100%)`
    : chamferSide === 'right' ? `polygon(0 0, 100% 0, ${100 - chamferSize}% 100%, 0 100%)`
    : chamferSide === 'top' ? `polygon(0 ${chamferSize}%, 100% 0, 100% 100%, 0 100%)`
    : `polygon(0 0, 100% 0, 100% ${100 - chamferSize}%, 0 100%)`;
  const logoUrl = isCgBox ? clip.lettering.logoUrl : undefined;
  const logoPosition = clip.lettering.logoPosition ?? 'bottom-right';
  const logoOnTop = logoPosition.startsWith('top');
  const logoWidthPx = baseSize * (Math.max(2, Math.min(40, clip.lettering.logoSizePercent ?? 16)) / 100);
  const logoAlignSelf = logoPosition.endsWith('left') ? 'flex-start'
    : logoPosition.endsWith('right') ? 'flex-end'
    : 'center';
  const offsetXPx = width * ((clip.lettering.offsetXPercent ?? 0) / 100);
  const offsetYPx = height * ((clip.lettering.offsetYPercent ?? 0) / 100);
  const cgBasePad = baseSize * 0.024;
  // Padding extra no lado chanfrado para o texto não encostar no corte diagonal.
  const cgChamferPad = cgBasePad + baseSize * (chamferSize / 100) * 0.5;
  const cgPaddingStr = isCgBox
    ? `${chamferSide === 'top' ? cgChamferPad : cgBasePad}px`
      + ` ${chamferSide === 'right' ? cgChamferPad : cgBasePad * 1.3}px`
      + ` ${chamferSide === 'bottom' ? cgChamferPad : cgBasePad}px`
      + ` ${chamferSide === 'left' ? cgChamferPad : cgBasePad * 1.3}px`
    : undefined;

  const backgroundColor = clip.lettering.backgroundColor ?? '#000000';
  const defaultBgOpacity =
    isBox || isLowerThird ? 0.72
    : isGlass ? 0.28
    : isCgBox ? 1
    : 0;
  const backgroundOpacity = clip.lettering.backgroundOpacity ?? defaultBgOpacity;
  const parsedBackground = backgroundColor.startsWith('#') && backgroundColor.length === 7
    ? `${backgroundColor}${Math.round(backgroundOpacity * 255).toString(16).padStart(2, '0')}`
    : backgroundColor;

  const textColor = clip.lettering.color;
  const textShadowDefault = '0 2px 16px rgba(0,0,0,0.75)';
  const textShadowSubtitle =
    '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 12px rgba(0,0,0,0.9)';
  const textShadowNeon = `0 0 6px ${textColor}, 0 0 14px ${textColor}, 0 0 26px ${textColor}, 0 0 42px ${textColor}, 0 0 60px ${textColor}`;
  const textShadowGlitch = enterAnim === 'glitch' && enterGlitchOffset > 0
    ? `${enterGlitchOffset}px 0 #ff3b30, ${-enterGlitchOffset}px 0 #00f0ff, 0 2px 16px rgba(0,0,0,0.75)`
    : null;

  const computedTextShadow =
    textShadowGlitch ?? (
      isNeon ? textShadowNeon
      : isSubtitle ? textShadowSubtitle
      : isOutline ? 'none'
      : textShadowDefault
    );

  const computedFilter = [
    enterBlur > 0 ? `blur(${enterBlur}px)` : '',
    exitBlur > 0 ? `blur(${exitBlur}px)` : '',
  ].filter(Boolean).join(' ');

  const gradientBackground = isGradient
    ? 'linear-gradient(135deg, #ff6ec4 0%, #7873f5 50%, #4ade80 100%)'
    : undefined;

  const positionStyles: Record<VideoLetteringPosition, React.CSSProperties> = {
    top: { top: baseSize * 0.07 },
    center: { top: '50%' },
    bottom: { bottom: baseSize * 0.07 },
  };

  // Texto efetivamente exibido (typewriter corta)
  const displayedText = typewriterRatio < 1
    ? clip.lettering.text.slice(0, Math.max(0, Math.floor(typewriterRatio * clip.lettering.text.length)))
    : clip.lettering.text;
  const showCaret = enterAnim === 'typewriter' && typewriterRatio < 1 && typewriterRatio > 0;

  return (
    <AbsoluteFill style={transitionCss}>
      <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
        <Img
          src={clip.imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: kenBurns.transform,
            transformOrigin: 'center center',
          }}
        />
        {/* Gradiente cinematográfico (escurece base e topo para destacar o lettering) */}
        <AbsoluteFill
          style={{
            background: isCinematic
              ? 'linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.04) 38%, rgba(0,0,0,0.06) 60%, rgba(0,0,0,0.86) 100%)'
              : 'linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.28))',
            pointerEvents: 'none',
          }}
        />
        {/* Vinheta sutil — profundidade e foco no centro da cena */}
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(120% 120% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.4) 100%)',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>

      {showCaptions && clip.lettering.text.trim() && isLetteringActive && (
        <div
          style={{
            position: 'absolute',
            left: width * 0.045,
            right: width * 0.045,
            ...positionStyles[clip.lettering.position],
            display: 'flex',
            flexDirection: 'column',
            alignItems:
              clip.lettering.align === 'left'
                ? 'flex-start'
                : clip.lettering.align === 'right'
                  ? 'flex-end'
                  : 'center',
            color: textColor,
            fontFamily: 'Inter, Arial, sans-serif',
            textShadow: computedTextShadow ?? undefined,
            opacity: letteringOpacity,
            filter: computedFilter || undefined,
            transform: [
              clip.lettering.position === 'center' ? 'translateY(-50%)' : '',
              `translate(${enterOffsetX + exitOffsetX + offsetXPx}px, ${enterOffsetY + exitOffsetY + offsetYPx}px)`,
              `scale(${enterScale * exitScale})`,
              exitSkew !== 0 ? `skewX(${exitSkew}deg)` : '',
            ].filter(Boolean).join(' '),
          }}
        >
          <div
            style={{
              position: 'relative',
              display: isCgBox ? 'flex' : isMarker ? 'inline-block' : 'block',
              flexDirection: isCgBox ? 'column' : undefined,
              gap: isCgBox ? baseSize * 0.014 : undefined,
              maxWidth: isTitle ? '94%' : clip.lettering.align === 'center' ? '88%' : '82%',
              padding: isCgBox
                ? cgPaddingStr
                : (isBox || isLowerThird || isGlass)
                  ? `${baseSize * 0.018}px ${baseSize * 0.026}px`
                  : isMarker
                    ? `${baseSize * 0.005}px ${baseSize * 0.015}px`
                    : 0,
              borderRadius: (clip.lettering.borderRadius
                ?? (isBox ? 14 : isLowerThird ? 6 : isGlass ? 20 : 0)) * (baseSize / 1080),
              background:
                isGradient ? gradientBackground
                : isMarker ? '#fde047'
                : backgroundOpacity > 0 ? parsedBackground
                : 'transparent',
              border:
                isBox ? '1px solid rgba(255,255,255,0.16)'
                : isGlass ? '1px solid rgba(255,255,255,0.22)'
                : 'none',
              borderLeft: isLowerThird ? `${Math.max(3, baseSize * 0.006)}px solid ${textColor}` : undefined,
              backdropFilter:
                isGlass ? 'blur(28px) saturate(140%)'
                : (isBox || isLowerThird) ? 'blur(12px)'
                : undefined,
              fontSize: baseSize * (clip.lettering.fontSize / 1080),
              fontWeight: clip.lettering.fontWeight ?? (isTitle || isGradient || isOutline ? 900 : isCinematic ? 700 : 650),
              lineHeight: 1.18,
              letterSpacing: `${clip.lettering.letterSpacing ?? (isTitle ? 0.08 : isCinematic ? 0.015 : 0)}em`,
              textTransform: isTitle || isNeon || isOutline || isCgBox ? 'uppercase' : undefined,
              textAlign: clip.lettering.align,
              whiteSpace: 'pre-line',
              color: isGradient ? 'transparent' : isOutline ? 'transparent' : textColor,
              backgroundClip: isGradient ? 'text' : undefined,
              WebkitBackgroundClip: isGradient ? 'text' : undefined,
              WebkitTextFillColor: isGradient ? 'transparent' : undefined,
              WebkitTextStrokeWidth: isOutline ? `${Math.max(1.5, baseSize * 0.0022)}px` : undefined,
              WebkitTextStrokeColor: isOutline ? textColor : undefined,
              transform: isMarker ? 'rotate(-1.5deg)' : undefined,
              transformOrigin: 'center',
              clipPath: cgClipPath,
              overflow: isCgBox ? 'hidden' : undefined,
            }}
          >
            {isCgBox ? (
              <>
                {logoUrl && logoOnTop && (
                  <Img
                    src={logoUrl}
                    style={{ width: logoWidthPx, height: 'auto', objectFit: 'contain', alignSelf: logoAlignSelf, display: 'block' }}
                  />
                )}
                <span style={{ display: 'block', width: '100%', whiteSpace: 'pre-line', textAlign: clip.lettering.align }}>
                  {displayedText}
                </span>
                {logoUrl && !logoOnTop && (
                  <Img
                    src={logoUrl}
                    style={{ width: logoWidthPx, height: 'auto', objectFit: 'contain', alignSelf: logoAlignSelf, display: 'block' }}
                  />
                )}
              </>
            ) : (
              <>
                {displayedText}
                {showCaret && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '0.06em',
                      height: '1em',
                      background: textColor,
                      marginLeft: '0.05em',
                      verticalAlign: 'text-bottom',
                      opacity: Math.floor(frame / Math.max(1, Math.round(fps / 3))) % 2 === 0 ? 1 : 0,
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {fadeOverlayOpacity > 0 && (
        <AbsoluteFill style={{ background: fadeColor, opacity: fadeOverlayOpacity, pointerEvents: 'none' }} />
      )}
    </AbsoluteFill>
  );
};

export const StoryboardComposition: React.FC<StoryboardCompositionProps> = ({
  scenes,
  showCaptions,
  fps,
  audio,
  templateMarkups,
}) => {
  const { placements, totalFrames } = useMemo(
    () => placeClipsOnTimeline(scenes, fps),
    [scenes, fps],
  );

  if (placements.length === 0) {
    return <AbsoluteFill style={{ backgroundColor: '#09090b' }} />;
  }

  const audioVolume = (frame: number) => {
    if (!audio) return 0;
    const fadeIn = Math.max(0, Math.round((audio.fadeInSeconds ?? 0) * fps));
    const fadeOut = Math.max(0, Math.round((audio.fadeOutSeconds ?? 0) * fps));
    const offsetFrames = Math.max(0, Math.round((audio.startOffsetSeconds ?? 0) * fps));
    const localFrame = frame - offsetFrames;
    if (localFrame < 0) return 0;
    const remaining = totalFrames - frame;
    const fadeInGain = fadeIn === 0 ? 1 : Math.min(1, localFrame / fadeIn);
    const fadeOutGain = fadeOut === 0 ? 1 : Math.min(1, remaining / fadeOut);
    return Math.max(0, Math.min(audio.volume, audio.volume * fadeInGain * fadeOutGain));
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b' }}>
      {placements.map((placement, index) => {
        const next = placements[index + 1];
        const nextTransitionFrames = next ? next.transitionInFrames : 0;
        const nextTransitionType: VideoClipTransition = next ? next.clip.transitionIn : 'cut';
        const nextTransitionEasing: VideoTransitionEasing = next ? next.clip.transitionEasing : 'ease-in-out';
        return (
          <Sequence
            key={placement.clip.id}
            from={placement.startFrame}
            durationInFrames={placement.durationFrames}
          >
            <ClipLayer
              clip={placement.clip}
              durationFrames={placement.durationFrames}
              transitionInFrames={placement.transitionInFrames}
              nextTransitionInFrames={nextTransitionFrames}
              nextTransitionType={nextTransitionType}
              nextTransitionEasing={nextTransitionEasing}
              showCaptions={showCaptions}
              fps={fps}
              templateMarkup={
                placement.clip.templateId ? templateMarkups?.[placement.clip.templateId] : undefined
              }
            />
          </Sequence>
        );
      })}
      {audio && (
        <Audio src={audio.src} volume={audioVolume} startFrom={0} />
      )}
    </AbsoluteFill>
  );
};
