import { useState, useCallback, type ChangeEvent } from 'react';
import type { Character, Scene, ImageModel, ProjectState } from '../types';
import type { AppView } from '../config/views';
import { saveCloudProject, type CurrentUser } from '../services/saasService';
import { SHOT_TYPE_OPTIONS } from '../utils/promptModules';

declare const JSZip: any;

const PREDEFINED_STYLES = [...SHOT_TYPE_OPTIONS];

interface UseProjectIOParams {
  file: File | null;
  characters: Character[];
  scenes: Scene[];
  generalContext: string;
  imageModel: ImageModel;
  characterImageModel: ImageModel;
  aspectRatio: string;
  numberOfImages: number;
  resolution: '1K' | '2K' | '4K';
  currentUser: CurrentUser | null;
  cloudProjectId: string | null;
  setCloudProjectId: (id: string | null) => void;
  setError: (error: string | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  resetState: () => void;
  setProcessingState: (state: string) => void;
  setProcessingMessage: (msg: string) => void;
  setGeneralContext: (ctx: string) => void;
  setCharacters: (chars: Character[]) => void;
  setScenes: (scenes: Scene[]) => void;
  setImageModel: (model: ImageModel) => void;
  setCharacterImageModel: (model: ImageModel) => void;
  setAspectRatio: (ratio: string) => void;
  setNumberOfImages: (n: number) => void;
  setResolution: (r: '1K' | '2K' | '4K') => void;
  setSelectedPresetId: (id: string) => void;
  setFile: (f: File | null) => void;
  setAvailableStyles: (styles: string[]) => void;
  setActiveView: (view: AppView) => void;
  setIsAuthOpen: (open: boolean) => void;
  getImageDimensions: (base64Url: string) => Promise<{ width: number; height: number }>;
}

export function useProjectIO({
  file,
  characters,
  scenes,
  generalContext,
  imageModel,
  characterImageModel,
  aspectRatio,
  numberOfImages,
  resolution,
  currentUser,
  cloudProjectId,
  setCloudProjectId,
  setError,
  showToast,
  resetState,
  setProcessingState,
  setProcessingMessage,
  setGeneralContext,
  setCharacters,
  setScenes,
  setImageModel,
  setCharacterImageModel,
  setAspectRatio,
  setNumberOfImages,
  setResolution,
  setSelectedPresetId,
  setFile,
  setAvailableStyles,
  setActiveView,
  setIsAuthOpen,
  getImageDimensions,
}: UseProjectIOParams) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [cloudSaveStatus, setCloudSaveStatus] = useState<string>('');

  const getMimeTypeFromFileName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'webp': return 'image/webp';
      default: return 'application/octet-stream';
    }
  };

  const handleExportProject = useCallback(async () => {
    if (typeof JSZip === 'undefined') {
      setError('Não foi possível iniciar o download. A biblioteca JSZip está ausente.');
      return;
    }
    if (!file) {
      setError('Nenhum arquivo de roteiro carregado para associar ao projeto.');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      const zip = new JSZip();

      const charactersWithPaths = characters.map(item => {
        const newItem = { ...item };

        if (item.imageUrl && item.imageMimeType) {
          const extension = item.imageMimeType.split('/')[1] || 'png';
          const name = item.name;
          const fileName = `personagens/${name.replace(/[/\\?%*:|"<> ]/g, '_')}.${extension}`;
          const base64Data = item.imageUrl.split(',')[1];
          zip.file(fileName, base64Data, { base64: true });
          newItem.imageUrl = fileName;
        }

        if (item.previousImageUrl && item.previousImageMimeType) {
          const extension = item.previousImageMimeType.split('/')[1] || 'png';
          const name = item.name;
          const fileName = `personagens/${name.replace(/[/\\?%*:|"<> ]/g, '_')}_prev.${extension}`;
          const base64Data = item.previousImageUrl.split(',')[1];
          zip.file(fileName, base64Data, { base64: true });
          newItem.previousImageUrl = fileName;
        }

        if (item.imageHistory && item.imageHistory.length > 0) {
          newItem.imageHistory = item.imageHistory.map((version, idx) => {
            const newVersion = { ...version };
            if (version.imageUrl && version.imageMimeType) {
              const extension = version.imageMimeType.split('/')[1] || 'png';
              const name = item.name;
              const fileName = `personagens/${name.replace(/[/\\?%*:|"<> ]/g, '_')}_versao_${idx + 1}.${extension}`;
              const base64Data = version.imageUrl.split(',')[1];
              zip.file(fileName, base64Data, { base64: true });
              newVersion.imageUrl = fileName;
            }
            return newVersion;
          });
        }

        return newItem;
      });

      const scenesWithPaths = scenes.map(item => {
        const newItem = { ...item };
        const sceneFolderName = `Cena_${item.scene_id}`;

        if (item.imageUrl && item.imageMimeType) {
          const extension = item.imageMimeType.split('/')[1] || 'png';
          const imageName = `Img ${item.order}`;
          const fileName = `cenas/${sceneFolderName}/${imageName.replace(/[/\\?%*:|"<> ]/g, '_')}.${extension}`;
          const base64Data = item.imageUrl.split(',')[1];
          zip.file(fileName, base64Data, { base64: true });
          newItem.imageUrl = fileName;
        }

        if (item.previousImageUrl && item.previousImageMimeType) {
          const extension = item.previousImageMimeType.split('/')[1] || 'png';
          const imageName = `Img ${item.order}_prev`;
          const fileName = `cenas/${sceneFolderName}/${imageName.replace(/[/\\?%*:|"<> ]/g, '_')}.${extension}`;
          const base64Data = item.previousImageUrl.split(',')[1];
          zip.file(fileName, base64Data, { base64: true });
          newItem.previousImageUrl = fileName;
        }

        if (item.endFrameUrl && item.endFrameMimeType) {
          const extension = item.endFrameMimeType.split('/')[1] || 'png';
          const imageName = `Img ${item.order}_end_frame`;
          const fileName = `cenas/${sceneFolderName}/${imageName.replace(/[/\\?%*:|"<> ]/g, '_')}.${extension}`;
          const base64Data = item.endFrameUrl.split(',')[1];
          zip.file(fileName, base64Data, { base64: true });
          newItem.endFrameUrl = fileName;
        }

        if (item.splitImages && item.splitImages.length > 0) {
          newItem.splitImages = item.splitImages.map((img, idx) => {
            const newImg = { ...img };
            if (img.imageUrl && img.imageMimeType) {
              const extension = img.imageMimeType.split('/')[1] || 'png';
              const fileName = `cenas/${sceneFolderName}/plano_${idx + 1}.${extension}`;
              const base64Data = img.imageUrl.split(',')[1];
              zip.file(fileName, base64Data, { base64: true });
              newImg.imageUrl = fileName;
            }
            return newImg;
          });
        }

        return newItem;
      });

      const projectState: ProjectState = {
        version: 1,
        fileName: file.name,
        generalContext,
        characters: charactersWithPaths as Character[],
        scenes: scenesWithPaths as Scene[],
        settings: {
          imageModel,
          characterImageModel,
          aspectRatio,
          numberOfImages,
          resolution,
        },
      };

      zip.file('project.json', JSON.stringify(projectState, null, 2));

      const content = await zip.generateAsync({ type: 'blob' });
      const safeFileName = file.name.replace('.csv', '').replace(/[^a-z0-9]/gi, '_');

      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${safeFileName}_projeto.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      showToast('Projeto exportado com sucesso!', 'success');
    } catch (e: any) {
      console.error('Failed to create zip file', e);
      setError(e.message || 'Ocorreu um erro desconhecido durante o processo de exportação.');
      showToast('Erro ao exportar projeto.', 'error');
    } finally {
      setIsDownloading(false);
    }
  }, [file, characters, scenes, generalContext, imageModel, characterImageModel, aspectRatio, numberOfImages, resolution, showToast, setError]);

  const handleSaveProjectToCloud = useCallback(async () => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }
    if (!file) {
      setError('Nenhum projeto carregado para salvar.');
      return;
    }

    setCloudSaveStatus('Salvando...');
    try {
      const projectState: ProjectState = {
        version: 1,
        fileName: file.name,
        generalContext,
        characters,
        scenes,
        settings: {
          imageModel,
          characterImageModel,
          aspectRatio,
          numberOfImages,
          resolution,
        },
      };
      const saved = await saveCloudProject(cloudProjectId, projectState);
      setCloudProjectId(saved.id);
      setCloudSaveStatus('Salvo na nuvem');
      setTimeout(() => setCloudSaveStatus(''), 2500);
      showToast('Projeto salvo na nuvem!', 'success');
    } catch (e) {
      setCloudSaveStatus('');
      setError(e instanceof Error ? e.message : 'Falha ao salvar projeto na nuvem.');
      showToast('Erro ao salvar na nuvem.', 'error');
    }
  }, [
    currentUser,
    file,
    generalContext,
    characters,
    scenes,
    imageModel,
    characterImageModel,
    aspectRatio,
    numberOfImages,
    resolution,
    cloudProjectId,
    showToast,
    setError,
    setIsAuthOpen,
    setCloudProjectId,
  ]);

  const handleImportProject = useCallback(
    async (projectFile: File) => {
      if (typeof JSZip === 'undefined') {
        setError('A biblioteca JSZip é necessária para importar projetos.');
        return;
      }
      resetState();
      setProcessingState('parsing');
      setProcessingMessage('Importando projeto...');

      try {
        const zip = await JSZip.loadAsync(projectFile);
        const projectJsonFile = zip.file('project.json');
        if (!projectJsonFile) {
          throw new Error("Arquivo de projeto 'project.json' não encontrado no .zip.");
        }
        const projectJsonContent = await projectJsonFile.async('string');
        const projectState: ProjectState = JSON.parse(projectJsonContent);

        if (projectState.version !== 1) {
          throw new Error(
            `Versão do projeto não suportada. Esperado: 1, Encontrado: ${projectState.version}`
          );
        }

        const loadImageFromZip = async (
          path: string | undefined
        ): Promise<{ url: string; mime: string; width: number; height: number } | undefined> => {
          if (!path || !zip.file(path)) return undefined;
          const zipFile = zip.file(path)!;
          const base64 = await zipFile.async('base64');
          const mime = getMimeTypeFromFileName(path);
          const url = `data:${mime};base64,${base64}`;
          try {
            const { width, height } = await getImageDimensions(url);
            return { url, mime, width, height };
          } catch (e) {
            console.warn(`Could not get dimensions for image ${path}, skipping dimensions.`, e);
            return { url, mime, width: 0, height: 0 };
          }
        };

        const loadedCharacters = await Promise.all(
          projectState.characters.map(async char => {
            const mainImage = await loadImageFromZip(char.imageUrl);
            const prevImage = await loadImageFromZip(char.previousImageUrl);
            const loadedHistory =
              char.imageHistory && char.imageHistory.length > 0
                ? await Promise.all(
                    char.imageHistory.map(async version => {
                      const loaded = await loadImageFromZip(version.imageUrl);
                      return {
                        ...version,
                        imageUrl: loaded?.url || version.imageUrl,
                        imageMimeType: loaded?.mime || version.imageMimeType,
                        imageWidth: loaded?.width || version.imageWidth,
                        imageHeight: loaded?.height || version.imageHeight,
                      };
                    })
                  )
                : undefined;
            return {
              ...char,
              imageUrl: mainImage?.url,
              imageMimeType: mainImage?.mime,
              imageWidth: mainImage?.width,
              imageHeight: mainImage?.height,
              previousImageUrl: prevImage?.url,
              previousImageMimeType: prevImage?.mime,
              imageHistory: loadedHistory,
            };
          })
        );

        const loadedScenes = await Promise.all(
          projectState.scenes.map(async scene => {
            const mainImage = await loadImageFromZip(scene.imageUrl);
            const prevImage = await loadImageFromZip(scene.previousImageUrl);
            const endFrame = await loadImageFromZip(scene.endFrameUrl);

            const loadedSplitImages =
              scene.splitImages && scene.splitImages.length > 0
                ? await Promise.all(
                    scene.splitImages.map(async img => {
                      if (!img.imageUrl) return img;
                      const loaded = await loadImageFromZip(img.imageUrl);
                      return {
                        ...img,
                        imageUrl: loaded?.url,
                        imageMimeType: loaded?.mime,
                      };
                    })
                  )
                : scene.splitImages;

            return {
              ...scene,
              imageUrl: mainImage?.url,
              imageMimeType: mainImage?.mime,
              imageWidth: mainImage?.width,
              imageHeight: mainImage?.height,
              previousImageUrl: prevImage?.url,
              previousImageMimeType: prevImage?.mime,
              endFrameUrl: endFrame?.url,
              endFrameMimeType: endFrame?.mime,
              endFrameWidth: endFrame?.width,
              endFrameHeight: endFrame?.height,
              splitImages: loadedSplitImages,
            };
          })
        );

        const stylesFromScenes = loadedScenes
          .map(s => s.style)
          .filter(style => style && style.trim() !== '');
        const uniqueStyles = [...new Set([...PREDEFINED_STYLES, ...stylesFromScenes])];
        setAvailableStyles(uniqueStyles);

        setGeneralContext(projectState.generalContext);
        setCharacters(loadedCharacters as Character[]);
        setScenes(loadedScenes as Scene[]);
        setImageModel(projectState.settings.imageModel);
        setCharacterImageModel(projectState.settings.characterImageModel);
        setAspectRatio(projectState.settings.aspectRatio);
        setNumberOfImages(projectState.settings.numberOfImages);
        setResolution(projectState.settings.resolution || '1K');
        setSelectedPresetId('custom');
        setFile(new File([], projectState.fileName, { type: 'text/csv' }));

        setProcessingState('done');
        setProcessingMessage('');
        showToast('Projeto importado com sucesso!', 'success');
      } catch (e: any) {
        console.error('Failed to import project', e);
        setError(`Falha ao importar projeto: ${e.message || 'Erro desconhecido.'}`);
        setProcessingState('error');
        showToast('Erro ao importar projeto.', 'error');
      }
    },
    [
      resetState,
      showToast,
      setError,
      setProcessingState,
      setProcessingMessage,
      setGeneralContext,
      setCharacters,
      setScenes,
      setImageModel,
      setCharacterImageModel,
      setAspectRatio,
      setNumberOfImages,
      setResolution,
      setSelectedPresetId,
      setFile,
      setAvailableStyles,
      getImageDimensions,
    ]
  );

  const handleProjectFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleImportProject(selectedFile);
      }
      if (e.target) e.target.value = '';
    },
    [handleImportProject]
  );

  const handleLoadCloudProject = useCallback(
    (projectId: string, projectState: ProjectState) => {
      if (projectState.version !== 1) {
        setError(
          `Versão do projeto não suportada. Esperado: 1, Encontrado: ${projectState.version}`
        );
        return;
      }

      resetState();
      const stylesFromScenes = projectState.scenes
        .map(s => s.style)
        .filter(style => style && style.trim() !== '');
      const uniqueStyles = [...new Set([...PREDEFINED_STYLES, ...stylesFromScenes])];
      setAvailableStyles(uniqueStyles);
      setGeneralContext(projectState.generalContext);
      setCharacters(projectState.characters);
      setScenes(projectState.scenes);
      setImageModel(projectState.settings.imageModel);
      setCharacterImageModel(projectState.settings.characterImageModel);
      setAspectRatio(projectState.settings.aspectRatio);
      setNumberOfImages(projectState.settings.numberOfImages);
      setResolution(projectState.settings.resolution || '1K');
      setSelectedPresetId('custom');
      setFile(new File([], projectState.fileName, { type: 'text/csv' }));
      setCloudProjectId(projectId);
      setProcessingState('done');
      setProcessingMessage('');
      setActiveView('characters');
    },
    [
      resetState,
      setError,
      setAvailableStyles,
      setGeneralContext,
      setCharacters,
      setScenes,
      setImageModel,
      setCharacterImageModel,
      setAspectRatio,
      setNumberOfImages,
      setResolution,
      setSelectedPresetId,
      setFile,
      setCloudProjectId,
      setProcessingState,
      setProcessingMessage,
      setActiveView,
    ]
  );

  return {
    isDownloading,
    cloudSaveStatus,
    getMimeTypeFromFileName,
    handleExportProject,
    handleImportProject,
    handleProjectFileChange,
    handleLoadCloudProject,
    handleSaveProjectToCloud,
  };
}
