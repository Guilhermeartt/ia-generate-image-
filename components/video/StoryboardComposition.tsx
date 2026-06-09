import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { SceneVideoLettering, VideoLetteringPosition } from '@/types';

export interface StoryboardVideoScene {
  id: string;
  sceneId: number;
  sourceId: string;
  sourceLabel: string;
  imageUrl: string;
  title: string;
  location: string;
  description: string;
  lettering: SceneVideoLettering;
}

export interface StoryboardCompositionProps {
  scenes: StoryboardVideoScene[];
  framesPerScene: number;
  showCaptions: boolean;
}

export const StoryboardComposition: React.FC<StoryboardCompositionProps> = ({
  scenes,
  framesPerScene,
  showCaptions,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const sceneIndex = Math.min(scenes.length - 1, Math.floor(frame / framesPerScene));
  const scene = scenes[Math.max(0, sceneIndex)];
  const localFrame = frame % framesPerScene;
  const opacity = interpolate(
    localFrame,
    [0, 8, Math.max(9, framesPerScene - 10), framesPerScene - 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const scale = interpolate(localFrame, [0, framesPerScene], [1, 1.045], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const letteringProgress = interpolate(localFrame, [5, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const letteringTranslate = interpolate(letteringProgress, [0, 1], [24, 0]);
  const baseSize = Math.min(width, height);
  const positionStyles: Record<VideoLetteringPosition, React.CSSProperties> = {
    top: { top: baseSize * 0.07 },
    center: { top: '50%', transform: `translateY(calc(-50% + ${letteringTranslate}px))` },
    bottom: { bottom: baseSize * 0.07 },
  };
  const isBox = scene?.lettering.style === 'box';
  const isCinematic = scene?.lettering.style === 'cinematic';

  if (!scene) {
    return <AbsoluteFill style={{ backgroundColor: '#09090b' }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b', opacity }}>
      <Img
        src={scene.imageUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
        }}
      />
      <AbsoluteFill
        style={{
          background: isCinematic
            ? 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.03) 42%, rgba(0,0,0,0.82) 100%)'
            : 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.2))',
        }}
      />

      {showCaptions && scene.lettering.text.trim() && (
        <div
          style={{
            position: 'absolute',
            left: width * 0.045,
            right: width * 0.045,
            ...positionStyles[scene.lettering.position],
            display: 'flex',
            flexDirection: 'column',
            alignItems:
              scene.lettering.align === 'left'
                ? 'flex-start'
                : scene.lettering.align === 'right'
                  ? 'flex-end'
                  : 'center',
            color: scene.lettering.color,
            fontFamily: 'Inter, Arial, sans-serif',
            textShadow: '0 2px 16px rgba(0,0,0,0.75)',
            opacity: letteringProgress,
            transform:
              scene.lettering.position === 'center'
                ? `translateY(calc(-50% + ${letteringTranslate}px))`
                : `translateY(${letteringTranslate}px)`,
          }}
        >
          <div
            style={{
              maxWidth: scene.lettering.align === 'center' ? '88%' : '82%',
              padding: isBox ? `${baseSize * 0.018}px ${baseSize * 0.026}px` : 0,
              borderRadius: isBox ? baseSize * 0.014 : 0,
              background: isBox ? 'rgba(0,0,0,0.72)' : 'transparent',
              border: isBox ? '1px solid rgba(255,255,255,0.16)' : 'none',
              backdropFilter: isBox ? 'blur(12px)' : undefined,
              fontSize: baseSize * (scene.lettering.fontSize / 1080),
              fontWeight: isCinematic ? 700 : 650,
              lineHeight: 1.18,
              letterSpacing: isCinematic ? '0.015em' : 0,
              textAlign: scene.lettering.align,
              whiteSpace: 'pre-line',
            }}
          >
            {scene.lettering.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
