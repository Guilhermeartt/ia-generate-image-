import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {
  SceneVideoLettering,
  VideoAudioTrack,
  VideoClipTransition,
  VideoKenBurnsConfig,
  VideoLetteringPosition,
} from '@/types';
import { placeClipsOnTimeline } from './videoScenes';

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
  hasOverride: boolean;
  parentSceneOffsetSeconds: number;
  parentSceneDurationSeconds: number;
}

export interface StoryboardCompositionProps {
  scenes: StoryboardVideoScene[];
  showCaptions: boolean;
  fps: number;
  audio?: VideoAudioTrack;
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

interface TransitionStyleArgs {
  type: VideoClipTransition;
  enterProgress: number;
  exitProgress: number;
  isIncoming: boolean;
}

const transitionStyle = ({ type, enterProgress, exitProgress, isIncoming }: TransitionStyleArgs): React.CSSProperties => {
  if (type === 'cut') {
    return {};
  }
  if (type === 'crossfade') {
    if (isIncoming) return { opacity: enterProgress };
    return { opacity: 1 - exitProgress };
  }
  if (type === 'fade-black') {
    if (isIncoming) return { opacity: enterProgress };
    return { opacity: 1 - exitProgress };
  }
  if (type === 'slide-left') {
    if (isIncoming) {
      return { transform: `translateX(${interpolate(enterProgress, [0, 1], [100, 0])}%)` };
    }
    return { transform: `translateX(${interpolate(exitProgress, [0, 1], [0, -25])}%)`, opacity: 1 - exitProgress * 0.3 };
  }
  if (type === 'slide-up') {
    if (isIncoming) {
      return { transform: `translateY(${interpolate(enterProgress, [0, 1], [100, 0])}%)` };
    }
    return { transform: `translateY(${interpolate(exitProgress, [0, 1], [0, -25])}%)`, opacity: 1 - exitProgress * 0.3 };
  }
  if (type === 'wipe-left') {
    if (isIncoming) {
      const right = interpolate(enterProgress, [0, 1], [100, 0]);
      return { clipPath: `inset(0 ${right}% 0 0)` };
    }
    return {};
  }
  return {};
};

interface ClipLayerProps {
  clip: StoryboardVideoScene;
  durationFrames: number;
  transitionInFrames: number;
  nextTransitionInFrames: number;
  nextTransitionType: VideoClipTransition;
  showCaptions: boolean;
  fps: number;
}

const ClipLayer: React.FC<ClipLayerProps> = ({
  clip,
  durationFrames,
  transitionInFrames,
  nextTransitionInFrames,
  nextTransitionType,
  showCaptions,
  fps,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const baseSize = Math.min(width, height);

  const kenBurnsProgress = interpolate(frame, [0, Math.max(1, durationFrames - 1)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const kenBurns = kenBurnsTransform(clip.kenBurns, kenBurnsProgress);

  const enterProgress = transitionInFrames === 0
    ? 1
    : interpolate(frame, [0, transitionInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const exitStart = Math.max(0, durationFrames - nextTransitionInFrames);
  const exitProgress = nextTransitionInFrames === 0
    ? 0
    : interpolate(frame, [exitStart, durationFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

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

  const blackOverlayOpacity = clip.transitionIn === 'fade-black'
    ? Math.max(0, 1 - enterProgress * 2)
    : nextTransitionType === 'fade-black'
      ? Math.max(0, exitProgress * 2 - 0.5)
      : 0;

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

  const backgroundColor = clip.lettering.backgroundColor ?? '#000000';
  const defaultBgOpacity =
    isBox || isLowerThird ? 0.72
    : isGlass ? 0.28
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
    <AbsoluteFill style={{ ...incomingStyle, ...outgoingStyle }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
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
        <AbsoluteFill
          style={{
            background: isCinematic
              ? 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.03) 42%, rgba(0,0,0,0.82) 100%)'
              : 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.2))',
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>

      {blackOverlayOpacity > 0 && (
        <AbsoluteFill style={{ background: '#000', opacity: blackOverlayOpacity }} />
      )}

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
              `translate(${enterOffsetX + exitOffsetX}px, ${enterOffsetY + exitOffsetY}px)`,
              `scale(${enterScale * exitScale})`,
              exitSkew !== 0 ? `skewX(${exitSkew}deg)` : '',
            ].filter(Boolean).join(' '),
          }}
        >
          <div
            style={{
              position: 'relative',
              display: isMarker ? 'inline-block' : 'block',
              maxWidth: isTitle ? '94%' : clip.lettering.align === 'center' ? '88%' : '82%',
              padding: (isBox || isLowerThird || isGlass)
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
              textTransform: isTitle || isNeon || isOutline ? 'uppercase' : undefined,
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
            }}
          >
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
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const StoryboardComposition: React.FC<StoryboardCompositionProps> = ({
  scenes,
  showCaptions,
  fps,
  audio,
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
              showCaptions={showCaptions}
              fps={fps}
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
