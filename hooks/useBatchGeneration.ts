import { useState, useCallback } from 'react';
import type { Character, Scene } from '../types';

interface BatchProgress {
  current: number;
  total: number;
  currentItemName: string;
}

interface UseBatchGenerationParams {
  characters: Character[];
  scenes: Scene[];
  handleGenerateCharacterImage: (name: string) => Promise<void>;
  handleGenerateSceneImage: (sceneId: number) => Promise<void>;
}

export function useBatchGeneration({
  characters,
  scenes,
  handleGenerateCharacterImage,
  handleGenerateSceneImage,
}: UseBatchGenerationParams) {
  const [isGeneratingAllChars, setIsGeneratingAllChars] = useState(false);
  const [isGeneratingAllScenes, setIsGeneratingAllScenes] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);

  const generateAllImagesInSequence = useCallback(
    async <T extends { name: string } | { id: number; scene_id?: number; sub_id?: number }>(
      items: T[],
      setLoading: (loading: boolean) => void,
      generateFn: (id: string | number) => Promise<void>,
      getItemLogName: (item: T) => string,
      itemTypeName: string
    ) => {
      setLoading(true);
      const itemsToGenerate = items.filter(item => !(item as any).imageUrl);
      const totalToGenerate = itemsToGenerate.length;

      if (totalToGenerate === 0) {
        setLoading(false);
        return;
      }

      for (let i = 0; i < totalToGenerate; i++) {
        const item = itemsToGenerate[i];
        const id = 'name' in item ? item.name : item.id;
        const logName = getItemLogName(item);

        setBatchProgress({
          current: i + 1,
          total: totalToGenerate,
          currentItemName: logName,
        });

        console.log(`Gerando ${itemTypeName} para ${logName}... (${i + 1}/${totalToGenerate})`);

        let hasError = false;
        try {
          await generateFn(id);
        } catch (e) {
          console.error(`Falha ao gerar ${itemTypeName} para ${logName}, continuando para o próximo.`);
          hasError = true;
        }

        if (i < totalToGenerate - 1) {
          const delay = hasError ? 30000 : 8000;
          if (hasError)
            console.log(`Erro detectado no lote. Pausando por ${delay / 1000}s para recuperação da API...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      setLoading(false);
      setBatchProgress(null);
      console.log(`Finalizada a geração de todas as imagens de ${itemTypeName}.`);
    },
    []
  );

  const handleGenerateAllCharacterImages = useCallback(() => {
    generateAllImagesInSequence(
      characters,
      setIsGeneratingAllChars,
      (id) => handleGenerateCharacterImage(String(id)),
      (item) => (item as Character).name,
      'retrato'
    );
  }, [characters, handleGenerateCharacterImage, generateAllImagesInSequence]);

  const handleGenerateAllSceneImages = useCallback(() => {
    const scenesCopy = [...scenes];
    const ordered: Scene[] = [];
    const visited = new Set<number>();

    const visit = (scene: Scene) => {
      if (visited.has(scene.id)) return;
      if (scene.isContinuation) {
        let refScene: Scene | undefined;
        if (scene.continuationReferenceId && scene.continuationReferenceId !== scene.order) {
          refScene = scenesCopy.find(s => s.order === scene.continuationReferenceId);
        } else {
          const idx = scenesCopy.findIndex(s => s.id === scene.id);
          if (idx > 0) refScene = scenesCopy[idx - 1];
        }
        if (refScene && !visited.has(refScene.id)) visit(refScene);
      }
      visited.add(scene.id);
      ordered.push(scene);
    };

    scenesCopy.forEach(visit);

    generateAllImagesInSequence(
      ordered,
      setIsGeneratingAllScenes,
      (id) => handleGenerateSceneImage(Number(id)),
      (item) => {
        const scene = item as Scene;
        return `cena ${scene.scene_id}-${scene.sub_id}`;
      },
      'imagem de cena'
    );
  }, [scenes, handleGenerateSceneImage, generateAllImagesInSequence]);

  return {
    isGeneratingAllChars,
    setIsGeneratingAllChars,
    isGeneratingAllScenes,
    setIsGeneratingAllScenes,
    batchProgress,
    setBatchProgress,
    generateAllImagesInSequence,
    handleGenerateAllCharacterImages,
    handleGenerateAllSceneImages,
  };
}
