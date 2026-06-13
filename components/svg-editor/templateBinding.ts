// ── Resolver de binding (cena → slots) ───────────────────────────────────────
// Decide, de forma determinística, qual dado da cena preenche cada slot. É o que
// faz o modelo "organizar a cena sozinho". Tudo é sobrescrevível por slot.

import type { Scene, SceneTemplateSlotOverride } from '../../types';
import type { TemplateSlot } from './types';
import type { SlotContent, SlotStyle } from './templateRender';
import type { EnterExitStyle } from './slotAnimation';

/** Candidatos de texto da cena, em ordem de prioridade. */
const sceneTextCandidates = (scene: Scene): string[] => {
  const candidates: string[] = [];
  const lettering = (scene.videoLettering?.text || scene.lettering_notes?.join(' · ') || '').trim();
  if (lettering) candidates.push(lettering);
  const description = (scene.original_description || scene.tagged_description || '').trim();
  if (description) candidates.push(description);
  const location = (scene.original_location || '').trim();
  if (location) candidates.push(location);
  const intention = (scene.visual_intention || '').trim();
  if (intention) candidates.push(intention);
  const mood = (scene.mood || '').trim();
  if (mood) candidates.push(mood);
  return [...new Set(candidates)];
};

const sceneImageCandidates = (scene: Scene): string[] => [
  scene.imageUrl,
  ...(scene.splitImages ?? []).map((image) => image.imageUrl),
  scene.endFrameUrl,
].filter((href): href is string => Boolean(href));

/**
 * Resolve o conteúdo de cada slot a partir da cena.
 * Defaults:
 *  - 1º slot de imagem → imagem principal da cena (`scene.imageUrl`);
 *  - slots de texto → lettering, descrição e local, nessa ordem;
 *  - slots de ícone → preservam o grafismo do modelo ou recebem SVG por override.
 * Qualquer slot pode ser sobrescrito por `overrides[slot.id]`.
 */
export const resolveSlotContents = (
  slots: TemplateSlot[],
  scene: Scene,
  overrides: Record<string, SceneTemplateSlotOverride> = {},
): SlotContent[] => {
  const contents: SlotContent[] = [];
  const texts = sceneTextCandidates(scene);
  const images = sceneImageCandidates(scene);
  let imageIndex = 0;
  let textIndex = 0;

  for (const slot of slots) {
    const override = overrides[slot.id];

    if (slot.type === 'image') {
      const href = override?.imageHref ?? images[imageIndex];
      imageIndex += 1;
      if (href) {
        contents.push({ id: slot.id, type: 'image', href, fit: override?.imageFit });
      }
      continue;
    }

    if (slot.type === 'text') {
      const fallback = texts[textIndex] ?? texts[texts.length - 1] ?? slot.name;
      const value = override?.text ?? fallback;
      textIndex += 1;
      if (value) {
        contents.push({
          id: slot.id,
          type: 'text',
          value,
          fill: override?.fill,
          fontFamily: override?.fontFamily,
          fontSize: override?.fontSize,
          fontWeight: override?.fontWeight,
        });
      }
      continue;
    }

    if (override?.iconSvg) {
      contents.push({ id: slot.id, type: 'icon', svg: override.iconSvg, fill: override.fill });
    }
  }

  return contents;
};

const finiteOr = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) ? value! : fallback;

/** Converte os ajustes persistidos da cena em estilo visual para o renderizador. */
export const slotStyleForOverride = (
  override: SceneTemplateSlotOverride | undefined,
  animated?: EnterExitStyle,
): SlotStyle | undefined => {
  if (!override && !animated) return undefined;

  const transforms: string[] = [];
  const x = finiteOr(override?.translateX, 0);
  const y = finiteOr(override?.translateY, 0);
  const rotation = finiteOr(override?.rotation, 0);
  const scale = Math.max(0.01, finiteOr(override?.scale, 1));
  if (x !== 0 || y !== 0) transforms.push(`translate(${x}px, ${y}px)`);
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (scale !== 1) transforms.push(`scale(${scale})`);
  if (animated?.transform) transforms.push(animated.transform);

  const baseOpacity = override?.hidden ? 0 : finiteOr(override?.opacity, 1);
  return {
    opacity: Math.max(0, Math.min(1, baseOpacity * (animated?.opacity ?? 1))),
    transform: transforms.length ? transforms.join(' ') : undefined,
    filter: animated?.filter,
  };
};

export const buildSceneSlotStyles = (
  slots: TemplateSlot[],
  overrides: Record<string, SceneTemplateSlotOverride> = {},
  animatedById: Record<string, EnterExitStyle> = {},
): Record<string, SlotStyle> => {
  const styles: Record<string, SlotStyle> = {};
  for (const slot of slots) {
    const style = slotStyleForOverride(overrides[slot.id], animatedById[slot.id]);
    if (style) styles[slot.id] = style;
  }
  return styles;
};

// ── Conteúdo de exemplo para pré-visualização no editor ──────────────────────

const SAMPLE_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL3WQAAAABJRU5ErkJggg==';

const SAMPLE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
  '<path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" fill="#7f77dd"/>' +
  '</svg>';

/** Preenche cada slot com dados de exemplo, para visualizar o layout no editor. */
export const buildPreviewContents = (slots: TemplateSlot[]): SlotContent[] =>
  slots.map((slot): SlotContent => {
    if (slot.type === 'image') return { id: slot.id, type: 'image', href: SAMPLE_IMAGE };
    if (slot.type === 'icon') return { id: slot.id, type: 'icon', svg: SAMPLE_ICON };
    return { id: slot.id, type: 'text', value: slot.name };
  });
