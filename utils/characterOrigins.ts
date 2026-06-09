import type { Character, Scene } from '../types';

/**
 * Para cada personagem, encontra a primeira cena em que aparece e anexa
 * `firstSceneOrder` + `origin` (texto legível). A detecção usa primeiro a
 * lista `detected_characters` da IA (precisa) e, como fallback, a busca por
 * `[nome]` na `tagged_description`.
 *
 * Função pura — extraída do fluxo de análise (estava duplicada nos dois
 * caminhos, CSV e storyboard).
 */
export const computeCharacterOrigins = (characters: Character[], scenes: Scene[]): Character[] =>
  characters.map((char) => {
    const nameLower = char.name.toLowerCase();
    const firstScene = scenes.find(
      (s) =>
        (s.detected_characters ?? []).map((n) => n.toLowerCase()).includes(nameLower) ||
        s.tagged_description?.toLowerCase().includes(`[${nameLower}]`),
    );
    return {
      ...char,
      firstSceneOrder: firstScene?.order,
      origin: firstScene
        ? `Aparece pela primeira vez na cena ${firstScene.order} — ${firstScene.original_location}`
        : undefined,
    };
  });
