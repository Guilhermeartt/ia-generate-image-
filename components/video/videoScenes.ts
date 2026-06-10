import type {
  Scene,
  SceneVideoClipOverride,
  SceneVideoLettering,
  VideoClipTransition,
  VideoKenBurnsConfig,
} from '@/types';
import type { StoryboardVideoScene } from './StoryboardComposition';

const MAX_CAPTION_LENGTH = 180;

export interface SceneVideoImageSource {
  id: string;
  label: string;
  imageUrl: string;
}

const captionForScene = (scene: Scene): string => {
  const text = scene.original_description || scene.visual_intention || scene.image_prompt;
  if (text.length <= MAX_CAPTION_LENGTH) return text;
  return `${text.slice(0, MAX_CAPTION_LENGTH - 1).trimEnd()}…`;
};

export const defaultLetteringForScene = (scene: Scene): SceneVideoLettering => ({
  text: scene.lettering_notes?.filter(Boolean).join('\n') || captionForScene(scene),
  position: 'bottom',
  align: 'left',
  style: 'cinematic',
  fontSize: 52,
  color: '#ffffff',
  startSeconds: 0.2,
  enterAnimation: 'slide-up',
  exitAnimation: 'fade',
  enterDurationSeconds: 0.35,
  exitDurationSeconds: 0.25,
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  fontWeight: 700,
  letterSpacing: 0.015,
  borderRadius: 14,
  textOpacity: 1,
});

export const DEFAULT_KEN_BURNS: VideoKenBurnsConfig = {
  direction: 'zoom-in',
  intensity: 0.045,
};

export const DEFAULT_TRANSITION: VideoClipTransition = 'crossfade';
export const DEFAULT_TRANSITION_SECONDS = 0.3;

export const videoImageSourcesForScene = (scene: Scene): SceneVideoImageSource[] => {
  const sources: SceneVideoImageSource[] = [];
  if (scene.imageUrl) {
    sources.push({ id: 'main', label: 'Imagem principal', imageUrl: scene.imageUrl });
  }
  (scene.splitImages ?? []).forEach((split, index) => {
    if (split.imageUrl) {
      sources.push({
        id: `split:${split.id}`,
        label: split.prompt?.trim() ? `Plano ${index + 1}: ${split.prompt}` : `Plano ${index + 1}`,
        imageUrl: split.imageUrl,
      });
    }
  });
  if (scene.endFrameUrl) {
    sources.push({ id: 'end', label: 'Frame final', imageUrl: scene.endFrameUrl });
  }
  return sources;
};

export const selectedVideoImageSourcesForScene = (scene: Scene): SceneVideoImageSource[] => {
  const sources = videoImageSourcesForScene(scene);
  if (sources.length === 0) return [];

  const requestedIds = scene.videoImageSourceIds;
  if (requestedIds === undefined) {
    return [sources.find(source => source.id === 'main') ?? sources[0]];
  }

  const sourceById = new Map(sources.map(source => [source.id, source]));
  return requestedIds
    .map(sourceId => sourceById.get(sourceId))
    .filter((source): source is SceneVideoImageSource => Boolean(source));
};

export const clipOverrideFor = (
  scene: Scene,
  sourceId: string,
): SceneVideoClipOverride | undefined =>
  scene.videoClipOverrides?.find(override => override.sourceId === sourceId);

export interface CreateVideoScenesOptions {
  defaultSecondsPerClip: number;
  defaultTransition: VideoClipTransition;
  defaultTransitionSeconds: number;
  defaultKenBurns: VideoKenBurnsConfig;
}

const DEFAULT_OPTIONS: CreateVideoScenesOptions = {
  defaultSecondsPerClip: 3,
  defaultTransition: DEFAULT_TRANSITION,
  defaultTransitionSeconds: DEFAULT_TRANSITION_SECONDS,
  defaultKenBurns: DEFAULT_KEN_BURNS,
};

export const createVideoScenes = (
  scenes: Scene[],
  options: Partial<CreateVideoScenesOptions> = {},
): StoryboardVideoScene[] => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);
  const selectedSourcesByScene = new Map(
    sortedScenes.map(scene => [scene.id, selectedVideoImageSourcesForScene(scene)]),
  );
  const parentClipCounts = new Map<number, number>();
  const parentLettering = new Map<number, SceneVideoLettering>();

  sortedScenes.forEach(scene => {
    const sourceCount = selectedSourcesByScene.get(scene.id)?.length ?? 0;
    parentClipCounts.set(scene.scene_id, (parentClipCounts.get(scene.scene_id) ?? 0) + sourceCount);
    if (scene.videoLettering && !parentLettering.has(scene.scene_id)) {
      parentLettering.set(scene.scene_id, scene.videoLettering);
    }
  });

  sortedScenes.forEach(scene => {
    if (!parentLettering.has(scene.scene_id)) {
      const parentScenes = sortedScenes.filter(item => item.scene_id === scene.scene_id);
      const letteringSource = parentScenes.find(item => item.lettering_notes?.some(Boolean)) ?? parentScenes[0];
      parentLettering.set(scene.scene_id, defaultLetteringForScene(letteringSource));
    }
  });

  const parentClipIndexes = new Map<number, number>();
  let globalClipIndex = 0;
  const clips = sortedScenes.flatMap(scene => {
    const selectedSources = selectedSourcesByScene.get(scene.id) ?? [];
    return selectedSources.map((source, sourceIndex) => {
      const parentSceneClipIndex = parentClipIndexes.get(scene.scene_id) ?? 0;
      parentClipIndexes.set(scene.scene_id, parentSceneClipIndex + 1);
      const override = clipOverrideFor(scene, source.id);
      const durationSeconds = override?.durationSeconds ?? opts.defaultSecondsPerClip;
      const kenBurns = override?.kenBurns ?? opts.defaultKenBurns;
      const transitionIn = globalClipIndex === 0 ? 'cut' : (override?.transitionIn ?? opts.defaultTransition);
      const transitionDurationSeconds =
        override?.transitionDurationSeconds ?? opts.defaultTransitionSeconds;
      const lettering =
        override?.lettering
        ?? parentLettering.get(scene.scene_id)
        ?? defaultLetteringForScene(scene);
      const clip = {
        id: `${scene.id}:${source.id}`,
        sceneId: scene.id,
        parentSceneId: scene.scene_id,
        sourceId: source.id,
        sourceLabel: source.label,
        parentSceneClipIndex,
        parentSceneClipCount: parentClipCounts.get(scene.scene_id) ?? selectedSources.length,
        imageUrl: source.imageUrl,
        title: `Cena ${scene.scene_id}-${scene.sub_id}${sourceIndex > 0 ? ` · ${sourceIndex + 1}` : ''}`,
        location: scene.original_location,
        description: captionForScene(scene),
        lettering,
        durationSeconds,
        kenBurns,
        transitionIn,
        transitionDurationSeconds,
        hasOverride: Boolean(override),
        parentSceneOffsetSeconds: 0,
        parentSceneDurationSeconds: 0,
      } satisfies StoryboardVideoScene;
      globalClipIndex += 1;
      return clip;
    });
  });

  const parentSceneCursor = new Map<number, number>();
  clips.forEach(clip => {
    const offset = parentSceneCursor.get(clip.parentSceneId) ?? 0;
    clip.parentSceneOffsetSeconds = offset;
    parentSceneCursor.set(clip.parentSceneId, offset + clip.durationSeconds);
  });
  clips.forEach(clip => {
    clip.parentSceneDurationSeconds = parentSceneCursor.get(clip.parentSceneId) ?? clip.durationSeconds;
  });

  return clips;
};

export interface TimelineClipPlacement {
  clip: StoryboardVideoScene;
  startFrame: number;
  durationFrames: number;
  transitionInFrames: number;
}

/** Posiciona cada clipe na timeline considerando overlap das transições. */
export const placeClipsOnTimeline = (
  clips: StoryboardVideoScene[],
  fps: number,
): { placements: TimelineClipPlacement[]; totalFrames: number } => {
  const placements: TimelineClipPlacement[] = [];
  let cursor = 0;
  clips.forEach((clip, index) => {
    const durationFrames = Math.max(1, Math.round(clip.durationSeconds * fps));
    const transitionInFrames = Math.max(0, Math.round(clip.transitionDurationSeconds * fps));
    const overlap = index === 0 || clip.transitionIn === 'cut' ? 0 : transitionInFrames;
    const startFrame = Math.max(0, cursor - overlap);
    placements.push({ clip, startFrame, durationFrames, transitionInFrames: overlap });
    cursor = startFrame + durationFrames;
  });
  return { placements, totalFrames: Math.max(1, cursor) };
};
