import type { Scene, SceneVideoLettering } from '@/types';
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
});

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

export const createVideoScenes = (scenes: Scene[]): StoryboardVideoScene[] =>
  scenes
    .sort((a, b) => a.order - b.order)
    .flatMap((scene) =>
      selectedVideoImageSourcesForScene(scene).map((source, sourceIndex) => ({
        id: `${scene.id}:${source.id}`,
        sceneId: scene.id,
        sourceId: source.id,
        sourceLabel: source.label,
        imageUrl: source.imageUrl,
        title: `Cena ${scene.scene_id}-${scene.sub_id}${sourceIndex > 0 ? ` · ${sourceIndex + 1}` : ''}`,
        location: scene.original_location,
        description: captionForScene(scene),
        lettering: scene.videoLettering ?? defaultLetteringForScene(scene),
      })),
    );
