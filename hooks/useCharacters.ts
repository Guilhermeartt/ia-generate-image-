import { useState, useCallback } from 'react';
import type { Character, CharacterImageVersion, ImageModel, AppSettings } from '../types';
import { generateSceneImage, generateImage, isolateCharacter, generateCharacters } from '../services/geminiService';
import type { StyleOption } from '../components/StyleSelectionModal';
import { applyPromptStyle } from '../utils/stylePrompt';

export const MAX_CHARACTER_IMAGE_HISTORY = 12;
export const CHARACTER_IMAGE_SAFETY_GUARD = `\n\nRestrição obrigatória para retrato de personagem: gere apenas uma imagem fotográfica do personagem. Não inclua texto, letras, números, legendas, logotipos, marcas, gráficos, diagramas, infográficos, telas, janelas, botões, cards, painéis, interfaces, mockups, elementos de aplicativo, HUD, UI ou GUI. Não criar pôster, ficha de personagem, capa, layout editorial ou composição com texto.`;

export const withCharacterImageSafetyGuard = (prompt: string): string => {
  const normalized = prompt.toLowerCase();
  if (normalized.includes('não inclua texto') && (normalized.includes('gui') || normalized.includes('interface'))) {
    return prompt;
  }
  return `${prompt}${CHARACTER_IMAGE_SAFETY_GUARD}`;
};

interface UseCharactersParams {
  characterImageModel: ImageModel;
  generalContext: string;
  resolution: '1K' | '2K' | '4K';
  globalStyle: StyleOption | null;
  settings: AppSettings;
  getImageDimensions: (base64Url: string) => Promise<{ width: number; height: number }>;
  file: File | null;
}

export function useCharacters({
  characterImageModel,
  generalContext,
  resolution,
  globalStyle,
  settings,
  getImageDimensions,
  file,
}: UseCharactersParams) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isReloadingChars, setIsReloadingChars] = useState(false);

  const createCharacterImageVersion = useCallback(
    (character: Character, label = 'Versão anterior'): CharacterImageVersion | null => {
      if (!character.imageUrl || !character.imageMimeType) return null;
      return {
        id: `char-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        imageUrl: character.imageUrl,
        imageMimeType: character.imageMimeType,
        imageWidth: character.imageWidth,
        imageHeight: character.imageHeight,
        tokens: character.tokens,
        costBRL: character.costBRL,
        modelUsed: character.modelUsed,
        createdAt: Date.now(),
        label,
      };
    },
    []
  );

  const pushCurrentCharacterImageToHistory = useCallback(
    (character: Character, label?: string): CharacterImageVersion[] => {
      const currentVersion = createCharacterImageVersion(character, label);
      const existing = character.imageHistory || [];
      if (!currentVersion) return existing;
      return [
        currentVersion,
        ...existing.filter(item => item.imageUrl !== currentVersion.imageUrl),
      ].slice(0, MAX_CHARACTER_IMAGE_HISTORY);
    },
    [createCharacterImageVersion]
  );

  const handleGenerateCharacterImage = useCallback(
    async (characterName: string) => {
      const character = characters.find(c => c.name === characterName);
      if (!character) return;

      setCharacters(prev =>
        prev.map(c => c.name === characterName ? { ...c, isLoading: true, error: undefined } : c)
      );
      try {
        const characterAspectRatio = '1:1';

        const basePrompt = applyPromptStyle(character.image_prompt, globalStyle);
        const prompt = withCharacterImageSafetyGuard(basePrompt);

        const modelToUse: string =
          characterImageModel === 'gemini-3-pro-image-preview' ? 'gemini-3-pro-image-preview'
          : characterImageModel === 'gemini-3.1-flash-image-preview' ? 'gemini-3.1-flash-image-preview'
          : characterImageModel === 'imagen-4.0-generate-001' ? 'imagen-4.0-generate-001'
          : 'gemini-2.5-flash-image';

        const { base64Data, mimeType, tokens, costBRL } =
          modelToUse === 'imagen-4.0-generate-001'
            ? await generateImage(prompt, characterImageModel, characterAspectRatio, 1, generalContext, resolution, 'contain')
            : await generateSceneImage(
                prompt, [], characterAspectRatio, generalContext, undefined, modelToUse, resolution, undefined, undefined, 'contain'
              );
        const imageUrl = `data:${mimeType};base64,${base64Data}`;
        const { width, height } = await getImageDimensions(imageUrl);

        const charWithImage = {
          ...character,
          imageUrl,
          imageMimeType: mimeType,
          isLoading: false,
          imageWidth: width,
          imageHeight: height,
          tokens,
          costBRL,
          modelUsed: modelToUse,
          previousImageUrl: character.imageUrl,
          previousImageMimeType: character.imageMimeType,
          imageHistory: pushCurrentCharacterImageToHistory(character, 'Antes da nova geração'),
        };

        setCharacters(prev => prev.map(c => c.name === characterName ? charWithImage : c));
      } catch (e: any) {
        console.error(`Failed to generate image for ${character.name}`, e);
        const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
        setCharacters(prev =>
          prev.map(c => c.name === characterName ? { ...c, isLoading: false, error: errorMessage } : c)
        );
      }
    },
    [characters, characterImageModel, generalContext, resolution, globalStyle, getImageDimensions, pushCurrentCharacterImageToHistory]
  );

  const handleIsolateCharacter = useCallback(
    async (name: string) => {
      const character = characters.find(c => c.name === name);
      if (!character || !character.imageUrl) return;

      setCharacters(prev =>
        prev.map(c => c.name === name ? { ...c, isIsolating: true, error: undefined } : c)
      );
      try {
        const { base64Data, mimeType, tokens, costBRL } = await isolateCharacter(character.imageUrl);
        const imageUrl = `data:${mimeType};base64,${base64Data}`;
        const { width, height } = await getImageDimensions(imageUrl);

        const updatedChar = {
          ...character,
          imageUrl,
          imageMimeType: mimeType,
          isIsolating: false,
          imageWidth: width,
          imageHeight: height,
          tokens,
          costBRL,
          modelUsed: 'gemini-2.5-flash-image',
          previousImageUrl: character.imageUrl,
          previousImageMimeType: character.imageMimeType,
          imageHistory: pushCurrentCharacterImageToHistory(character, 'Antes do isolamento'),
        };

        setCharacters(prev => prev.map(c => c.name === name ? updatedChar : c));
      } catch (e: any) {
        console.error(`Failed to isolate character ${name}`, e);
        const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
        setCharacters(prev =>
          prev.map(c => c.name === name ? { ...c, isIsolating: false, error: errorMessage } : c)
        );
      }
    },
    [characters, getImageDimensions, pushCurrentCharacterImageToHistory]
  );

  const handleCharacterDescriptionChange = useCallback((name: string, newDescription: string) => {
    setCharacters(prev => prev.map(c => c.name === name ? { ...c, physical_characteristics: newDescription } : c));
  }, []);

  const handleCharacterPromptChange = useCallback((name: string, newPrompt: string) => {
    setCharacters(prev => prev.map(c => c.name === name ? { ...c, image_prompt: newPrompt } : c));
  }, []);

  const handleCharacterImageUpdate = useCallback(
    async (name: string, newImageUrl: string, newMimeType: string) => {
      try {
        const { width, height } = await getImageDimensions(newImageUrl);
        setCharacters(prev =>
          prev.map(c => {
            if (c.name === name) {
              return {
                ...c,
                previousImageUrl: c.imageUrl,
                previousImageMimeType: c.imageMimeType,
                imageHistory: pushCurrentCharacterImageToHistory(c, 'Antes da edição manual'),
                imageUrl: newImageUrl,
                imageMimeType: newMimeType,
                imageWidth: width,
                imageHeight: height,
                tokens: undefined,
                costBRL: undefined,
                modelUsed: 'upload/edição',
              };
            }
            return c;
          })
        );
      } catch (e) {
        console.error('Failed to get image dimensions for updated character image', e);
      }
    },
    [getImageDimensions, pushCurrentCharacterImageToHistory]
  );

  const handleRevertCharacterImage = useCallback((name: string) => {
    setCharacters(prev =>
      prev.map(c => {
        const latestHistory = c.imageHistory?.[0];
        if (c.name === name && latestHistory) {
          return {
            ...c,
            imageUrl: latestHistory.imageUrl,
            imageMimeType: latestHistory.imageMimeType,
            imageWidth: latestHistory.imageWidth,
            imageHeight: latestHistory.imageHeight,
            tokens: latestHistory.tokens,
            costBRL: latestHistory.costBRL,
            modelUsed: latestHistory.modelUsed,
            previousImageUrl: c.imageUrl,
            previousImageMimeType: c.imageMimeType,
            imageHistory: [
              ...pushCurrentCharacterImageToHistory(c, 'Antes da troca'),
              ...(c.imageHistory || []).slice(1),
            ]
              .filter((item, index, arr) => arr.findIndex(candidate => candidate.imageUrl === item.imageUrl) === index)
              .filter(item => item.id !== latestHistory.id)
              .slice(0, MAX_CHARACTER_IMAGE_HISTORY),
          };
        }
        if (c.name === name && c.previousImageUrl) {
          return {
            ...c,
            imageUrl: c.previousImageUrl,
            imageMimeType: c.previousImageMimeType,
            previousImageUrl: c.imageUrl,
            previousImageMimeType: c.imageMimeType,
          };
        }
        return c;
      })
    );
  }, [pushCurrentCharacterImageToHistory]);

  const handleSelectCharacterImageVersion = useCallback((name: string, versionId: string) => {
    setCharacters(prev =>
      prev.map(c => {
        if (c.name !== name) return c;
        const selected = (c.imageHistory || []).find(item => item.id === versionId);
        if (!selected) return c;

        const currentVersion = createCharacterImageVersion(c, 'Antes da troca');
        const nextHistory = [
          ...(currentVersion ? [currentVersion] : []),
          ...(c.imageHistory || []).filter(item => item.id !== versionId),
        ]
          .filter((item, index, arr) => arr.findIndex(candidate => candidate.imageUrl === item.imageUrl) === index)
          .slice(0, MAX_CHARACTER_IMAGE_HISTORY);

        return {
          ...c,
          imageUrl: selected.imageUrl,
          imageMimeType: selected.imageMimeType,
          imageWidth: selected.imageWidth,
          imageHeight: selected.imageHeight,
          tokens: selected.tokens,
          costBRL: selected.costBRL,
          modelUsed: selected.modelUsed,
          previousImageUrl: c.imageUrl,
          previousImageMimeType: c.imageMimeType,
          imageHistory: nextHistory,
        };
      })
    );
  }, [createCharacterImageVersion]);

  const handleReloadCharacters = useCallback(async () => {
    if (!file) return;

    setIsReloadingChars(true);
    try {
      const text = await file.text();
      const newCharsRaw = await generateCharacters(text, settings.characterGenerationPrompt);

      const newCharacterList = newCharsRaw.map(newCharInfo => {
        const existingChar = characters.find(c => c.name === newCharInfo.name);
        const newImagePrompt = settings.characterImagePrompt.replace(
          '{physical_characteristics}',
          newCharInfo.physical_characteristics
        );

        const baseNewChar = {
          ...newCharInfo,
          image_prompt: newImagePrompt,
        };

        if (existingChar) {
          return {
            ...baseNewChar,
            imageUrl: existingChar.imageUrl,
            imageMimeType: existingChar.imageMimeType,
            imageWidth: existingChar.imageWidth,
            imageHeight: existingChar.imageHeight,
            isLoading: existingChar.isLoading,
            error: existingChar.error,
            previousImageUrl: existingChar.previousImageUrl,
            previousImageMimeType: existingChar.previousImageMimeType,
            imageHistory: existingChar.imageHistory,
          };
        }

        return baseNewChar;
      });

      setCharacters(newCharacterList);
    } catch (e: any) {
      console.error('Failed to reload characters', e);
      throw e;
    } finally {
      setIsReloadingChars(false);
    }
  }, [file, settings.characterGenerationPrompt, settings.characterImagePrompt, characters]);

  return {
    characters,
    setCharacters,
    isReloadingChars,
    createCharacterImageVersion,
    pushCurrentCharacterImageToHistory,
    handleGenerateCharacterImage,
    handleIsolateCharacter,
    handleCharacterDescriptionChange,
    handleCharacterPromptChange,
    handleCharacterImageUpdate,
    handleRevertCharacterImage,
    handleSelectCharacterImageVersion,
    handleReloadCharacters,
  };
}
