import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Character, Scene, CsvRow, ImageModel, SavedAnalysis, AppSettings, ProjectState, TextAnalysisResult, AnalysisModalState, ImageRegion, GenerationSettings, SettingsPreset, TextCostEntry } from './types';
import FileUpload from './components/FileUpload';
import Loader from './components/Loader';
import CharacterCard from './components/CharacterCard';
import SceneCard from './components/SceneCard';
import HistoryLoader from './components/HistoryLoader';
import SettingsModal from './components/SettingsModal';
import TextAnalysisModal from './components/TextAnalysisModal';
import ImageRegionSelectorModal from './components/ImageRegionSelectorModal';
import { useSettings } from './hooks/useSettings';
import {
  generateGeneralContext,
  generateCharacters,
  analyzeScene,
  generateImage,
  generateSceneImage,
  editImage,
  isolateCharacter,
  analyzeImageText,
  generateSplitPrompts,
  registerCostEmitter,
} from './services/geminiService';
import type { SplitImage } from './types';
import { SparklesIcon, ReloadIcon, ArchiveIcon, SettingsIcon, FolderOpenIcon, GalleryIcon, CostReportIcon } from './components/icons';
import ImagePreviewModal from './components/ImagePreviewModal';
import QuickAnalyzer from './components/QuickAnalyzer';
import ProjectGalleryModal, { ProjectImageItem } from './components/ProjectGalleryModal';
import CostReportView from './components/CostReportView';

/** Retorna um rótulo curto do modelo para exibição na interface. */
const modelLabel = (model: string): string => {
  switch (model) {
    case 'gemini-2.5-flash-image':         return 'Flash 2.5';
    case 'gemini-3.1-flash-image-preview': return 'Flash 3.1';
    case 'gemini-3-pro-image-preview':     return 'Pro 3';
    case 'imagen-4.0-generate-001':        return 'Imagen 4';
    default:                               return model.split('-')[0];
  }
};

type ProcessingState =
  | 'idle'
  | 'parsing'
  | 'context'
  | 'characters'
  | 'scenes'
  | 'done'
  | 'error';
  
declare const JSZip: any;

const HISTORY_KEY = 'scriptVisualizerHistory';
const PRESETS_KEY = 'generationSettingsPresets';

const PREDEFINED_STYLES = [
  'Close-up',
  'Medium Shot',
  'Wide Shot',
  'Panoramic Shot',
  'American Shot',
  'Detail Shot',
  'High-Angle Shot',
  'Low-Angle Shot',
];

type ActiveView = 'characters' | 'scenes' | 'costs';

interface BatchProgress {
  current: number;
  total: number;
  currentItemName: string;
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processingState, setProcessingState] =
    useState<ProcessingState>('idle');
  const [processingMessage, setProcessingMessage] = useState('');
  const [generalContext, setGeneralContext] = useState<string>('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imageModel, setImageModel] = useState<ImageModel>('gemini-2.5-flash-image');
  const [characterImageModel, setCharacterImageModel] = useState<ImageModel>('imagen-4.0-generate-001');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [numberOfImages, setNumberOfImages] = useState<number>(1);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isReloadingChars, setIsReloadingChars] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGeneratingAllChars, setIsGeneratingAllChars] = useState(false);
  const [isGeneratingAllScenes, setIsGeneratingAllScenes] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings, saveSettings, isLoaded } = useSettings();
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [analysisModalState, setAnalysisModalState] = useState<AnalysisModalState | null>(null);
  const [availableStyles, setAvailableStyles] = useState<string[]>([]);
  const [regionSelectorState, setRegionSelectorState] = useState<{ item: Character | Scene } | null>(null);
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
  const [activeView, setActiveView] = useState<ActiveView>('characters');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isGalleryEditing, setIsGalleryEditing] = useState(false);
  const [textCosts, setTextCosts] = useState<TextCostEntry[]>([]);

  const getImageDimensions = (base64Url: string): Promise<{ width: number; height: number; }> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = (err) => {
        console.error("Failed to load image for dimension check", err);
        reject(new Error("Não foi possível carregar a imagem para obter as dimensões."));
      };
      image.src = base64Url;
    });
  };

  useEffect(() => {
    try {
        const savedHistory = localStorage.getItem(HISTORY_KEY);
        if (savedHistory) {
            setHistory(JSON.parse(savedHistory));
        }
    } catch (e) {
        console.error("Failed to load history from localStorage", e);
        localStorage.removeItem(HISTORY_KEY);
    }

    try {
        const savedPresets = localStorage.getItem(PRESETS_KEY);
        if (savedPresets) {
            setPresets(JSON.parse(savedPresets));
        }
    } catch(e) {
        console.error("Failed to load presets from localStorage", e);
    }

    // Register cost emitter so every Gemini API text call is tracked
    registerCostEmitter(({ operation, model, inputTokens, outputTokens, costBRL }) => {
      setTextCosts(prev => [...prev, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        operation,
        model,
        inputTokens,
        outputTokens,
        costBRL,
        timestamp: Date.now(),
      }]);
    });
  }, []);

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    resetState();
  };

  const resetState = useCallback(() => {
    setProcessingState('idle');
    setGeneralContext('');
    setCharacters([]);
    setScenes([]);
    setError(null);
    setAvailableStyles([]);
    setActiveView('characters');
    setBatchProgress(null);
    setTextCosts([]);
  }, []);

  const parseCSV = (text: string): CsvRow[] => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error('O arquivo CSV deve ter um cabeçalho e pelo menos uma linha de dados.');
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    
    const sceneIdIndex = headers.indexOf('scene_id');
    const subIdIndex = headers.indexOf('sub_id');
    const orderIndex = headers.indexOf('order');
    const locIndex = headers.indexOf('loc');
    const contextIndex = headers.indexOf('context');
    const styleIndex = headers.indexOf('style'); // Optional column

    if ([sceneIdIndex, subIdIndex, orderIndex, locIndex, contextIndex].includes(-1)) {
      const missing = [];
      if (sceneIdIndex === -1) missing.push("'scene_id'");
      if (subIdIndex === -1) missing.push("'sub_id'");
      if (orderIndex === -1) missing.push("'order'");
      if (locIndex === -1) missing.push("'loc'");
      if (contextIndex === -1) missing.push("'context'");
      
      throw new Error(
        `Não foi possível encontrar as colunas necessárias. Cabeçalhos encontrados:\n${headers.join(', ')}\n` +
        `O CSV deve conter a(s) coluna(s) ${missing.join(', ')}. Verifique a ortografia e certifique-se de que o arquivo usa vírgula (,) ou ponto e vírgula (;) como delimitador.`
      );
    }

    const data: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(new RegExp(`${delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`));
      const row = {
        scene_id: (values[sceneIdIndex] || '').trim().replace(/^"|"$/g, ''),
        sub_id: (values[subIdIndex] || '').trim().replace(/^"|"$/g, ''),
        order: (values[orderIndex] || '').trim().replace(/^"|"$/g, ''),
        loc: (values[locIndex] || '').trim().replace(/^"|"$/g, ''),
        context: (values[contextIndex] || '').trim().replace(/^"|"$/g, ''),
        style: (styleIndex > -1 ? (values[styleIndex] || '') : '').trim().replace(/^"|"$/g, ''),
      };
      data.push(row);
    }
    return data;
  };

  const handleAnalyze = useCallback(async () => {
    if (!file || !isLoaded) { // Wait for settings to be loaded
      setError('Por favor, selecione um arquivo primeiro.');
      return;
    }
    resetState();
    setProcessingState('parsing');

    try {
      setProcessingMessage('Lendo e analisando o arquivo CSV...');
      const text = await file.text();
      const csvData = parseCSV(text);
      if (csvData.length === 0) {
        throw new Error("O arquivo CSV está vazio ou não contém linhas de dados válidas.");
      }
      
      const stylesFromCsv = csvData.map(row => row.style).filter(style => style && style.trim() !== '');
      const uniqueStyles = [...new Set([...PREDEFINED_STYLES, ...stylesFromCsv])];
      setAvailableStyles(uniqueStyles);
      
      setProcessingState('context');
      setProcessingMessage('Gerando contexto geral da história...');
      const context = await generateGeneralContext(text, settings.generalContextPrompt);
      setGeneralContext(context);

      setProcessingState('characters');
      setProcessingMessage('Extraindo personagens e personas com IA...');
      const initialCharsRaw = await generateCharacters(text, settings.characterGenerationPrompt);
      const initialChars = initialCharsRaw.map(char => ({
          ...char,
          image_prompt: settings.characterImagePrompt.replace('{physical_characteristics}', char.physical_characteristics)
      }));
      setCharacters(initialChars);

      setProcessingState('scenes');
      setProcessingMessage('Analisando cenas e criando prompts de imagem...');
      
      const extractNumberFromString = (value: string): number => {
        if (!value) return NaN;
        const match = value.match(/\d+/);
        if (match) {
          return parseInt(match[0], 10);
        }
        return NaN;
      };

      const analyzeContinuity = (contextText: string): { isContinuation: boolean; referenceId: number | null } => {
          if (!contextText || contextText.trim() === '') {
            return { isContinuation: false, referenceId: null };
          }
          
          // 1. Check for formal tag: [ref:123] or [ref:previous]
          const refTagRegex = /\[ref:(\d+|previous)\]/i;
          const tagMatch = contextText.match(refTagRegex);
    
          if (tagMatch) {
            const refValue = tagMatch[1];
            if (refValue.toLowerCase() === 'previous') {
              return { isContinuation: true, referenceId: null };
            } else {
              const id = parseInt(refValue, 10);
              if (!isNaN(id)) {
                return { isContinuation: true, referenceId: id };
              }
            }
          }

          // 2. Check for various natural language and simple tags
          const patterns: RegExp[] = [
              /(?:continuidade|continua(?:ç|c)ão) d(?:a|o) (?:img|imagem|cena)\s+(\d+)/i, // "continuidade da img 3"
              /\(img\s*(\d+)\)/i, // "(img 3)"
          ];

          for (const regex of patterns) {
              const match = contextText.match(regex);
              if (match && match[1]) {
                  const id = parseInt(match[1], 10);
                  if (!isNaN(id)) {
                      return { isContinuation: true, referenceId: id };
                  }
              }
          }
    
          return { isContinuation: false, referenceId: null };
      };

      const processedScenesPromises = csvData.map(async (row, index) => {
        const scene_id = extractNumberFromString(row.scene_id);
        const sub_id = extractNumberFromString(row.sub_id);
        const order = extractNumberFromString(row.order);

        if (isNaN(scene_id) || isNaN(sub_id) || isNaN(order)) {
          throw new Error(
            `Valor numérico inválido ou ausente no CSV na linha de dados ${index + 1} (linha da planilha ${index + 2}).\n` +
            `'scene_id', 'sub_id' e 'order' devem ser números. Podemos extrair números de texto (ex: "Cena 1"), mas um número deve estar presente.\n` +
            `Encontrado: scene_id='${row.scene_id}', sub_id='${row.sub_id}', order='${row.order}'`
          );
        }
        
        const continuity = analyzeContinuity(row.context);

        // Clean the description to remove continuity markers before sending to the analysis AI.
        const descriptionForAnalysis = row.context
          .replace(/\[ref:(\d+|previous)\]/i, '')
          .replace(/(?:continuidade|continua(?:ç|c)ão) d(?:a|o) (?:img|imagem|cena)\s*(\d+)/i, '')
          .replace(/\(img\s*(\d+)\)/i, '')
          .trim();

        const { tagged_description, image_prompt } = await analyzeScene(
          row.loc,
          descriptionForAnalysis, // Use cleaned description
          initialChars,
          row.style,
          settings.sceneAnalysisPrompt
        );
        return {
          id: index,
          scene_id: scene_id,
          sub_id: sub_id,
          order: order,
          original_location: row.loc,
          original_description: row.context,
          tagged_description,
          image_prompt,
          style: row.style,
          isContinuation: continuity.isContinuation,
          continuationReferenceId: continuity.referenceId,
        };
      });
      
      let processedScenes = await Promise.all(processedScenesPromises);
      
      processedScenes.sort((a, b) => {
        if (a.scene_id !== b.scene_id) {
          return a.scene_id - b.scene_id;
        }
        if (a.sub_id !== b.sub_id) {
          return a.sub_id - b.sub_id;
        }
        return a.order - b.order;
      });

      setScenes(processedScenes);

      setProcessingState('done');
      setProcessingMessage('');

      const newAnalysis: SavedAnalysis = {
        timestamp: Date.now(),
        fileName: file.name,
        generalContext: context,
        characters: initialChars,
        scenes: processedScenes,
      };

      setHistory(prevHistory => {
          const updatedHistory = [newAnalysis, ...prevHistory].slice(0, 2);
          try {
              localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
          } catch(e) {
              console.error("Failed to save history to localStorage", e);
          }
          return updatedHistory;
      });

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Ocorreu um erro desconhecido.');
      setProcessingState('error');
    }
  }, [file, settings, isLoaded, resetState]);
  
  const handleGenerateCharacterImage = useCallback(async (characterName: string) => {
    const character = characters.find(c => c.name === characterName);
    if (!character) return;

    setCharacters(prev => prev.map(c => c.name === characterName ? { ...c, isLoading: true, error: undefined } : c));
    try {
      const characterModel: ImageModel = characterImageModel;
      const characterAspectRatio = '16:9';
      
      const prompt = character.image_prompt;

      const { base64Data, mimeType, tokens, costBRL } = await generateImage(prompt, characterModel, characterAspectRatio, 1, generalContext, resolution);
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
        modelUsed: characterModel,
        previousImageUrl: character.imageUrl,
        previousImageMimeType: character.imageMimeType
      };

      setCharacters(prev => prev.map(c => c.name === characterName ? charWithImage : c));
    } catch (e: any) {
      console.error(`Failed to generate image for ${character.name}`, e);
      const errorMessage = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
      setCharacters(prev => prev.map(c => c.name === characterName ? { ...c, isLoading: false, error: errorMessage } : c));
    }
  }, [characters, characterImageModel, generalContext, resolution]);

  const handleIsolateCharacter = useCallback(async (name: string) => {
    const character = characters.find(c => c.name === name);
    if (!character || !character.imageUrl) return;

    setCharacters(prev => prev.map(c => c.name === name ? { ...c, isIsolating: true, error: undefined } : c));
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
        previousImageMimeType: character.imageMimeType
      };

      setCharacters(prev => prev.map(c => c.name === name ? updatedChar : c));
    } catch (e: any) {
      console.error(`Failed to isolate character ${name}`, e);
      const errorMessage = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
      setCharacters(prev => prev.map(c => c.name === name ? { ...c, isIsolating: false, error: errorMessage } : c));
    }
  }, [characters]);
  
  const generateImageForScene = async (
    targetScene: Scene,
    allScenes: Scene[],
    allCharacters: Character[]
  ): Promise<{ base64Data: string; mimeType: string; tokens?: number; costBRL?: number; }> => {
    let sceneReference: { name: string, base64Data: string, mimeType: string } | undefined = undefined;
    const sceneIndex = allScenes.findIndex(s => s.id === targetScene.id);
  
    if (targetScene.isContinuation) {
      let referenceScene: Scene | undefined;
  
      if (targetScene.continuationReferenceId) {
        // Prevent self-reference
        if (targetScene.continuationReferenceId !== targetScene.order) {
           referenceScene = allScenes.find(s => s.order === targetScene.continuationReferenceId && s.imageUrl);
        }
      } else if (sceneIndex > 0) {
        referenceScene = allScenes[sceneIndex - 1];
      }
  
      if (referenceScene && referenceScene.imageUrl && referenceScene.imageMimeType) {
        const parts = referenceScene.imageUrl.split(',');
        const base64Data = parts[1];
        sceneReference = { name: "scene_reference", base64Data, mimeType: referenceScene.imageMimeType };
      }
    }
  
    const characterNamesInScene = [...new Set((targetScene.tagged_description.match(/\[(.*?)\]/g) || [])
      .map(tag => tag.slice(1, -1)))];
  
    const characterReferences = allCharacters
      .filter(char => characterNamesInScene.includes(char.name) && char.imageUrl && char.imageMimeType)
      .map(char => {
        const parts = char.imageUrl!.split(',');
        const base64Data = parts[1];
        return { name: char.name, base64Data, mimeType: char.imageMimeType! };
      });
  
    const prompt = targetScene.image_prompt;
  
    if (characterReferences.length > 0 || sceneReference) {
      // Prioritize the user-selected model if it supports references.
      // Imagen 4 doesn't support multimodal input, so fall back to flash.
      let modelToUse: string = imageModel === 'gemini-3-pro-image-preview'
        ? 'gemini-3-pro-image-preview'
        : imageModel === 'gemini-3.1-flash-image-preview'
          ? 'gemini-3.1-flash-image-preview'
          : 'gemini-2.5-flash-image';

      return generateSceneImage(prompt, characterReferences, aspectRatio, generalContext, sceneReference, modelToUse, resolution);
    } else {
      return generateImage(prompt, imageModel, aspectRatio, numberOfImages, generalContext, resolution);
    }
  };

  const handleGenerateSceneImage = useCallback(async (sceneId: number) => {
    const scenesSnapshot = scenes;
    const originalScene = scenesSnapshot.find(s => s.id === sceneId);
    if (!originalScene) return;

    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: true, error: undefined } : s));

    try {
      if (originalScene.isContinuation) {
        const originalSceneIndex = scenesSnapshot.findIndex(s => s.id === sceneId);
        let referenceScene: Scene | undefined;
  
        if (originalScene.continuationReferenceId) {
            // Check for circular reference in data
            if (originalScene.continuationReferenceId === originalScene.order) {
                 console.warn(`Cena ${originalScene.id} tenta referenciar a si mesma (Ordem ${originalScene.order}). Ignorando referência.`);
            } else {
                 referenceScene = scenesSnapshot.find(s => s.order === originalScene.continuationReferenceId);
            }
        } else if (originalSceneIndex > 0) {
            referenceScene = scenesSnapshot[originalSceneIndex - 1];
        }
        
        // CORRECTION: Instead of throwing an error that blocks the entire queue, 
        // we fallback to generating without the reference if it's missing or has no image.
        if (referenceScene && !referenceScene.imageUrl) {
             const refName = originalScene.continuationReferenceId 
                ? `Ordem ${originalScene.continuationReferenceId}` 
                : 'anterior';
             console.warn(`A imagem da cena de referência (${refName}) para a cena ${originalScene.id} está ausente. Gerando sem referência.`);
             // Effectively disable continuation for this generation call only (handled implicitly by not passing the ref image in generateImageForScene)
        }
      }

      const { base64Data, mimeType, tokens, costBRL } = await generateImageForScene(originalScene, scenesSnapshot, characters);
      const newImageUrl = `data:${mimeType};base64,${base64Data}`;
      const { width, height } = await getImageDimensions(newImageUrl);

      setScenes(prev => prev.map(s => {
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
                  previousImageMimeType: s.imageMimeType
              };
          }
          return s;
      }));

    } catch (e: any) {
        console.error(`Falha ao gerar imagem para a cena ${originalScene.id}`, e);
        const errorMessage = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: false, error: errorMessage } : s));
    }
  }, [scenes, characters, aspectRatio, generalContext, imageModel, numberOfImages, resolution]);

  // "Gerar Novamente" com região de referência selecionada pelo usuário
  const handleGenerateSceneImageWithReference = useCallback(async (
    sceneId: number,
    overridePrompt: string,
    croppedBase64: string | null,
    croppedMimeType: string | null,
    extraReferences?: { base64Data: string; mimeType: string }[],
    blendInstruction?: string,
  ) => {
    const scenesSnapshot = scenes;
    const originalScene = scenesSnapshot.find(s => s.id === sceneId);
    if (!originalScene) return;

    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: true, error: undefined } : s));

    try {
      const characterNamesInScene = [...new Set((originalScene.tagged_description.match(/\[(.*?)\]/g) || [])
        .map((tag: string) => tag.slice(1, -1)))];

      const characterReferences = characters
        .filter(char => characterNamesInScene.includes(char.name) && char.imageUrl && char.imageMimeType)
        .map(char => {
          const parts = char.imageUrl!.split(',');
          return { name: char.name, base64Data: parts[1], mimeType: char.imageMimeType! };
        });

      // A região recortada pelo usuário vira a referência visual da cena
      const sceneReference = croppedBase64 && croppedMimeType
        ? { name: 'region_reference', base64Data: croppedBase64, mimeType: croppedMimeType }
        : undefined;

      let base64Data: string;
      let mimeType: string;
      let tokens: number | undefined;
      let costBRL: number | undefined;

      if (characterReferences.length > 0 || sceneReference) {
        const modelToUse = imageModel === 'gemini-3-pro-image-preview'
          ? 'gemini-3-pro-image-preview'
          : imageModel === 'gemini-3.1-flash-image-preview'
            ? 'gemini-3.1-flash-image-preview'
            : 'gemini-2.5-flash-image';
        const result = await generateSceneImage(
          overridePrompt, characterReferences, aspectRatio,
          generalContext, sceneReference, modelToUse, resolution,
          extraReferences, blendInstruction
        );
        base64Data = result.base64Data;
        mimeType = result.mimeType;
        tokens = result.tokens;
        costBRL = result.costBRL;
      } else {
        const result = await generateImage(overridePrompt, imageModel, aspectRatio, numberOfImages, generalContext, resolution);
        base64Data = result.base64Data;
        mimeType = result.mimeType;
        tokens = result.tokens;
        costBRL = result.costBRL;
      }

      const newImageUrl = `data:${mimeType};base64,${base64Data}`;
      const { width, height } = await getImageDimensions(newImageUrl);

      setScenes(prev => prev.map(s => {
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
          };
        }
        return s;
      }));
    } catch (e: any) {
      console.error(`Falha ao gerar imagem com referência para a cena ${sceneId}`, e);
      const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isLoading: false, error: errorMessage } : s));
    }
  }, [scenes, characters, aspectRatio, generalContext, imageModel, numberOfImages, resolution]);

  // Editar qualquer imagem do projeto (personagem ou cena, incluindo versão anterior)
  const handleEditProjectImage = useCallback(async (
    item: ProjectImageItem,
    sourceUrl: string,
    _sourceMimeType: string,
    prompt: string
  ) => {
    setIsGalleryEditing(true);
    try {
      const { base64Data, mimeType } = await editImage(sourceUrl, prompt, generalContext);
      const newImageUrl = `data:${mimeType};base64,${base64Data}`;
      const { width, height } = await getImageDimensions(newImageUrl);

      if (item.itemType === 'character') {
        setCharacters(prev => prev.map(c => {
          if (c.name === item.itemKey) {
            return {
              ...c,
              previousImageUrl: c.imageUrl,
              previousImageMimeType: c.imageMimeType,
              imageUrl: newImageUrl,
              imageMimeType: mimeType,
              imageWidth: width,
              imageHeight: height,
            };
          }
          return c;
        }));
      } else {
        setScenes(prev => prev.map(s => {
          if (s.id === item.itemKey) {
            return {
              ...s,
              previousImageUrl: s.imageUrl,
              previousImageMimeType: s.imageMimeType,
              imageUrl: newImageUrl,
              imageMimeType: mimeType,
              imageWidth: width,
              imageHeight: height,
            };
          }
          return s;
        }));
      }
    } finally {
      setIsGalleryEditing(false);
    }
  }, [generalContext]);

  const handleSplitScene = useCallback(async (sceneId: number, count: number, instructions: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Fase 1: gera os sub-prompts via IA
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isSplitting: true, splitImages: undefined } : s));

    let subPrompts: string[];
    try {
      subPrompts = await generateSplitPrompts(scene.image_prompt, generalContext, count, instructions);
    } catch (e: any) {
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isSplitting: false } : s));
      console.error('Falha ao gerar sub-prompts:', e);
      return;
    }

    // Fase 2: inicializa o array de split images com loading
    const initialSplitImages: SplitImage[] = subPrompts.map((prompt, i) => ({
      id: `${sceneId}-split-${Date.now()}-${i}`,
      prompt,
      isLoading: true,
    }));
    setScenes(prev => prev.map(s =>
      s.id === sceneId ? { ...s, isSplitting: false, splitImages: initialSplitImages } : s
    ));

    // Prepara referências de personagens da cena
    const characterNamesInScene = [...new Set((scene.tagged_description.match(/\[(.*?)\]/g) || [])
      .map((tag: string) => tag.slice(1, -1)))];
    const characterReferences = characters
      .filter(c => characterNamesInScene.includes(c.name) && c.imageUrl && c.imageMimeType)
      .map(c => ({ name: c.name, base64Data: c.imageUrl!.split(',')[1], mimeType: c.imageMimeType! }));

    // Fase 3: gera cada imagem individualmente
    for (let i = 0; i < subPrompts.length; i++) {
      try {
        let result: { base64Data: string; mimeType: string; tokens?: number; costBRL?: number };
        if (characterReferences.length > 0) {
          const modelToUse = imageModel === 'gemini-3-pro-image-preview'
            ? 'gemini-3-pro-image-preview'
            : imageModel === 'gemini-3.1-flash-image-preview'
              ? 'gemini-3.1-flash-image-preview'
              : 'gemini-2.5-flash-image';
          result = await generateSceneImage(subPrompts[i], characterReferences, aspectRatio, generalContext, undefined, modelToUse, resolution);
        } else {
          result = await generateImage(subPrompts[i], imageModel, aspectRatio, 1, generalContext, resolution);
        }
        const imageUrl = `data:${result.mimeType};base64,${result.base64Data}`;
        setScenes(prev => prev.map(s => {
          if (s.id !== sceneId) return s;
          const usedModel = characterReferences.length > 0
            ? (imageModel === 'gemini-3-pro-image-preview' ? 'gemini-3-pro-image-preview'
              : imageModel === 'gemini-3.1-flash-image-preview' ? 'gemini-3.1-flash-image-preview'
              : 'gemini-2.5-flash-image')
            : imageModel;
          const updated = (s.splitImages || []).map((img, idx) =>
            idx === i ? { ...img, imageUrl, imageMimeType: result.mimeType, isLoading: false, tokens: result.tokens, costBRL: result.costBRL, modelUsed: usedModel } : img
          );
          return { ...s, splitImages: updated };
        }));
      } catch (e: any) {
        const errorMessage = e instanceof Error ? e.message : 'Erro ao gerar imagem.';
        setScenes(prev => prev.map(s => {
          if (s.id !== sceneId) return s;
          const updated = (s.splitImages || []).map((img, idx) =>
            idx === i ? { ...img, isLoading: false, error: errorMessage } : img
          );
          return { ...s, splitImages: updated };
        }));
      }
    }
  }, [scenes, characters, aspectRatio, generalContext, imageModel, resolution]);

  const handleClearSplit = useCallback((sceneId: number) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, splitImages: undefined } : s));
  }, []);

  const handleCharacterDescriptionChange = useCallback((name: string, newDescription: string) => {
    setCharacters(prev => prev.map(c => c.name === name ? { ...c, physical_characteristics: newDescription } : c));
  }, []);

  const handleCharacterPromptChange = useCallback((name: string, newPrompt: string) => {
    setCharacters(prev => prev.map(c => c.name === name ? { ...c, image_prompt: newPrompt } : c));
  }, []);

  const handleScenePromptChange = useCallback((id: number, newPrompt: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, image_prompt: newPrompt } : s));
  }, []);
  
  const handleSceneStyleChange = useCallback((id: number, newStyle: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, style: newStyle } : s));
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

  const handleUpdateScenePrompt = useCallback(async (sceneId: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isUpdatingPrompt: true, error: undefined } : s));

    try {
        const { image_prompt } = await analyzeScene(
            scene.original_location,
            scene.original_description,
            characters,
            scene.style,
            settings.sceneAnalysisPrompt
        );
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, image_prompt, isUpdatingPrompt: false } : s));
    } catch (e: any) {
        console.error(`Failed to update prompt for scene ${sceneId}`, e);
        const errorMessage = e instanceof Error ? e.message : "Falha ao atualizar o prompt.";
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isUpdatingPrompt: false, error: errorMessage } : s));
    }
  }, [scenes, characters, settings.sceneAnalysisPrompt]);


  const handleCharacterImageUpdate = useCallback(async (name: string, newImageUrl: string, newMimeType: string) => {
    try {
      const { width, height } = await getImageDimensions(newImageUrl);
      setCharacters(prev => prev.map(c => {
        if (c.name === name) {
          return {
            ...c,
            previousImageUrl: c.imageUrl,
            previousImageMimeType: c.imageMimeType,
            imageUrl: newImageUrl,
            imageMimeType: newMimeType,
            imageWidth: width,
            imageHeight: height,
          };
        }
        return c;
      }));
    } catch (e) {
      console.error("Failed to get image dimensions for updated character image", e);
    }
  }, []);
  
  const handleSceneImageUpdate = useCallback(async (id: number, newImageUrl: string, newMimeType: string) => {
    try {
      const { width, height } = await getImageDimensions(newImageUrl);
      setScenes(prev => prev.map(s => {
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
      }));
    } catch (e) {
       console.error("Failed to get image dimensions for updated scene image", e);
    }
  }, []);
  
  const handleEditImageWrapper = useCallback(async (base64: string, prompt: string): Promise<{ base64Data: string; mimeType: string; }> => {
    return editImage(base64, prompt, generalContext);
  }, [generalContext]);
  
  const handleRevertCharacterImage = useCallback((name: string) => {
    setCharacters(prev => prev.map(c => {
        if (c.name === name && c.previousImageUrl) {
            return {
                ...c,
                imageUrl: c.previousImageUrl,
                imageMimeType: c.previousImageMimeType,
                previousImageUrl: c.imageUrl,
                previousImageMimeType: c.imageMimeType,
                // Note: width/height are not reverted, they belong to the current `imageUrl`.
                // This could be improved by also saving previous width/height. For now, this is acceptable.
            };
        }
        return c;
    }));
  }, []);

  const handleRevertSceneImage = useCallback((id: number) => {
    setScenes(prev => prev.map(s => {
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
    }));
  }, []);

  const handleReloadCharacters = useCallback(async () => {
    if (!file) {
      setError('Não é possível recarregar personagens sem um arquivo de origem.');
      return;
    }
    
    setIsReloadingChars(true);
    setError(null);
    
    try {
      const text = await file.text();
      const newCharsRaw = await generateCharacters(text, settings.characterGenerationPrompt);

      const newCharacterList = newCharsRaw.map(newCharInfo => {
        const existingChar = characters.find(c => c.name === newCharInfo.name);
        const newImagePrompt = settings.characterImagePrompt.replace('{physical_characteristics}', newCharInfo.physical_characteristics);
        
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
          };
        }
        
        return baseNewChar;
      });
      
      setCharacters(newCharacterList);

    } catch (e: any) {
      console.error('Failed to reload characters', e);
      setError(e.message || 'Falha ao recarregar personagens.');
    } finally {
      setIsReloadingChars(false);
    }
  }, [file, settings.characterGenerationPrompt, characters]);

  const handleImagePreview = useCallback((url: string) => {
    setPreviewImageUrl(url);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewImageUrl(null);
  }, []);

  const handleExportProject = useCallback(async () => {
      if (typeof JSZip === 'undefined') {
          setError("Não foi possível iniciar o download. A biblioteca JSZip está ausente.");
          return;
      }
      if (!file) {
          setError("Nenhum arquivo de roteiro carregado para associar ao projeto.");
          return;
      }

      setIsDownloading(true);
      setError(null);

      try {
          const zip = new JSZip();

          const charactersWithPaths = characters.map(item => {
              let newItem = { ...item };
              
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
              return newItem;
          });

          const scenesWithPaths = scenes.map(item => {
              let newItem = { ...item };
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

              // ── Planos divididos (split images) ──
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
            }
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

      } catch (e: any) {
          console.error("Failed to create zip file", e);
          setError(e.message || "Ocorreu um erro desconhecido durante o processo de exportação.");
      } finally {
          setIsDownloading(false);
      }
  }, [file, characters, scenes, generalContext, imageModel, characterImageModel, aspectRatio, numberOfImages, resolution]);
  
  const getMimeTypeFromFileName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'webp': return 'image/webp';
      default: return 'application/octet-stream';
    }
  }

  const handleImportProject = useCallback(async (projectFile: File) => {
    if (typeof JSZip === 'undefined') {
        setError("A biblioteca JSZip é necessária para importar projetos.");
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
          throw new Error(`Versão do projeto não suportada. Esperado: 1, Encontrado: ${projectState.version}`);
        }

        const loadImageFromZip = async (path: string | undefined): Promise<{url: string; mime: string; width: number; height: number;} | undefined> => {
            if (!path || !zip.file(path)) return undefined;
            const file = zip.file(path)!;
            const base64 = await file.async('base64');
            const mime = getMimeTypeFromFileName(path);
            const url = `data:${mime};base64,${base64}`;
            try {
                const { width, height } = await getImageDimensions(url);
                return { url, mime, width, height };
            } catch (e) {
                console.warn(`Could not get dimensions for image ${path}, skipping dimensions.`, e);
                // Return without dimensions if it fails
                return { url, mime, width: 0, height: 0 };
            }
        };

        const loadedCharacters = await Promise.all(projectState.characters.map(async (char) => {
            const mainImage = await loadImageFromZip(char.imageUrl);
            const prevImage = await loadImageFromZip(char.previousImageUrl);
            return {
                ...char,
                imageUrl: mainImage?.url,
                imageMimeType: mainImage?.mime,
                imageWidth: mainImage?.width,
                imageHeight: mainImage?.height,
                previousImageUrl: prevImage?.url,
                previousImageMimeType: prevImage?.mime,
            };
        }));
        
        const loadedScenes = await Promise.all(projectState.scenes.map(async (scene) => {
            const mainImage = await loadImageFromZip(scene.imageUrl);
            const prevImage = await loadImageFromZip(scene.previousImageUrl);

            // ── Restaura split images do zip ──
            const loadedSplitImages = scene.splitImages && scene.splitImages.length > 0
                ? await Promise.all(scene.splitImages.map(async (img) => {
                    if (!img.imageUrl) return img;
                    const loaded = await loadImageFromZip(img.imageUrl);
                    return {
                        ...img,
                        imageUrl: loaded?.url,
                        imageMimeType: loaded?.mime,
                    };
                }))
                : scene.splitImages;

            return {
                ...scene,
                imageUrl: mainImage?.url,
                imageMimeType: mainImage?.mime,
                imageWidth: mainImage?.width,
                imageHeight: mainImage?.height,
                previousImageUrl: prevImage?.url,
                previousImageMimeType: prevImage?.mime,
                splitImages: loadedSplitImages,
            };
        }));

        const stylesFromScenes = loadedScenes.map(s => s.style).filter(style => style && style.trim() !== '');
        const uniqueStyles = [...new Set([...PREDEFINED_STYLES, ...stylesFromScenes])];
        setAvailableStyles(uniqueStyles);

        setGeneralContext(projectState.generalContext);
        setCharacters(loadedCharacters);
        setScenes(loadedScenes);
        setImageModel(projectState.settings.imageModel);
        setCharacterImageModel(projectState.settings.characterImageModel);
        setAspectRatio(projectState.settings.aspectRatio);
        setNumberOfImages(projectState.settings.numberOfImages);
        setResolution(projectState.settings.resolution || '1K');
        setSelectedPresetId('custom');
        setFile(new File([], projectState.fileName, { type: 'text/csv' }));

        setProcessingState('done');
        setProcessingMessage('');
    } catch (e: any) {
        console.error("Failed to import project", e);
        setError(`Falha ao importar projeto: ${e.message || 'Erro desconhecido.'}`);
        setProcessingState('error');
    }
  }, [resetState]);
  
  const handleProjectFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        handleImportProject(selectedFile);
    }
    if(e.target) e.target.value = '';
  }, [handleImportProject]);
  
  const generateAllImagesInSequence = useCallback(async <T extends { name: string } | { id: number; scene_id?: number; sub_id?: number }>(
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
            currentItemName: logName
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
            // Se houve erro (possível 503/429), espera 30s para dar fôlego à API.
            // Se foi sucesso, espera 8s para ser mais ágil, mas ainda respeitando limites.
            const delay = hasError ? 30000 : 8000;
            if (hasError) console.log(`Erro detectado no lote. Pausando por ${delay/1000}s para recuperação da API...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    setLoading(false);
    setBatchProgress(null);
    console.log(`Finalizada a geração de todas as imagens de ${itemTypeName}.`);
  }, []);

  const handleGenerateAllCharacterImages = useCallback(() => {
    generateAllImagesInSequence(
      characters,
      setIsGeneratingAllChars,
      handleGenerateCharacterImage,
      (item) => (item as Character).name,
      'retrato'
    );
  }, [characters, handleGenerateCharacterImage, generateAllImagesInSequence]);

  const handleGenerateAllSceneImages = useCallback(() => {
    generateAllImagesInSequence(
      scenes,
      setIsGeneratingAllScenes,
      handleGenerateSceneImage,
      (item) => {
        const scene = item as Scene;
        return `cena ${scene.scene_id}-${scene.sub_id}`;
      },
      'imagem de cena'
    );
  }, [scenes, handleGenerateSceneImage, generateAllImagesInSequence]);

  const handleLoadFromHistory = useCallback((timestamp: number) => {
    const selectedAnalysis = history.find(h => h.timestamp === timestamp);
    if (selectedAnalysis) {
        setGeneralContext(selectedAnalysis.generalContext);
        setCharacters(selectedAnalysis.characters);
        setScenes(selectedAnalysis.scenes);
        setFile(new File([], selectedAnalysis.fileName, { type: 'text/csv' }));
        const stylesFromScenes = selectedAnalysis.scenes.map(s => s.style).filter(style => style && style.trim() !== '');
        const uniqueStyles = [...new Set([...PREDEFINED_STYLES, ...stylesFromScenes])];
        setAvailableStyles(uniqueStyles);
        setProcessingState('done');
        setActiveView('characters');
        setError(null);
    }
  }, [history]);

  const handleClearHistory = useCallback(() => {
    try {
        localStorage.removeItem(HISTORY_KEY);
        setHistory([]);
    } catch (e) {
        console.error("Failed to clear history from localStorage", e);
    }
  }, []);

  const handleSaveSettings = useCallback((newSettings: AppSettings) => {
    saveSettings(newSettings);
    setIsSettingsOpen(false);
  }, [saveSettings]);
  
  const handleStartTextAnalysis = useCallback((item: Character | Scene) => {
    if (!item.imageUrl) return;
    setRegionSelectorState({ item });
  }, []);

  const handleConfirmRegionForAnalysis = useCallback(async (region: ImageRegion | null) => {
    if (!regionSelectorState) return;

    const { item } = regionSelectorState;
    const isCharacter = 'name' in item;

    if (isCharacter) {
      setCharacters(prev => prev.map(c => c.name === (item as Character).name ? { ...c, isAnalyzingText: true, error: undefined } : c));
    } else {
      setScenes(prev => prev.map(s => s.id === (item as Scene).id ? { ...s, isAnalyzingText: true, error: undefined } : s));
    }
    
    setRegionSelectorState(null);

    let imageDataForAnalysis = item.imageUrl!;

    if (region) {
        try {
            const image = new Image();
            image.crossOrigin = "anonymous";
            
            const promise = new Promise<{base64Data: string}>((resolve, reject) => {
                image.onload = () => {
                    const canvas = document.createElement('canvas');
                    
                    const scaleX = image.naturalWidth / image.width;
                    const scaleY = image.naturalHeight / image.height;

                    const cropX = region.x * scaleX;
                    const cropY = region.y * scaleY;
                    const cropWidth = region.width * scaleX;
                    const cropHeight = region.height * scaleY;

                    canvas.width = cropWidth;
                    canvas.height = cropHeight;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        return reject(new Error('Failed to get canvas context'));
                    }
                    ctx.drawImage(
                        image,
                        cropX, cropY, cropWidth, cropHeight,
                        0, 0, cropWidth, cropHeight
                    );
                    
                    resolve({ base64Data: canvas.toDataURL(item.imageMimeType) });
                };
                image.onerror = (err) => reject(err);
                image.src = item.imageUrl!;
            });

            const { base64Data } = await promise;
            imageDataForAnalysis = base64Data;
        } catch (cropError) {
             console.error("Failed to crop image", cropError);
             const errorMessage = "Falha ao preparar a imagem para análise.";
             if (isCharacter) {
                setCharacters(prev => prev.map(c => c.name === (item as Character).name ? { ...c, isAnalyzingText: false, error: errorMessage } : c));
             } else {
                setScenes(prev => prev.map(s => s.id === (item as Scene).id ? { ...s, isAnalyzingText: false, error: errorMessage } : s));
             }
             return;
        }
    }
    
    try {
      const result = await analyzeImageText(imageDataForAnalysis, item.image_prompt);
      setAnalysisModalState({ item, result });
    } catch (e: any) {
       const errorMessage = e instanceof Error ? e.message : "Falha na análise da imagem.";
       if (isCharacter) {
         setCharacters(prev => prev.map(c => c.name === (item as Character).name ? { ...c, error: errorMessage } : c));
       } else {
         setScenes(prev => prev.map(s => s.id === (item as Scene).id ? { ...s, error: errorMessage } : s));
       }
    } finally {
        if (isCharacter) {
            setCharacters(prev => prev.map(c => c.name === (item as Character).name ? { ...c, isAnalyzingText: false } : c));
        } else {
            setScenes(prev => prev.map(s => s.id === (item as Scene).id ? { ...s, isAnalyzingText: false } : s));
        }
    }
  }, [regionSelectorState]);
  
  const handleApplyTextCorrection = useCallback(async (item: Character | Scene, originalText: string, suggestion: string) => {
    if (!item.imageUrl) return;
    
    const isCharacter = 'name' in item;
    const correctionPrompt = `CRITICAL INSTRUCTION: Perform a precise text correction on the image.
1. **Find this exact text:** "${originalText}"
2. **Replace it with this exact text:** "${suggestion}"
3. **Preserve everything else:** The original font, style, color, size, and position of the text must be matched as closely as possible.
4. **Do not alter the background or any other visual elements.** The change should be limited to the text correction only.`;

    try {
        const { base64Data, mimeType } = await handleEditImageWrapper(item.imageUrl, correctionPrompt);
        const newImageUrl = `data:${mimeType};base64,${base64Data}`;

        if (isCharacter) {
            handleCharacterImageUpdate(item.name, newImageUrl, mimeType);
        } else {
            handleSceneImageUpdate(item.id, newImageUrl, mimeType);
        }
    } catch (e: any) {
        console.error("Failed to apply text correction", e);
        const errorMessage = e instanceof Error ? e.message : "Falha ao corrigir a imagem.";
        if (isCharacter) {
          setCharacters(prev => prev.map(c => c.name === (item as Character).name ? { ...c, error: errorMessage } : c));
        } else {
          setScenes(prev => prev.map(s => s.id === (item as Scene).id ? { ...s, error: errorMessage } : s));
        }
    } finally {
        setAnalysisModalState(null);
    }
  }, [handleEditImageWrapper, handleCharacterImageUpdate, handleSceneImageUpdate]);
  
  const savePresetsToStorage = (newPresets: SettingsPreset[]) => {
    try {
        localStorage.setItem(PRESETS_KEY, JSON.stringify(newPresets));
    } catch(e) {
        console.error("Failed to save presets to localStorage", e);
    }
  };

  const handleSavePreset = useCallback(() => {
    const name = prompt("Digite um nome para o preset:");
    if (name) {
        const currentSettings: GenerationSettings = {
            imageModel,
            characterImageModel,
            aspectRatio,
            numberOfImages,
            resolution
        };
        const newPreset: SettingsPreset = {
            id: Date.now().toString(),
            name,
            settings: currentSettings,
        };
        const updatedPresets = [...presets, newPreset];
        setPresets(updatedPresets);
        savePresetsToStorage(updatedPresets);
        setSelectedPresetId(newPreset.id);
    }
  }, [imageModel, characterImageModel, aspectRatio, numberOfImages, resolution, presets]);

  const handleDeletePreset = useCallback(() => {
    if (selectedPresetId !== 'custom' && window.confirm("Tem certeza que deseja excluir este preset?")) {
        const updatedPresets = presets.filter(p => p.id !== selectedPresetId);
        setPresets(updatedPresets);
        savePresetsToStorage(updatedPresets);
        setSelectedPresetId('custom');
    }
  }, [selectedPresetId, presets]);

  const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = e.target.value;
    setSelectedPresetId(presetId);
    if (presetId !== 'custom') {
        const preset = presets.find(p => p.id === presetId);
        if (preset) {
            setImageModel(preset.settings.imageModel);
            setCharacterImageModel(preset.settings.characterImageModel);
            setAspectRatio(preset.settings.aspectRatio);
            setNumberOfImages(preset.settings.numberOfImages);
            setResolution(preset.settings.resolution || '1K');
        }
    }
  }, [presets]);


  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <main className="max-w-screen-2xl mx-auto">
        <header className="text-center mb-14 relative pt-2 animate-fade-in-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-semibold mb-7 tracking-widest uppercase">
            <SparklesIcon width={11} height={11} />
            Powered by Gemini AI
          </div>
          {/* Title */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-none">
            <span className="text-gradient-violet">Estúdio</span>{' '}
            <span className="text-white">de Roteiro Visual</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Faça o upload do seu roteiro em CSV — a IA analisa, extrai personagens e cria visualizações cinematográficas para cada cena.
          </p>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="absolute top-0 right-0 p-2.5 text-slate-600 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-all duration-200"
            aria-label="Abrir configurações"
          >
            <SettingsIcon />
          </button>
        </header>

        {!file && (
          <>
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch animate-fade-in-up" style={{animationDelay:'80ms'}}>
                <div className="flex flex-col">
                    <h3 className="text-center text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Novo Projeto</h3>
                    <FileUpload onFileSelect={handleFileChange} />
                </div>
                <div className="flex flex-col">
                    <h3 className="text-center text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Carregar Projeto</h3>
                    <div className="glass glass-hover rounded-2xl p-10 flex flex-col items-center justify-center h-full cursor-pointer group">
                        <input ref={projectInputRef} type="file" id="project-upload" className="hidden" accept=".zip,application/zip" onChange={handleProjectFileChange} />
                        <label htmlFor="project-upload" className="flex flex-col items-center justify-center cursor-pointer text-center">
                            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
                                <FolderOpenIcon width={28} height={28} className="text-violet-400" />
                            </div>
                            <p className="text-slate-300 font-semibold">Clique para carregar</p>
                            <p className="text-xs text-slate-600 mt-1">Arquivos .zip do projeto</p>
                        </label>
                    </div>
                </div>
            </div>
            <HistoryLoader history={history} onLoad={handleLoadFromHistory} onClear={handleClearHistory} />
            <QuickAnalyzer />
          </>
        )}
        
        {file && processingState === 'idle' && (
          <div className="text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-xl mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-violet-300">{file.name}</span> pronto para análise
              </p>
            </div>
            <div>
              <button
                onClick={handleAnalyze}
                disabled={!isLoaded}
                className="btn-primary px-10 py-4 text-lg font-bold text-white rounded-2xl inline-flex items-center gap-3"
              >
                <SparklesIcon width={20} height={20} />
                Iniciar Análise com IA
              </button>
              {!isLoaded && <p className="text-xs text-slate-600 mt-3">Carregando configurações...</p>}
            </div>
          </div>
        )}

        {processingState !== 'idle' && processingState !== 'done' && processingState !== 'error' && (
          <Loader message={processingMessage} />
        )}
        
        {error && (
          <div className="text-center my-8 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl max-w-3xl mx-auto animate-fade-in">
            <h3 className="font-bold text-red-400 text-xl mb-2">Ocorreu um Erro</h3>
            <p className="text-red-300/80 whitespace-pre-wrap text-sm">{error}</p>
            <button
              onClick={() => { setFile(null); resetState(); }}
              className="btn-primary mt-5 px-6 py-2.5 text-sm font-semibold text-white rounded-xl inline-flex items-center gap-2"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {processingState === 'done' && (
          <>
            <section className="mb-10 glass glass-hover rounded-2xl p-6 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-white">Configurações de Geração</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsGalleryOpen(true)}
                    className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl"
                    title="Ver e editar todas as imagens geradas no projeto"
                  >
                    <GalleryIcon width={16} height={16} />
                    <span>Galeria</span>
                  </button>
                  <button
                      onClick={handleExportProject}
                      disabled={isDownloading}
                      className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl"
                      title="Salvar todo o projeto como .zip"
                  >
                      {isDownloading ? (
                          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full" style={{animation:'spin .8s linear infinite'}}></div>
                      ) : (
                          <ArchiveIcon />
                      )}
                      <span>{isDownloading ? 'Exportando...' : 'Exportar .zip'}</span>
                  </button>
                </div>
              </div>

              {/* ── Card de preços por modelo ── */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Flash 2.5', priceBRL: 'R$0,005/tk', priceUSD: '$0,060/1K tk', note: 'Rápido · multimodal', color: 'border-blue-500/20 hover:border-blue-500/40', dot: 'bg-blue-400' },
                  { label: 'Flash 3.1', priceBRL: 'R$0,005/tk', priceUSD: '$0,060/1K tk', note: 'Novo · multimodal',   color: 'border-violet-500/25 hover:border-violet-500/50', dot: 'bg-violet-400' },
                  { label: 'Pro 3',     priceBRL: 'R$0,003/tk', priceUSD: '$0,030/1K tk', note: 'Alta fidelidade',     color: 'border-purple-500/20 hover:border-purple-500/40', dot: 'bg-purple-400' },
                  { label: 'Imagen 4',  priceBRL: 'R$0,232/img',priceUSD: '$0,040/img',   note: 'Preço fixo/imagem',  color: 'border-orange-500/20 hover:border-orange-500/40', dot: 'bg-orange-400' },
                ].map(({ label, priceBRL, priceUSD, note, color, dot }) => (
                  <div key={label} className={`rounded-xl px-3 py-2.5 border bg-black/30 transition-all duration-200 ${color}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                      <span className="text-xs font-bold text-slate-200">{label}</span>
                    </div>
                    <p className="text-sm font-bold text-emerald-400">{priceBRL}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{priceUSD}</p>
                    <p className="text-xs text-slate-700 mt-0.5">{note}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5 mt-7">
                <div className="space-y-1.5">
                  <label htmlFor="character-image-model" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Modelo do Personagem</label>
                  <select
                    id="character-image-model"
                    value={characterImageModel}
                    onChange={(e) => { setCharacterImageModel(e.target.value as ImageModel); setSelectedPresetId('custom'); }}
                    className="input-glass rounded-xl px-3 py-2 text-sm w-full"
                  >
                    <option value="imagen-4.0-generate-001">Imagen 4 — Alta Qualidade</option>
                    <option value="gemini-2.5-flash-image">Flash 2.5 — Rápido</option>
                    <option value="gemini-3.1-flash-image-preview">Flash 3.1 ✨ Novo</option>
                    <option value="gemini-3-pro-image-preview">Pro 3 — Alta Fidelidade</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="image-model" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Modelo da Cena</label>
                  <select
                    id="image-model"
                    value={imageModel}
                    onChange={(e) => { setImageModel(e.target.value as ImageModel); setSelectedPresetId('custom'); }}
                    className="input-glass rounded-xl px-3 py-2 text-sm w-full"
                  >
                    <option value="gemini-2.5-flash-image">Flash 2.5 — Rápido</option>
                    <option value="gemini-3.1-flash-image-preview">Flash 3.1 ✨ Novo</option>
                    <option value="imagen-4.0-generate-001">Imagen 4 — Alta Qualidade</option>
                    <option value="gemini-3-pro-image-preview">Pro 3 — Alta Fidelidade</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="aspect-ratio" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Proporção da Cena</label>
                  <select
                    id="aspect-ratio"
                    value={aspectRatio}
                    onChange={(e) => { setAspectRatio(e.target.value); setSelectedPresetId('custom'); }}
                    className="input-glass rounded-xl px-3 py-2 text-sm w-full"
                  >
                    <option value="16:9">16:9 — Paisagem</option>
                    <option value="1:1">1:1 — Quadrado</option>
                    <option value="9:16">9:16 — Retrato</option>
                    <option value="4:3">4:3 — Padrão</option>
                    <option value="3:4">3:4 — Vertical</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="resolution" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resolução</label>
                  <select
                    id="resolution"
                    value={resolution}
                    onChange={(e) => { setResolution(e.target.value as '1K' | '2K' | '4K'); setSelectedPresetId('custom'); }}
                    disabled={imageModel !== 'gemini-3-pro-image-preview' && characterImageModel !== 'gemini-3-pro-image-preview' && imageModel !== 'imagen-4.0-generate-001'}
                    className="input-glass rounded-xl px-3 py-2 text-sm w-full disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="1K">1K — Padrão</option>
                    <option value="2K">2K — Alta Resolução</option>
                    <option value="4K">4K — Ultra Resolução</option>
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2 lg:col-span-4 pt-5 border-t border-violet-500/10">
                  <label htmlFor="presets" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Presets de Configuração</label>
                  <div className="flex items-center gap-2 mt-2">
                    <select
                      id="presets"
                      value={selectedPresetId}
                      onChange={handlePresetChange}
                      className="input-glass rounded-xl px-3 py-2 text-sm w-full"
                    >
                      <option value="custom">Configuração Personalizada</option>
                      {presets.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button onClick={handleSavePreset} className="btn-primary px-4 py-2 text-sm font-semibold text-white rounded-xl flex-shrink-0">
                      Salvar
                    </button>
                    <button
                      onClick={handleDeletePreset}
                      disabled={selectedPresetId === 'custom'}
                      className="px-4 py-2 text-sm font-semibold text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-10 glass glass-hover rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-bold text-white">Contexto Geral</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">IA</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Influencia todas as gerações de imagem. Edite para refinar o estilo global.</p>
              <textarea
                value={generalContext}
                onChange={(e) => setGeneralContext(e.target.value)}
                className="input-glass w-full rounded-xl p-3 text-sm"
                rows={3}
              />
            </section>
            
            <div className="flex justify-center mb-10">
              <div className="glass rounded-2xl p-1.5 inline-flex gap-1">
                {([
                  { id: 'characters', label: 'Personagens', count: characters.length },
                  { id: 'scenes',     label: 'Cenas',       count: scenes.length },
                  { id: 'costs',      label: 'Custos',      count: null },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveView(tab.id)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                      activeView === tab.id
                        ? 'bg-violet-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.id === 'costs' && <CostReportIcon width={15} height={15} />}
                    {tab.label}
                    {tab.count !== null && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-md ${activeView === tab.id ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-500'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {activeView === 'characters' && (
              <section className="animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Personagens</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{characters.length} personagem{characters.length !== 1 ? 's' : ''} detectado{characters.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReloadCharacters}
                      disabled={isReloadingChars || isGeneratingAllChars}
                      className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl"
                    >
                      {isReloadingChars
                        ? <div className="w-4 h-4 border-2 border-violet-400/40 border-t-violet-400 rounded-full" style={{animation:'spin .8s linear infinite'}}></div>
                        : <ReloadIcon />}
                      <span>{isReloadingChars ? 'Recarregando...' : 'Recarregar'}</span>
                    </button>
                    <button
                      onClick={handleGenerateAllCharacterImages}
                      disabled={isGeneratingAllChars || isReloadingChars}
                      className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl"
                      title={isGeneratingAllChars && batchProgress ? `Gerando: ${batchProgress.currentItemName}` : 'Gerar imagens para todos os personagens'}
                    >
                      {isGeneratingAllChars
                        ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full" style={{animation:'spin .8s linear infinite'}}></div>
                        : <SparklesIcon width={15} height={15} />}
                      <span>{isGeneratingAllChars && batchProgress ? `Gerando (${batchProgress.current}/${batchProgress.total})...` : 'Gerar Todos'}</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {characters.map((char) => (
                    <CharacterCard 
                      key={char.name} 
                      character={char} 
                      scenes={scenes}
                      onImageUpdate={handleCharacterImageUpdate}
                      onGenerateImage={handleGenerateCharacterImage}
                      onDescriptionChange={handleCharacterDescriptionChange}
                      onPromptChange={handleCharacterPromptChange}
                      editImageService={handleEditImageWrapper}
                      onPreview={handleImagePreview}
                      onRevertImage={handleRevertCharacterImage}
                      onIsolateImage={handleIsolateCharacter}
                      onAnalyzeText={handleStartTextAnalysis}
                    />
                  ))}
                </div>
              </section>
            )}
            
            {activeView === 'costs' && (
              <section className="animate-fade-in">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <CostReportIcon className="text-emerald-400" width={20} height={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Relatório de Custos</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Consumo de tokens e custo estimado por imagem gerada neste roteiro.</p>
                  </div>
                </div>
                <CostReportView characters={characters} scenes={scenes} textCosts={textCosts} />
              </section>
            )}

            {activeView === 'scenes' && (
              <section className="animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Cenas</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{scenes.length} cena{scenes.length !== 1 ? 's' : ''} no roteiro</p>
                  </div>
                  <button
                    onClick={handleGenerateAllSceneImages}
                    disabled={isGeneratingAllScenes}
                    className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl"
                    title={isGeneratingAllScenes && batchProgress ? `Gerando: ${batchProgress.currentItemName}` : 'Gerar imagens para todas as cenas'}
                  >
                    {isGeneratingAllScenes
                      ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full" style={{animation:'spin .8s linear infinite'}}></div>
                      : <SparklesIcon width={15} height={15} />}
                    <span>{isGeneratingAllScenes && batchProgress ? `Gerando (${batchProgress.current}/${batchProgress.total})...` : 'Gerar Todas'}</span>
                  </button>
                </div>
                <div className="space-y-8">
                  {scenes.map((scene, index) => (
                    <SceneCard 
                      key={scene.id} 
                      scene={scene}
                      scenes={scenes}
                      sceneIndex={index}
                      availableStyles={availableStyles}
                      onImageUpdate={handleSceneImageUpdate}
                      onVisualize={handleGenerateSceneImage}
                      onVisualizeWithReference={handleGenerateSceneImageWithReference}
                      editImageService={handleEditImageWrapper}
                      onPreview={handleImagePreview}
                      onPromptChange={handleScenePromptChange}
                      onStyleChange={handleSceneStyleChange}
      onContinuationChange={handleSceneContinuationChange}
                      onContinuationReferenceChange={handleContinuationReferenceChange}
                      onUpdatePrompt={handleUpdateScenePrompt}
                      onRevertImage={handleRevertSceneImage}
                      onAnalyzeText={handleStartTextAnalysis}
                      onSplitScene={handleSplitScene}
                      onClearSplit={handleClearSplit}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {previewImageUrl && (
        <ImagePreviewModal imageUrl={previewImageUrl} onClose={handleClosePreview} />
      )}

      {regionSelectorState && (
        <ImageRegionSelectorModal
          isOpen={!!regionSelectorState}
          imageUrl={regionSelectorState.item.imageUrl!}
          onClose={() => setRegionSelectorState(null)}
          onConfirm={handleConfirmRegionForAnalysis}
        />
      )}
      
      {analysisModalState && (
        <TextAnalysisModal
          state={analysisModalState}
          onClose={() => setAnalysisModalState(null)}
          onApplyCorrection={handleApplyTextCorrection}
        />
      )}

      {isLoaded && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          initialSettings={settings}
          onSave={handleSaveSettings}
        />
      )}

      <ProjectGalleryModal
        isOpen={isGalleryOpen}
        characters={characters}
        scenes={scenes}
        onClose={() => setIsGalleryOpen(false)}
        onApplyEdit={handleEditProjectImage}
        isEditing={isGalleryEditing}
      />
    </div>
  );
};

export default App;