import type { Scene } from '../types';
import { normalizePromptJson, serializeImagePrompt } from './promptCoherence';

export const SHOT_TYPE_OPTIONS = [
  'Close-up',
  'Medium Shot',
  'Wide Shot',
  'Panoramic Shot',
  'American Shot',
  'Detail Shot',
  'High-Angle Shot',
  'Low-Angle Shot',
  'Over-the-Shoulder Shot',
  'POV Shot',
  'Establishing Shot',
  'Aerial/Drone Shot',
  'Macro Shot',
  'Dutch Angle',
] as const;

export const SCENE_STYLE_OPTIONS = [
  'Fotorrealista',
  'Cinematográfico',
  'Documental',
  'Publicidade/Produto',
  '3D/CGI',
  '2D/Animação',
  'Anime',
  'Cartoon',
  'Motion Graphics',
  'Ilustração Editorial',
  'HQ/Mangá',
  'Pintura Artística',
] as const;

export const CAMERA_POSITION_OPTIONS = [
  {
    id: 'front',
    label: 'Frente',
    shortLabel: 'Frente',
    relation: 'camera positioned directly in front of the main subject',
    angle: 'front-facing camera angle at subject level',
  },
  {
    id: 'front-left',
    label: '3/4 frente esquerda',
    shortLabel: '3/4 E',
    relation: 'camera positioned at a front-left three-quarter angle relative to the main subject',
    angle: 'front-left three-quarter camera angle',
  },
  {
    id: 'front-right',
    label: '3/4 frente direita',
    shortLabel: '3/4 D',
    relation: 'camera positioned at a front-right three-quarter angle relative to the main subject',
    angle: 'front-right three-quarter camera angle',
  },
  {
    id: 'left',
    label: 'Perfil esquerdo',
    shortLabel: 'Esq.',
    relation: 'camera positioned on the subject left side, profile view',
    angle: 'left profile camera angle',
  },
  {
    id: 'right',
    label: 'Perfil direito',
    shortLabel: 'Dir.',
    relation: 'camera positioned on the subject right side, profile view',
    angle: 'right profile camera angle',
  },
  {
    id: 'back-left',
    label: '3/4 trás esquerda',
    shortLabel: 'Trás E',
    relation: 'camera positioned behind-left of the main subject, rear three-quarter view',
    angle: 'behind-left rear three-quarter camera angle',
  },
  {
    id: 'back-right',
    label: '3/4 trás direita',
    shortLabel: 'Trás D',
    relation: 'camera positioned behind-right of the main subject, rear three-quarter view',
    angle: 'behind-right rear three-quarter camera angle',
  },
  {
    id: 'back',
    label: 'Atrás',
    shortLabel: 'Atrás',
    relation: 'camera positioned directly behind the main subject, back view',
    angle: 'rear camera angle from behind the subject',
  },
  {
    id: 'over-shoulder',
    label: 'Sobre o ombro',
    shortLabel: 'Ombro',
    relation: 'camera positioned over the shoulder of a foreground subject toward the focal subject',
    angle: 'over-the-shoulder camera angle',
  },
] as const;

export type CameraPositionId = typeof CAMERA_POSITION_OPTIONS[number]['id'];

export const CAMERA_HEIGHT_OPTIONS = [
  {
    id: 'low',
    label: 'Baixa',
    relation: 'low camera height looking slightly upward at the subject',
    angle: 'low camera height',
  },
  {
    id: 'eye',
    label: 'Olhos',
    relation: 'camera at eye level with the subject',
    angle: 'eye-level camera height',
  },
  {
    id: 'high',
    label: 'Alta',
    relation: 'high camera height looking slightly downward at the subject',
    angle: 'high camera height',
  },
] as const;

export type CameraHeightId = typeof CAMERA_HEIGHT_OPTIONS[number]['id'];

const CAMERA_RELATION_FRAMING_RE = /\s*Camera relation to subject:[^.]+\.?/gi;

const stripCameraRelationFraming = (framing = ''): string =>
  framing.replace(CAMERA_RELATION_FRAMING_RE, '').replace(/\s{2,}/g, ' ').trim();

export const cameraPositionInstruction = (
  positionId: CameraPositionId | '',
  heightId: CameraHeightId | '',
): { relation: string; angle: string; framingNote: string } | null => {
  const position = CAMERA_POSITION_OPTIONS.find(option => option.id === positionId);
  const height = CAMERA_HEIGHT_OPTIONS.find(option => option.id === heightId);
  if (!position && !height) return null;

  const relation = [position?.relation, height?.relation].filter(Boolean).join('; ');
  const angle = [position?.angle, height?.angle].filter(Boolean).join('; ');
  return {
    relation,
    angle,
    framingNote: `Camera relation to subject: ${relation}.`,
  };
};

export const cameraPresetForShotType = (shotType: string) => {
  switch (shotType) {
    case 'Close-up':
      return {
        shot_type: shotType,
        angle: 'eye-level unless the scene requires otherwise',
        lens: '85mm portrait lens',
        framing: 'tight framing focused on the main subject (face and expression when human, key object or detail otherwise)',
        depth_of_field: 'shallow depth of field',
      };
    case 'Medium Shot':
      return {
        shot_type: shotType,
        angle: 'eye-level',
        lens: '50mm lens',
        framing: 'waist-up framing that balances character expression and surrounding context',
        depth_of_field: 'moderate shallow depth of field',
      };
    case 'Wide Shot':
      return {
        shot_type: shotType,
        angle: 'eye-level or slightly low depending on scene intent',
        lens: '28mm to 35mm wide lens',
        framing: 'wide composition showing characters, action, and environment clearly',
        depth_of_field: 'deep enough to read the full scene',
      };
    case 'Panoramic Shot':
      return {
        shot_type: shotType,
        angle: 'wide establishing angle',
        lens: '24mm wide lens',
        framing: 'expansive frame emphasizing scale, location, and spatial relationships',
        depth_of_field: 'deep depth of field',
      };
    case 'American Shot':
      return {
        shot_type: shotType,
        angle: 'eye-level',
        lens: '40mm to 50mm lens',
        framing: 'characters framed from mid-thigh upward, preserving gesture and posture',
        depth_of_field: 'moderate depth of field',
      };
    case 'Detail Shot':
      return {
        shot_type: shotType,
        angle: 'precise object-focused angle',
        lens: 'macro or 85mm detail lens',
        framing: 'tight framing on the key object, gesture, text, or visual clue',
        depth_of_field: 'very shallow depth of field',
      };
    case 'High-Angle Shot':
      return {
        shot_type: shotType,
        angle: 'camera above the subject looking downward',
        lens: '35mm to 50mm lens',
        framing: 'composition emphasizes vulnerability, layout, or overview from above',
        depth_of_field: 'context-appropriate depth of field',
      };
    case 'Low-Angle Shot':
      return {
        shot_type: shotType,
        angle: 'camera below the subject looking upward',
        lens: '28mm to 40mm lens',
        framing: 'composition emphasizes presence, authority, scale, or dramatic tension',
        depth_of_field: 'context-appropriate depth of field',
      };
    case 'Over-the-Shoulder Shot':
      return {
        shot_type: shotType,
        angle: 'over one subject shoulder toward the focal subject',
        lens: '50mm to 85mm lens',
        framing: 'foreground shoulder frames the main subject, emphasizing conversation or perspective',
        depth_of_field: 'shallow to moderate depth of field',
      };
    case 'POV Shot':
      return {
        shot_type: shotType,
        angle: 'subjective first-person camera angle',
        lens: '35mm natural perspective lens',
        framing: 'first-person perspective composition; the world seen as if through the subject\'s own eyes',
        depth_of_field: 'naturalistic depth of field',
      };
    case 'Establishing Shot':
      return {
        shot_type: shotType,
        angle: 'wide establishing perspective',
        lens: '24mm to 35mm wide lens',
        framing: 'clearly establishes location, scale, and spatial context before the action',
        depth_of_field: 'deep depth of field',
      };
    case 'Aerial/Drone Shot':
      return {
        shot_type: shotType,
        angle: 'high aerial camera looking down or across the location',
        lens: 'wide aerial lens',
        framing: 'large-scale overhead or sweeping spatial composition',
        depth_of_field: 'deep depth of field',
      };
    case 'Macro Shot':
      return {
        shot_type: shotType,
        angle: 'extreme close detail angle',
        lens: 'macro lens',
        framing: 'fills the frame with a tiny detail, texture, or object surface',
        depth_of_field: 'extremely shallow depth of field',
      };
    case 'Dutch Angle':
      return {
        shot_type: shotType,
        angle: 'tilted dutch angle',
        lens: '35mm to 50mm lens',
        framing: 'slightly rotated horizon to create tension, imbalance, or unease',
        depth_of_field: 'context-appropriate depth of field',
      };
    default:
      return {
        shot_type: shotType || 'Best cinematic shot for the scene',
        angle: 'best angle for the scene intent',
        lens: 'cinematic lens appropriate to the shot',
        framing: 'composition chosen to preserve the action and required elements',
        depth_of_field: 'depth of field appropriate to the scene',
      };
  }
};

export const visualStylePresetForSceneStyle = (sceneStyle: string) => {
  switch (sceneStyle) {
    case 'Fotorrealista':
      return {
        style_family: 'Fotorrealista',
        medium: 'live-action photorealistic image',
        realism_level: 'high realism with real-world production design (natural human features when people are present)',
        style_rules: ['photographic realism', 'natural texture and lighting', 'no anime', 'no cartoon', 'no illustration', 'no CGI'],
      };
    case 'Cinematográfico':
      return {
        style_family: 'Cinematográfico',
        medium: 'live-action cinematic photography',
        realism_level: 'photorealistic movie still',
        style_rules: ['anamorphic lens', 'film color grading', 'professional cinematography', 'no anime', 'no cartoon', 'no CGI', 'no cel shading'],
      };
    case 'Documental':
      return {
        style_family: 'Documental',
        medium: 'documentary photojournalism',
        realism_level: 'naturalistic realism',
        style_rules: ['candid moment', 'natural light', 'editorial documentary tone', 'no staged advertising look'],
      };
    case 'Publicidade/Produto':
      return {
        style_family: 'Publicidade/Produto',
        medium: 'high-end commercial photography',
        realism_level: 'polished realistic advertising image',
        style_rules: ['clean composition', 'studio-quality lighting', 'product or subject clarity', 'premium finish'],
      };
    case '3D/CGI':
      return {
        style_family: '3D/CGI',
        medium: 'polished 3D render',
        realism_level: 'stylized 3D realism',
        style_rules: ['volumetric lighting', 'expressive 3D characters or objects', 'consistent CGI materials'],
      };
    case '2D/Animação':
      return {
        style_family: '2D/Animação',
        medium: '2D animated frame',
        realism_level: 'stylized hand-drawn animation',
        style_rules: ['clean shapes', 'expressive silhouettes', 'coherent 2D palette', 'no photorealistic photography'],
      };
    case 'Anime':
      return {
        style_family: 'Anime',
        medium: 'anime-style 2D illustration',
        realism_level: 'stylized Japanese animation',
        style_rules: ['anime facial structure', 'cel shading', 'expressive eyes', 'dynamic composition'],
      };
    case 'Cartoon':
      return {
        style_family: 'Cartoon',
        medium: 'cartoon 2D illustration',
        realism_level: 'stylized cartoon',
        style_rules: ['bold simplified forms', 'expressive poses', 'clean outlines', 'vibrant flat colors'],
      };
    case 'Motion Graphics':
      return {
        style_family: 'Motion Graphics',
        medium: 'motion graphics frame',
        realism_level: 'graphic abstraction',
        style_rules: ['clean geometric composition', 'clear hierarchy', 'flat graphic shapes', 'no photorealistic scene unless explicitly required'],
      };
    case 'Ilustração Editorial':
      return {
        style_family: 'Ilustração Editorial',
        medium: 'editorial illustration',
        realism_level: 'stylized narrative illustration',
        style_rules: ['designed composition', 'expressive visual metaphor', 'magazine-quality illustration'],
      };
    case 'HQ/Mangá':
      return {
        style_family: 'HQ/Mangá',
        medium: 'comic or manga panel',
        realism_level: 'stylized sequential art',
        style_rules: ['strong linework', 'panel composition', 'dramatic contrast', 'comic/manga visual language'],
      };
    case 'Pintura Artística':
      return {
        style_family: 'Pintura Artística',
        medium: 'digital or traditional painting',
        realism_level: 'painterly stylization',
        style_rules: ['visible brush texture', 'painterly color transitions', 'fine-art composition'],
      };
    default:
      return {
        style_family: sceneStyle || 'Definido pelo contexto',
        medium: sceneStyle || 'best medium for the scene',
        realism_level: 'appropriate to the selected style',
        style_rules: ['preserve the required action, characters, lettering, and environment'],
      };
  }
};

export const updateSceneCameraModuleOnly = (scene: Scene, shotType: string): Scene => {
  if (!scene.prompt_json) return { ...scene, style: shotType };

  const merged = {
    ...scene.prompt_json,
    camera: {
      ...(scene.prompt_json.camera || {}),
      ...cameraPresetForShotType(shotType),
    },
  };
  // Re-normalize so any cross-axis contradiction introduced by the new
  // shot/lens choice (e.g. shallow DoF now in conflict with a stale
  // "no blurry background" negative) gets auto-resolved.
  const nextPromptJson = normalizePromptJson(merged) ?? merged;

  return {
    ...scene,
    style: shotType,
    prompt_json: nextPromptJson,
    image_prompt: serializeImagePrompt(nextPromptJson, scene.includeLettering, scene.lettering_notes),
  };
};

export const updateSceneVisualStyleModuleOnly = (scene: Scene, sceneStyle: string): Scene => {
  if (!scene.prompt_json) return scene;

  const merged = {
    ...scene.prompt_json,
    visual_style: {
      ...(scene.prompt_json.visual_style || {}),
      ...visualStylePresetForSceneStyle(sceneStyle),
    },
  };
  // Re-normalize so switching e.g. "3D/CGI" → "Fotorrealista" clears any
  // leftover CGI tokens still hiding in style_rules / negative_constraints
  // and so style_rules that contradict negatives get scrubbed.
  const nextPromptJson = normalizePromptJson(merged) ?? merged;

  return {
    ...scene,
    prompt_json: nextPromptJson,
    image_prompt: serializeImagePrompt(nextPromptJson, scene.includeLettering, scene.lettering_notes),
  };
};

export const updateSceneCameraPositionModuleOnly = (
  scene: Scene,
  positionId: CameraPositionId | '',
  heightId: CameraHeightId | '',
): Scene => {
  const instruction = cameraPositionInstruction(positionId, heightId);

  if (!scene.prompt_json) {
    const basePrompt = scene.image_prompt.replace(CAMERA_RELATION_FRAMING_RE, '').trim();
    return {
      ...scene,
      image_prompt: instruction
        ? `${basePrompt}\n\n${instruction.framingNote}`
        : basePrompt,
    };
  }

  const baseFraming = stripCameraRelationFraming(scene.prompt_json.camera?.framing);
  const nextCamera = {
    ...(scene.prompt_json.camera || {}),
    relation_to_subject: instruction?.relation || undefined,
    angle: instruction?.angle || scene.prompt_json.camera?.angle,
    framing: [baseFraming, instruction?.framingNote].filter(Boolean).join(' '),
  };

  if (!instruction) {
    delete nextCamera.relation_to_subject;
  }

  const merged = {
    ...scene.prompt_json,
    camera: nextCamera,
  };
  const nextPromptJson = normalizePromptJson(merged) ?? merged;

  return {
    ...scene,
    prompt_json: nextPromptJson,
    image_prompt: serializeImagePrompt(nextPromptJson, scene.includeLettering, scene.lettering_notes),
  };
};
