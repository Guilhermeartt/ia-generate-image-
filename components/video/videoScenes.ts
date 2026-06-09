import type { Scene, SceneVideoLettering } from '@/types';
import type { StoryboardVideoScene } from './StoryboardComposition';

const MAX_CAPTION_LENGTH = 180;

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

export const createVideoScenes = (scenes: Scene[]): StoryboardVideoScene[] =>
  scenes
    .filter((scene): scene is Scene & { imageUrl: string } => Boolean(scene.imageUrl))
    .sort((a, b) => a.order - b.order)
    .map((scene) => ({
      id: scene.id,
      imageUrl: scene.imageUrl,
      title: `Cena ${scene.scene_id}-${scene.sub_id}`,
      location: scene.original_location,
      description: captionForScene(scene),
      lettering: scene.videoLettering ?? defaultLetteringForScene(scene),
    }));
