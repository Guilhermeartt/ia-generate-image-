import { useState, useCallback } from 'react';
import type { Character, Scene, ImageModel, AppSettings, SceneReference } from '../types';
import type { SplitImage } from '../types';

// ── Construtor de instruções categorizadas para SceneReference ────────────────
// Mantém estritamente o papel de cada referência (spatial / object / screen),
// evitando que uma referência de objeto ou tela redefina toda a composição.
const buildSceneReferenceInstruction = (refs: SceneReference[]): string => {
  if (refs.length === 0) return '';

  const labelOf = (r: SceneReference, i: number) =>
    r.label?.trim() || `Referência ${i + 1}`;

  const lines: string[] = [];
  lines.push(
    'REGRAS DE INTERPRETAÇÃO DE REFERÊNCIAS VISUAIS — siga estritamente o papel de cada uma. ' +
    'Nem toda referência altera a imagem inteira: respeite a categoria indicada e nunca trate ' +
    'screenshots, dashboards, interfaces, apps ou páginas como base estrutural da cena — esses ' +
    'casos são SCREEN INSERT e devem aparecer apenas dentro da área visível de um dispositivo.'
  );

  const spatial = refs.filter(r => (r.kind ?? 'object') === 'spatial');
  const objects = refs.filter(r => (r.kind ?? 'object') === 'object');
  const screens = refs.filter(r => (r.kind ?? 'object') === 'screen');

  if (spatial.length > 0) {
    lines.push('— Referências ESPACIAIS / ESTRUTURAIS (influenciam composição, cenário, enquadramento, profundidade e organização do espaço; não copiar literalmente; o conteúdo principal continua seguindo o prompt da cena):');
    spatial.forEach((r, i) => {
      const target = r.target?.trim();
      const note = r.blendNote?.trim();
      const parts = [
        `• ${labelOf(r, i)}`,
        target ? `aplicar em: ${target}` : 'aplicar como guia geral de cenário/composição',
        note ? `observação: ${note}` : '',
      ].filter(Boolean);
      lines.push(parts.join(' — '));
    });
  }

  if (objects.length > 0) {
    lines.push('— Referências de OBJETO (inserir como elemento localizado preservando identidade visual; ajustar escala, perspectiva, iluminação, sombras e oclusão; NÃO reestruturar a cena nem virar estilo global):');
    objects.forEach((r, i) => {
      const target = r.target?.trim();
      const note = r.blendNote?.trim();
      const parts = [
        `• ${labelOf(r, i)}`,
        target ? `posicionar: ${target}` : 'posicionar de forma natural na cena (sobre superfície, na mão da pessoa ou encaixado no ambiente)',
        note ? `observação: ${note}` : '',
      ].filter(Boolean);
      lines.push(parts.join(' — '));
    });
  }

  if (screens.length > 0) {
    lines.push('— Referências de TELA / SCREEN INSERT (usar APENAS como conteúdo dentro de uma tela já existente na cena — celular, tablet, notebook, monitor ou painel digital; preservar moldura/bezel, corpo do dispositivo, mãos e ambiente; aplicar perspectiva correta, brilho de tela e reflexos sutis; respeitar orientação vertical/horizontal; NUNCA transformar a imagem inteira em reprodução desta referência):');
    screens.forEach((r, i) => {
      const target = r.target?.trim();
      const note = r.blendNote?.trim();
      const parts = [
        `• ${labelOf(r, i)}`,
        target ? `exibir em: ${target}` : 'exibir no display do dispositivo presente na cena',
        note ? `observação: ${note}` : '',
      ].filter(Boolean);
      lines.push(parts.join(' — '));
    });
  }

  lines.push(
    'Prioridade: a composição principal continua baseada no prompt da cena. Combine as referências apenas dentro de seu papel; evite mudanças desnecessárias fora da região ou função especificada.'
  );

  return lines.join('\n');
};
import { generateSceneImage, generateImage, generateSplitPrompts, analyzeScene, editImage, recreateScenePrompt } from '../services/geminiService';
import { applyPromptStyle, buildSceneAnalysisStyleInstruction } from '../utils/stylePrompt';
import { updateSceneCameraModuleOnly, updateSceneCameraPositionModuleOnly, updateSceneVisualStyleModuleOnly, type CameraHeightId, type CameraPositionId } from '../utils/promptModules';
import { normalizePromptJson, serializeImagePrompt } from '../utils/promptCoherence';

type SceneCharacterEdit =
  | { type: 'add'; name: string }
  | { type: 'remove'; name: string }
  | { type: 'replace'; from: string; to: string };

const characterInstructionRe = /\n?\n?Characters in frame: [^\n]+\.?/gi;

const sameName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

const uniqueNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const clean = name.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
};

const taggedNamesFromDescription = (description: string): string[] =>
  uniqueNames((description.match(/\[(.*?)\]/g) || []).map(tag => tag.slice(1, -1)));

const syncLegacyPromptCharacters = (prompt: string, names: string[]): string => {
  const basePrompt = prompt.replace(characterInstructionRe, '').trim();
  if (names.length === 0) return basePrompt;
  return `${basePrompt}\n\nCharacters in frame: ${names.join(', ')}. Preserve visual continuity with the character references when available.`;
};

interface UseScenesParams {
  imageModel: ImageModel;
  aspectRatio: string;
  generalContext: string;
  globalReferenceImage: { base64: string; mimeType: string } | null;
  resolution: '1K' | '2K' | '4K';
  numberOfImages: number;
  characters: Character[];
  settings: AppSettings;
  getImageDimensions: (base64Url: string) => Promise<{ width: number; height: number }>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useScenes({
  imageModel,
  aspectRatio,
  generalContext,
  globalReferenceImage,
  resolution,
  numberOfImages,
  characters,
  settings,
  getImageDimensions,
  showToast,
}: UseScenesParams) {
  const [scenes, setScenes] = useState<Scene[]>([]);

  const generateImageForScene = useCallback(
    async (
      targetScene: Scene,
      allScenes: Scene[],
      allCharacters: Character[]
    ): Promise<{ base64Data: string; mimeType: string; tokens?: number; costBRL?: number }> => {
      let sceneReference: { name: string; base64Data: string; mimeType: string } | undefined = undefined;
      const sceneIndex = allScenes.findIndex(s => s.id === targetScene.id);

      if (targetScene.isContinuation) {
        let referenceScene: Scene | undefined;

        if (targetScene.continuationReferenceId) {
          if (targetScene.continuationReferenceId !== targetScene.order) {
            referenceScene = allScenes.find(
              s => s.order === targetScene.continuationReferenceId && s.imageUrl
            );
          }
        } else if (sceneIndex > 0) {
          referenceScene = allScenes[sceneIndex - 1];
        }

        if (referenceScene && referenceScene.imageUrl && referenceScene.imageMimeType) {
          const parts = referenceScene.imageUrl.split(',');
          const base64Data = parts[1];
          sceneReference = { name: 'scene_reference', base64Data, mimeType: referenceScene.imageMimeType };
        }
      }

      const characterNamesInScene = [
        ...new Set(
          (targetScene.tagged_description.match(/\[(.*?)\]/g) || []).map(tag => tag.slice(1, -1))
        ),
      ];

      const characterReferences = allCharacters
        .filter(char => characterNamesInScene.includes(char.name) && char.imageUrl && char.imageMimeType)
        .map(char => {
          const parts = char.imageUrl!.split(',');
          const base64Data = parts[1];
          return { name: char.name, base64Data, mimeType: char.imageMimeType! };
        });

      const prompt = applyPromptStyle(targetScene.image_prompt, targetScene.sceneGraphicStyle);
      const activeSceneRefs = (targetScene.references ?? []).filter(r => r.enabled !== false);
      const sceneExtraReferences = activeSceneRefs.map(r => ({
        base64Data: r.base64Data,
        mimeType: r.mimeType,
      }));
      const sceneRefInstruction = buildSceneReferenceInstruction(activeSceneRefs);
      const globalStyleReferences = [
        ...sceneExtraReferences,
        ...(globalReferenceImage
          ? [{ base64Data: globalReferenceImage.base64, mimeType: globalReferenceImage.mimeType }]
          : []),
      ];
      const globalStyleInstruction = [
        sceneRefInstruction,
        globalReferenceImage
          ? 'Use the external reference image as a global visual style guide for color palette, lighting, texture, production design, and overall photographic treatment. Do not copy its exact subject unless the scene prompt asks for it.'
          : '',
      ].filter(Boolean).join('\n') || undefined;

      if (characterReferences.length > 0 || sceneReference || globalStyleReferences.length > 0) {
        const modelToUse: string =
          imageModel === 'gemini-3-pro-image-preview'
            ? 'gemini-3-pro-image-preview'
            : imageModel === 'gemini-3.1-flash-image-preview'
            ? 'gemini-3.1-flash-image-preview'
            : 'gemini-2.5-flash-image';

        return generateSceneImage(
          prompt,
          characterReferences,
          aspectRatio,
          generalContext,
          sceneReference,
          modelToUse,
          resolution,
          globalStyleReferences,
          globalStyleInstruction
        );
      } else {
        return generateImage(prompt, imageModel, aspectRatio, numberOfImages, generalContext, resolution);
      }
    },
    [imageModel, aspectRatio, generalContext, globalReferenceImage, resolution, numberOfImages]
  );

  const handleGenerateSceneImage = useCallback(
    async (sceneId: number) => {
      const scenesSnapshot = scenes;
      const originalScene = scenesSnapshot.find(s => s.id === sceneId);
      if (!originalScene) return;

      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: true, error: undefined } : s));

      try {
        if (originalScene.isContinuation) {
          const originalSceneIndex = scenesSnapshot.findIndex(s => s.id === sceneId);
          let referenceScene: Scene | undefined;

          if (originalScene.continuationReferenceId) {
            if (originalScene.continuationReferenceId === originalScene.order) {
              console.warn(
                `Cena ${originalScene.id} tenta referenciar a si mesma (Ordem ${originalScene.order}). Ignorando referência.`
              );
            } else {
              referenceScene = scenesSnapshot.find(s => s.order === originalScene.continuationReferenceId);
            }
          } else if (originalSceneIndex > 0) {
            referenceScene = scenesSnapshot[originalSceneIndex - 1];
          }

          if (referenceScene && !referenceScene.imageUrl) {
            const refName = originalScene.continuationReferenceId
              ? `Ordem ${originalScene.continuationReferenceId}`
              : 'anterior';
            showToast(
              `Cena de referência (${refName}) ainda não tem imagem — gerada sem continuidade.`,
              'info'
            );
          }
        }

        const { base64Data, mimeType, tokens, costBRL } = await generateImageForScene(
          originalScene, scenesSnapshot, characters
        );
        const newImageUrl = `data:${mimeType};base64,${base64Data}`;
        const { width, height } = await getImageDimensions(newImageUrl);

        setScenes(prev =>
          prev.map(s => {
            if (s.id === originalScene.id) {
              return {
                ...s,
                imageUrl: newImageUrl,
                imageMimeType: mimeType,
                isLoading: false,
                imageWidth: width,
                imageHeight: height,
                tokens,
                costBRL,
                modelUsed: imageModel,
                previousImageUrl: s.imageUrl,
                previousImageMimeType: s.imageMimeType,
                accumulatedCostBRL: (s.accumulatedCostBRL ?? s.costBRL ?? 0) + (costBRL ?? 0),
                versionCount: (s.versionCount ?? (s.imageUrl ? 1 : 0)) + 1,
              };
            }
            return s;
          })
        );
      } catch (e: any) {
        console.error(`Falha ao gerar imagem para a cena ${originalScene.id}`, e);
        const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
        setScenes(prev =>
          prev.map(s => s.id === sceneId ? { ...s, isLoading: false, error: errorMessage } : s)
        );
      }
    },
    [scenes, characters, aspectRatio, generalContext, imageModel, numberOfImages, resolution, showToast, generateImageForScene, getImageDimensions]
  );

  const handleGenerateEndFrame = useCallback(
    async (sceneId: number) => {
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene || !scene.end_frame_prompt) return;

      setScenes(prev =>
        prev.map(s =>
          s.id === sceneId ? { ...s, endFrameIsLoading: true, endFrameError: undefined } : s
        )
      );

      try {
        const prompt = scene.end_frame_prompt;

        let base64Data: string;
        let mimeType: string;
        let tokens: number | undefined;
        let costBRL: number | undefined;

        if (scene.imageUrl) {
          // Use edit-image so the end frame is a visual continuation of the start frame
          const editPrompt = `Mantenha o mesmo cenário, personagens, iluminação e estilo visual do frame de referência. Avance a ação para o momento descrito: ${prompt}`;
          const result = await editImage(scene.imageUrl, editPrompt, generalContext);
          base64Data = result.base64Data;
          mimeType = result.mimeType;
          tokens = result.tokens;
          costBRL = result.costBRL;
        } else {
          const result = await generateImage(prompt, imageModel, aspectRatio, numberOfImages, generalContext, resolution);
          base64Data = result.base64Data;
          mimeType = result.mimeType;
          tokens = result.tokens;
          costBRL = result.costBRL;
        }

        const newImageUrl = `data:${mimeType};base64,${base64Data}`;
        const { width, height } = await getImageDimensions(newImageUrl);

        setScenes(prev =>
          prev.map(s =>
            s.id === sceneId
              ? {
                  ...s,
                  endFrameUrl: newImageUrl,
                  endFrameMimeType: mimeType,
                  endFrameWidth: width,
                  endFrameHeight: height,
                  endFrameIsLoading: false,
                  endFrameTokens: tokens,
                  endFrameCostBRL: costBRL,
                }
              : s
          )
        );
      } catch (e: any) {
        const errorMessage = e instanceof Error ? e.message : 'Erro ao gerar frame final.';
        setScenes(prev =>
          prev.map(s =>
            s.id === sceneId ? { ...s, endFrameIsLoading: false, endFrameError: errorMessage } : s
          )
        );
      }
    },
    [scenes, imageModel, aspectRatio, numberOfImages, generalContext, resolution, getImageDimensions]
  );

  const handleGenerateSceneImageWithReference = useCallback(
    async (
      sceneId: number,
      overridePrompt: string,
      croppedBase64: string | null,
      croppedMimeType: string | null,
      extraReferences?: { base64Data: string; mimeType: string }[],
      blendInstruction?: string
    ) => {
      const scenesSnapshot = scenes;
      const originalScene = scenesSnapshot.find(s => s.id === sceneId);
      if (!originalScene) return;

      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: true, error: undefined } : s));

      try {
        const characterNamesInScene = [
          ...new Set(
            (originalScene.tagged_description.match(/\[(.*?)\]/g) || []).map((tag: string) =>
              tag.slice(1, -1)
            )
          ),
        ];

        const characterReferences = characters
          .filter(char => characterNamesInScene.includes(char.name) && char.imageUrl && char.imageMimeType)
          .map(char => {
            const parts = char.imageUrl!.split(',');
            return { name: char.name, base64Data: parts[1], mimeType: char.imageMimeType! };
          });

        const sceneReference =
          croppedBase64 && croppedMimeType
            ? { name: 'region_reference', base64Data: croppedBase64, mimeType: croppedMimeType }
            : undefined;
        const persistentSceneRefs = (originalScene.references ?? []).filter(r => r.enabled !== false);
        const persistentExtraReferences = persistentSceneRefs.map(r => ({
          base64Data: r.base64Data,
          mimeType: r.mimeType,
        }));
        const persistentRefInstruction = buildSceneReferenceInstruction(persistentSceneRefs);
        const mergedExtraReferences = [
          ...persistentExtraReferences,
          ...(extraReferences || []),
          ...(globalReferenceImage
            ? [{ base64Data: globalReferenceImage.base64, mimeType: globalReferenceImage.mimeType }]
            : []),
        ];
        const mergedBlendInstruction = [
          persistentRefInstruction,
          blendInstruction,
          globalReferenceImage
            ? 'Use the final external reference as a global visual style guide for color palette, lighting, texture, production design, and overall photographic treatment. Do not copy its exact subject unless the scene prompt asks for it.'
            : '',
        ].filter(Boolean).join('\n');

        let base64Data: string;
        let mimeType: string;
        let tokens: number | undefined;
        let costBRL: number | undefined;

        if (characterReferences.length > 0 || sceneReference || mergedExtraReferences.length > 0) {
          const modelToUse =
            imageModel === 'gemini-3-pro-image-preview'
              ? 'gemini-3-pro-image-preview'
              : imageModel === 'gemini-3.1-flash-image-preview'
              ? 'gemini-3.1-flash-image-preview'
              : 'gemini-2.5-flash-image';
          const result = await generateSceneImage(
            overridePrompt, characterReferences, aspectRatio,
            generalContext, sceneReference, modelToUse, resolution,
            mergedExtraReferences, mergedBlendInstruction
          );
          base64Data = result.base64Data;
          mimeType = result.mimeType;
          tokens = result.tokens;
          costBRL = result.costBRL;
        } else {
          const result = await generateImage(
            overridePrompt, imageModel, aspectRatio, numberOfImages, generalContext, resolution
          );
          base64Data = result.base64Data;
          mimeType = result.mimeType;
          tokens = result.tokens;
          costBRL = result.costBRL;
        }

        const newImageUrl = `data:${mimeType};base64,${base64Data}`;
        const { width, height } = await getImageDimensions(newImageUrl);

        setScenes(prev =>
          prev.map(s => {
            if (s.id === sceneId) {
              return {
                ...s,
                imageUrl: newImageUrl,
                imageMimeType: mimeType,
                isLoading: false,
                imageWidth: width,
                imageHeight: height,
                tokens,
                costBRL,
                modelUsed: imageModel,
                previousImageUrl: s.imageUrl,
                previousImageMimeType: s.imageMimeType,
                accumulatedCostBRL: (s.accumulatedCostBRL ?? s.costBRL ?? 0) + (costBRL ?? 0),
                versionCount: (s.versionCount ?? (s.imageUrl ? 1 : 0)) + 1,
              };
            }
            return s;
          })
        );
      } catch (e: any) {
        console.error(`Falha ao gerar imagem com referência para a cena ${sceneId}`, e);
        const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
        setScenes(prev =>
          prev.map(s => s.id === sceneId ? { ...s, isLoading: false, error: errorMessage } : s)
        );
      }
    },
    [scenes, characters, aspectRatio, generalContext, globalReferenceImage, imageModel, numberOfImages, resolution, getImageDimensions]
  );

  const handleSplitScene = useCallback(
    async (sceneId: number, count: number, instructions: string) => {
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene) return;

      setScenes(prev =>
        prev.map(s => s.id === sceneId ? { ...s, isSplitting: true, splitImages: undefined } : s)
      );

      let subPrompts: string[];
      try {
        subPrompts = await generateSplitPrompts(scene.image_prompt, generalContext, count, instructions);
      } catch (e: any) {
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isSplitting: false } : s));
        console.error('Falha ao gerar sub-prompts:', e);
        return;
      }

      const initialSplitImages: SplitImage[] = subPrompts.map((prompt, i) => ({
        id: `${sceneId}-split-${Date.now()}-${i}`,
        prompt,
        isLoading: true,
      }));
      setScenes(prev =>
        prev.map(s =>
          s.id === sceneId ? { ...s, isSplitting: false, splitImages: initialSplitImages } : s
        )
      );

      const characterNamesInScene = [
        ...new Set(
          (scene.tagged_description.match(/\[(.*?)\]/g) || []).map((tag: string) => tag.slice(1, -1))
        ),
      ];
      const characterReferences = characters
        .filter(c => characterNamesInScene.includes(c.name) && c.imageUrl && c.imageMimeType)
        .map(c => ({ name: c.name, base64Data: c.imageUrl!.split(',')[1], mimeType: c.imageMimeType! }));
      const globalStyleReferences = globalReferenceImage
        ? [{ base64Data: globalReferenceImage.base64, mimeType: globalReferenceImage.mimeType }]
        : [];
      const globalStyleInstruction = globalReferenceImage
        ? 'Use the external reference image as a global visual style guide for color palette, lighting, texture, production design, and overall photographic treatment. Do not copy its exact subject unless the sub-scene prompt asks for it.'
        : undefined;

      for (let i = 0; i < subPrompts.length; i++) {
        try {
          let result: { base64Data: string; mimeType: string; tokens?: number; costBRL?: number };
          if (characterReferences.length > 0 || globalStyleReferences.length > 0) {
            const modelToUse =
              imageModel === 'gemini-3-pro-image-preview'
                ? 'gemini-3-pro-image-preview'
                : imageModel === 'gemini-3.1-flash-image-preview'
                ? 'gemini-3.1-flash-image-preview'
                : 'gemini-2.5-flash-image';
            result = await generateSceneImage(
              subPrompts[i],
              characterReferences,
              aspectRatio,
              generalContext,
              undefined,
              modelToUse,
              resolution,
              globalStyleReferences,
              globalStyleInstruction
            );
          } else {
            result = await generateImage(subPrompts[i], imageModel, aspectRatio, 1, generalContext, resolution);
          }
          const imageUrl = `data:${result.mimeType};base64,${result.base64Data}`;
          setScenes(prev =>
            prev.map(s => {
              if (s.id !== sceneId) return s;
              const generatedWithReferences = characterReferences.length > 0 || globalStyleReferences.length > 0;
              const usedModel =
                generatedWithReferences
                  ? imageModel === 'gemini-3-pro-image-preview'
                    ? 'gemini-3-pro-image-preview'
                    : imageModel === 'gemini-3.1-flash-image-preview'
                    ? 'gemini-3.1-flash-image-preview'
                    : 'gemini-2.5-flash-image'
                  : imageModel;
              const updated = (s.splitImages || []).map((img, idx) =>
                idx === i
                  ? {
                      ...img,
                      imageUrl,
                      imageMimeType: result.mimeType,
                      isLoading: false,
                      tokens: result.tokens,
                      costBRL: result.costBRL,
                      modelUsed: usedModel,
                    }
                  : img
              );
              return { ...s, splitImages: updated };
            })
          );
        } catch (e: any) {
          const errorMessage = e instanceof Error ? e.message : 'Erro ao gerar imagem.';
          setScenes(prev =>
            prev.map(s => {
              if (s.id !== sceneId) return s;
              const updated = (s.splitImages || []).map((img, idx) =>
                idx === i ? { ...img, isLoading: false, error: errorMessage } : img
              );
              return { ...s, splitImages: updated };
            })
          );
        }
      }
    },
    [scenes, characters, aspectRatio, generalContext, globalReferenceImage, imageModel, resolution]
  );

  const handleClearSplit = useCallback((sceneId: number) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, splitImages: undefined } : s));
  }, []);

  const handleUpdateSplitImage = useCallback((sceneId: number, splitId: string, newImageUrl: string, mimeType: string) => {
    setScenes(prev => prev.map(s => {
      if (s.id !== sceneId) return s;
      return {
        ...s,
        splitImages: (s.splitImages || []).map(img =>
          img.id === splitId ? { ...img, imageUrl: newImageUrl, imageMimeType: mimeType } : img
        ),
      };
    }));
  }, []);

  const handleScenePromptChange = useCallback((id: number, newPrompt: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, image_prompt: newPrompt } : s));
  }, []);

  const handleSceneStyleChange = useCallback((id: number, newStyle: string) => {
    setScenes(prev => prev.map(s => s.id === id ? updateSceneCameraModuleOnly(s, newStyle) : s));
  }, []);

  const handleSceneVisualStyleChange = useCallback((id: number, sceneStyle: string) => {
    setScenes(prev => prev.map(s => s.id === id ? updateSceneVisualStyleModuleOnly(s, sceneStyle) : s));
  }, []);

  const handleSceneCameraPositionChange = useCallback((id: number, positionId: CameraPositionId | '', heightId: CameraHeightId | '') => {
    setScenes(prev => prev.map(s => s.id === id ? updateSceneCameraPositionModuleOnly(s, positionId, heightId) : s));
  }, []);

  const handleSceneCharacterEdit = useCallback((id: number, edit: SceneCharacterEdit) => {
    setScenes(prev => prev.map(scene => {
      if (scene.id !== id) return scene;

      const currentNames = uniqueNames([
        ...(scene.detected_characters ?? []),
        ...taggedNamesFromDescription(scene.tagged_description),
      ]);

      let nextNames = currentNames;
      let nextDescription = scene.tagged_description;

      if (edit.type === 'add') {
        if (currentNames.some(name => sameName(name, edit.name))) return scene;
        nextNames = uniqueNames([...currentNames, edit.name]);
        nextDescription = `${nextDescription.trim()}\nPersonagem adicionado: [${edit.name}].`;
      } else if (edit.type === 'remove') {
        nextNames = currentNames.filter(name => !sameName(name, edit.name));
        nextDescription = nextDescription
          .replace(new RegExp(`\\[${edit.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'gi'), edit.name)
          .replace(new RegExp(`\\n?Personagem adicionado:\\s*${edit.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.?`, 'gi'), '')
          .trim();
      } else {
        if (sameName(edit.from, edit.to)) return scene;
        nextNames = uniqueNames(currentNames.map(name => sameName(name, edit.from) ? edit.to : name));
        nextDescription = nextDescription.replace(
          new RegExp(`\\[${edit.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'gi'),
          `[${edit.to}]`
        );
        if (!new RegExp(`\\[${edit.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'i').test(nextDescription)) {
          nextDescription = `${nextDescription.trim()}\nPersonagem adicionado: [${edit.to}].`;
        }
      }

      const nextPromptJson = scene.prompt_json
        ? {
            ...scene.prompt_json,
            characters: nextNames.map(name => {
              const existing = scene.prompt_json?.characters?.find(char => sameName(char.name, name));
              return existing ?? {
                name,
                role_in_frame: 'present in frame according to the scene action',
                visual_continuity: 'preserve the established character reference and identity',
              };
            }),
            negative_constraints: (scene.prompt_json.negative_constraints ?? []).filter(rule =>
              !/no\s+people|no\s+humans?|no\s+persons?|without\s+people/i.test(rule)
            ),
          }
        : undefined;

      return {
        ...scene,
        tagged_description: nextDescription,
        detected_characters: nextNames,
        prompt_json: nextPromptJson,
        image_prompt: nextPromptJson
          ? serializeImagePrompt(nextPromptJson, scene.includeLettering, scene.lettering_notes)
          : syncLegacyPromptCharacters(scene.image_prompt, nextNames),
      };
    }));
  }, []);

  const handleSceneContinuationChange = useCallback((id: number, isChecked: boolean) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, isContinuation: isChecked } : s));
  }, []);

  const handleContinuationReferenceChange = useCallback((id: number, refIdStr: string) => {
    const refId = refIdStr ? parseInt(refIdStr, 10) : null;
    setScenes(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, continuationReferenceId: !isNaN(refId as number) ? refId : null }
          : s
      )
    );
  }, []);

  const handleUpdateScenePrompt = useCallback(
    async (sceneId: number) => {
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene) return;

      setScenes(prev =>
        prev.map(s => s.id === sceneId ? { ...s, isUpdatingPrompt: true, error: undefined } : s)
      );

      try {
        if (scene.prompt_json) {
          setScenes(prev =>
            prev.map(s => s.id === sceneId ? { ...updateSceneCameraModuleOnly(s, s.style), isUpdatingPrompt: false } : s)
          );
          return;
        }

        const { prompt_json, image_prompt } = await analyzeScene(
          scene.original_location,
          scene.original_description,
          characters,
          [scene.style, buildSceneAnalysisStyleInstruction(scene.sceneGraphicStyle)].filter(Boolean).join('\n'),
          settings.sceneAnalysisPrompt,
          generalContext
        );
        const normalizedPromptJson = normalizePromptJson(prompt_json) ?? prompt_json;
        setScenes(prev =>
          prev.map(s => {
            if (s.id !== sceneId) return s;
            const nextImagePrompt = normalizedPromptJson
              ? serializeImagePrompt(normalizedPromptJson, s.includeLettering, s.lettering_notes)
              : image_prompt;
            return { ...s, prompt_json: normalizedPromptJson, image_prompt: nextImagePrompt, isUpdatingPrompt: false };
          })
        );
      } catch (e: any) {
        console.error(`Failed to update prompt for scene ${sceneId}`, e);
        const errorMessage = e instanceof Error ? e.message : 'Falha ao atualizar o prompt.';
        setScenes(prev =>
          prev.map(s => s.id === sceneId ? { ...s, isUpdatingPrompt: false, error: errorMessage } : s)
        );
      }
    },
    [scenes, characters, settings.sceneAnalysisPrompt, generalContext]
  );

  const handleRecreateScenePrompt = useCallback(
    async (sceneId: number, creativeDirection: string) => {
      const direction = creativeDirection?.trim();
      if (!direction) return;
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene) return;

      setScenes(prev =>
        prev.map(s => s.id === sceneId ? { ...s, isUpdatingPrompt: true, error: undefined } : s)
      );

      try {
        const { prompt_json, image_prompt, visual_intention } = await recreateScenePrompt({
          location: scene.original_location,
          description: scene.original_description,
          currentImagePrompt: scene.image_prompt,
          currentPromptJson: scene.prompt_json,
          creativeDirection: direction,
          style: [scene.style, buildSceneAnalysisStyleInstruction(scene.sceneGraphicStyle)].filter(Boolean).join('\n'),
          characterList: characters,
          generalContext,
        });

        const normalizedPromptJson = normalizePromptJson(prompt_json) ?? prompt_json;
        setScenes(prev =>
          prev.map(s => {
            if (s.id !== sceneId) return s;
            const nextImagePrompt = normalizedPromptJson
              ? serializeImagePrompt(normalizedPromptJson, s.includeLettering, s.lettering_notes)
              : image_prompt;
            return {
              ...s,
              prompt_json: normalizedPromptJson,
              image_prompt: nextImagePrompt,
              visual_intention: visual_intention ?? s.visual_intention,
              isUpdatingPrompt: false,
            };
          })
        );
        showToast('Prompt recriado com a nova direção criativa.', 'success');
      } catch (e: any) {
        console.error(`Failed to recreate prompt for scene ${sceneId}`, e);
        const errorMessage = e instanceof Error ? e.message : 'Falha ao recriar o prompt.';
        setScenes(prev =>
          prev.map(s => s.id === sceneId ? { ...s, isUpdatingPrompt: false, error: errorMessage } : s)
        );
        showToast(errorMessage, 'error');
      }
    },
    [scenes, characters, generalContext, showToast]
  );

  const handleSceneImageUpdate = useCallback(
    async (id: number, newImageUrl: string, newMimeType: string) => {
      try {
        const { width, height } = await getImageDimensions(newImageUrl);
        setScenes(prev =>
          prev.map(s => {
            if (s.id === id) {
              return {
                ...s,
                previousImageUrl: s.imageUrl,
                previousImageMimeType: s.imageMimeType,
                imageUrl: newImageUrl,
                imageMimeType: newMimeType,
                imageWidth: width,
                imageHeight: height,
              };
            }
            return s;
          })
        );
      } catch (e) {
        console.error('Failed to get image dimensions for updated scene image', e);
      }
    },
    [getImageDimensions]
  );

  const handleRevertSceneImage = useCallback((id: number) => {
    setScenes(prev =>
      prev.map(s => {
        if (s.id === id && s.previousImageUrl) {
          return {
            ...s,
            imageUrl: s.previousImageUrl,
            imageMimeType: s.previousImageMimeType,
            previousImageUrl: s.imageUrl,
            previousImageMimeType: s.imageMimeType,
          };
        }
        return s;
      })
    );
  }, []);

  const handleApplyAlternativePrompt = useCallback((id: number) => {
    setScenes(prev =>
      prev.map(s => {
        if (s.id !== id || !s.refinement?.alternativePrompt) return s;
        return {
          ...s,
          image_prompt: s.refinement.alternativePrompt,
          refinement: {
            ...s.refinement,
            alternativePrompt: s.image_prompt,
          },
        };
      })
    );
  }, []);

  const handleApplySplitSuggestion = useCallback(
    (id: number) => {
      const scene = scenes.find(s => s.id === id);
      if (!scene?.refinement?.splitSuggestion) return;
      const count = scene.refinement.splitSuggestion.length;
      const instructions = scene.refinement.splitSuggestion
        .map((sub, i) => `Sub-cena ${i + 1}: ${sub.description}`)
        .join('\n');
      handleSplitScene(id, count, instructions);
    },
    [scenes, handleSplitScene]
  );

  const handleSceneReferencesChange = useCallback(
    (id: number, updater: (current: Scene['references']) => Scene['references']) => {
      setScenes(prev => prev.map(s => (s.id === id ? { ...s, references: updater(s.references) } : s)));
    },
    []
  );

  const handleIncludeLetteringChange = useCallback((id: number, include: boolean) => {
    setScenes(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next: Scene = { ...s, includeLettering: include };
      if (next.prompt_json) {
        next.image_prompt = serializeImagePrompt(next.prompt_json, include, next.lettering_notes);
      }
      return next;
    }));
  }, []);

  return {
    scenes,
    setScenes,
    generateImageForScene,
    handleGenerateSceneImage,
    handleGenerateEndFrame,
    handleGenerateSceneImageWithReference,
    handleSplitScene,
    handleClearSplit,
    handleScenePromptChange,
    handleSceneStyleChange,
    handleSceneVisualStyleChange,
    handleSceneCameraPositionChange,
    handleSceneCharacterEdit,
    handleSceneContinuationChange,
    handleContinuationReferenceChange,
    handleUpdateScenePrompt,
    handleRecreateScenePrompt,
    handleSceneImageUpdate,
    handleRevertSceneImage,
    handleApplyAlternativePrompt,
    handleApplySplitSuggestion,
    handleUpdateSplitImage,
    handleIncludeLetteringChange,
    handleSceneReferencesChange,
  };
}
