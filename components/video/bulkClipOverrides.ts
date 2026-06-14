import type { SceneVideoClipOverride, Scene } from '@/types';

/** Campos de movimento que podem ser copiados em lote de um plano para outros. */
export type BulkClipPatch = Partial<Pick<
  SceneVideoClipOverride,
  'durationSeconds' | 'transitionIn' | 'transitionDurationSeconds' | 'transitionEasing' | 'kenBurns'
>>;

/** Plano alvo de uma aplicação em lote, com o patch específico daquele plano. */
export interface BulkClipTarget {
  /** `Scene.id` (linha), não o `scene_id` da cena-pai. */
  sceneId: number;
  /** `main`, `split:<id>` ou `end`. */
  sourceId: string;
  /** Campos a gravar neste plano. Patch vazio = alvo ignorado. */
  patch: BulkClipPatch;
}

/** Atualização pronta para `onClipOverridesChange(sceneId, overrides)`. */
export interface SceneOverrideUpdate {
  sceneId: number;
  overrides: SceneVideoClipOverride[] | undefined;
}

const upsertClip = (
  list: SceneVideoClipOverride[],
  sourceId: string,
  patch: BulkClipPatch,
): SceneVideoClipOverride[] => {
  const index = list.findIndex(item => item.sourceId === sourceId);
  if (index === -1) return [...list, { sourceId, ...patch }];
  const next = [...list];
  next[index] = { ...next[index], ...patch };
  return next;
};

/**
 * Mescla um patch de movimento por plano nos overrides das cenas. Agrupa os
 * alvos por cena (uma cena pode ter vários planos) para que cada cena receba
 * **uma** chamada de `onClipOverridesChange` com o array já atualizado. Só toca
 * nos campos presentes no patch — os demais (lettering, etc.) são preservados.
 * Alvos com patch vazio ou cuja cena não existe em `scenes` são ignorados.
 */
export const buildBulkClipUpdates = (
  scenes: Scene[],
  targets: BulkClipTarget[],
): SceneOverrideUpdate[] => {
  const targetsByScene = new Map<number, BulkClipTarget[]>();
  targets.forEach(target => {
    if (Object.keys(target.patch).length === 0) return;
    const list = targetsByScene.get(target.sceneId) ?? [];
    list.push(target);
    targetsByScene.set(target.sceneId, list);
  });

  const updates: SceneOverrideUpdate[] = [];
  targetsByScene.forEach((sceneTargets, sceneId) => {
    const scene = scenes.find(item => item.id === sceneId);
    if (!scene) return;
    let overrides = scene.videoClipOverrides ? [...scene.videoClipOverrides] : [];
    sceneTargets.forEach(target => {
      overrides = upsertClip(overrides, target.sourceId, target.patch);
    });
    updates.push({ sceneId, overrides: overrides.length === 0 ? undefined : overrides });
  });
  return updates;
};
