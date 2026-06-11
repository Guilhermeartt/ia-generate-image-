// ── Resolver de binding (cena → slots) ───────────────────────────────────────
// Decide, de forma determinística, qual dado da cena preenche cada slot. É o que
// faz o modelo "organizar a cena sozinho". Tudo é sobrescrevível por slot.

import type { Scene } from '../../types';
import type { TemplateSlot } from './types';
import type { SlotContent } from './templateRender';

/** Override por slot (definido por cena). */
export interface SlotOverride {
  /** Texto fixo para um slot de texto. */
  text?: string;
  /** URL de imagem fixa para um slot de imagem. */
  imageHref?: string;
}

/** Candidatos de texto da cena, em ordem de prioridade. */
const sceneTextCandidates = (scene: Scene): string[] => {
  const candidates: string[] = [];
  const lettering = (scene.videoLettering?.text || scene.lettering_notes?.join(' · ') || '').trim();
  if (lettering) candidates.push(lettering);
  const description = (scene.original_description || scene.tagged_description || '').trim();
  if (description) candidates.push(description);
  const location = (scene.original_location || '').trim();
  if (location) candidates.push(location);
  return candidates;
};

/**
 * Resolve o conteúdo de cada slot a partir da cena.
 * Defaults:
 *  - 1º slot de imagem → imagem principal da cena (`scene.imageUrl`);
 *  - slots de texto → lettering, descrição e local, nessa ordem;
 *  - slots de ícone → vazio por enquanto (preenchível via override no futuro).
 * Qualquer slot pode ser sobrescrito por `overrides[slot.id]`.
 */
export const resolveSlotContents = (
  slots: TemplateSlot[],
  scene: Scene,
  overrides: Record<string, SlotOverride> = {},
): SlotContent[] => {
  const contents: SlotContent[] = [];
  const texts = sceneTextCandidates(scene);
  let imageUsed = false;
  let textIndex = 0;

  for (const slot of slots) {
    const override = overrides[slot.id];

    if (slot.type === 'image') {
      const href = override?.imageHref ?? (!imageUsed ? scene.imageUrl : undefined);
      if (href) {
        contents.push({ id: slot.id, type: 'image', href });
        if (!override?.imageHref) imageUsed = true;
      }
      continue;
    }

    if (slot.type === 'text') {
      const fallback = texts[textIndex] ?? texts[texts.length - 1] ?? slot.name;
      const value = override?.text ?? fallback;
      textIndex += 1;
      if (value) contents.push({ id: slot.id, type: 'text', value });
      continue;
    }

    // icon: sem fonte automática na Fase 2.
  }

  return contents;
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
