import React, { useMemo, useRef } from 'react';
import type { StoryboardVideoScene } from './StoryboardComposition';
import type { TimelineClipPlacement } from './videoScenes';
import { transitionOptionFor } from './videoStudioConstants';

interface VideoTimelineProps {
  placements: TimelineClipPlacement[];
  totalFrames: number;
  fps: number;
  selectedClipId: string | null;
  onSelectClip: (clip: StoryboardVideoScene, startFrame: number) => void;
  playheadFrame: number;
  onScrubStart?: () => void;
  onScrub: (frame: number) => void;
  onScrubEnd?: () => void;
}

const VideoTimeline: React.FC<VideoTimelineProps> = ({
  placements,
  totalFrames,
  fps,
  selectedClipId,
  onSelectClip,
  playheadFrame,
  onScrubStart,
  onScrub,
  onScrubEnd,
}) => {
  const totalSeconds = totalFrames / fps;
  const tickEvery = totalSeconds <= 20 ? 1 : totalSeconds <= 60 ? 5 : 10;
  const tickCount = Math.ceil(totalSeconds / tickEvery) + 1;
  const scrubbingRef = useRef(false);

  const parentSceneSegments = useMemo(() => {
    const segments: { parentSceneId: number; startFrame: number; endFrame: number }[] = [];
    placements.forEach(placement => {
      const last = segments[segments.length - 1];
      const endFrame = placement.startFrame + placement.durationFrames;
      if (last && last.parentSceneId === placement.clip.parentSceneId) {
        last.endFrame = endFrame;
      } else {
        segments.push({
          parentSceneId: placement.clip.parentSceneId,
          startFrame: placement.startFrame,
          endFrame,
        });
      }
    });
    return segments;
  }, [placements]);

  const frameFromClientX = (clientX: number, rect: DOMRect) => {
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * totalFrames);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.vs-timeline-clip')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubbingRef.current = true;
    onScrubStart?.();
    onScrub(frameFromClientX(event.clientX, event.currentTarget.getBoundingClientRect()));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    onScrub(frameFromClientX(event.clientX, event.currentTarget.getBoundingClientRect()));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    onScrubEnd?.();
  };

  return (
    <div className="vs-timeline" role="region" aria-label="Linha do tempo do vídeo">
      <div className="vs-timeline-ruler">
        {Array.from({ length: tickCount }).map((_, i) => {
          const second = i * tickEvery;
          if (second > totalSeconds) return null;
          return (
            <div
              key={second}
              className="vs-timeline-tick"
              style={{ left: `${(second / Math.max(0.001, totalSeconds)) * 100}%` }}
            >
              <span>{second}s</span>
            </div>
          );
        })}
      </div>
      <div className="vs-timeline-parent-row" aria-hidden="true">
        {parentSceneSegments.map(segment => {
          const left = (segment.startFrame / Math.max(1, totalFrames)) * 100;
          const width = ((segment.endFrame - segment.startFrame) / Math.max(1, totalFrames)) * 100;
          return (
            <div
              key={`${segment.parentSceneId}-${segment.startFrame}`}
              className="vs-timeline-parent-segment"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`Cena ${segment.parentSceneId}`}
            >
              <span>Cena {segment.parentSceneId}</span>
            </div>
          );
        })}
      </div>
      <div
        className="vs-timeline-clip-row"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        tabIndex={0}
        aria-label="Cabeça de leitura — clique, arraste ou use as setas"
        aria-valuemin={0}
        aria-valuemax={totalFrames}
        aria-valuenow={playheadFrame}
        aria-valuetext={`${(playheadFrame / fps).toFixed(1)}s de ${totalSeconds.toFixed(1)}s`}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onScrub(Math.max(0, playheadFrame - fps));
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            onScrub(Math.min(totalFrames, playheadFrame + fps));
          } else if (event.key === 'Home') {
            event.preventDefault();
            onScrub(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            onScrub(totalFrames);
          }
        }}
      >
        {placements.map(placement => {
          const left = (placement.startFrame / Math.max(1, totalFrames)) * 100;
          const width = (placement.durationFrames / Math.max(1, totalFrames)) * 100;
          const isSelected = placement.clip.id === selectedClipId;
          const transition = transitionOptionFor(placement.clip.transitionIn);
          const transitionWidth = Math.min(
            100,
            (placement.transitionInFrames / Math.max(1, placement.durationFrames)) * 100,
          );
          return (
            <button
              type="button"
              key={placement.clip.id}
              className={`vs-timeline-clip${isSelected ? ' is-selected' : ''}${placement.clip.hasOverride ? ' has-override' : ''}`}
              style={{ left: `${left}%`, width: `calc(${width}% - 2px)` }}
              onClick={(event) => {
                event.stopPropagation();
                onSelectClip(placement.clip, placement.startFrame);
              }}
              aria-label={`Selecionar ${placement.clip.title}, duração ${placement.clip.durationSeconds.toFixed(1)} segundos${placement.transitionInFrames > 0 ? `, entrada com ${transition.label} por ${(placement.transitionInFrames / fps).toFixed(2)} segundos` : ''}${placement.clip.hasOverride ? ', modificado' : ''}`}
            >
              <img src={placement.clip.imageUrl} alt="" />
              <span className="vs-timeline-clip-label">{placement.clip.title}</span>
              <span className="vs-timeline-clip-duration">{placement.clip.durationSeconds.toFixed(1)}s</span>
              {placement.transitionInFrames > 0 && (
                <span
                  className="vs-timeline-clip-transition"
                  style={{ width: `${transitionWidth}%` }}
                  title={`${transition.label} · ${(placement.transitionInFrames / fps).toFixed(2)}s`}
                  aria-hidden="true"
                >
                  <span>{transition.shortLabel}</span>
                </span>
              )}
            </button>
          );
        })}
        <div
          className="vs-timeline-playhead"
          style={{ left: `${(playheadFrame / Math.max(1, totalFrames)) * 100}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

export default VideoTimeline;
