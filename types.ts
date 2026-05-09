// fix: Add ImageModel type definition.
export type ImageModel = 'gemini-2.5-flash-image' | 'gemini-3.1-flash-image-preview' | 'imagen-4.0-generate-001' | 'gemini-3-pro-image-preview';

// fix: Add CsvRow interface definition.
export interface CsvRow {
  scene_id: string;
  sub_id: string;
  order: string;
  loc: string;
  context: string;
  style: string;
}

// fix: Add Character interface definition.
export interface Character {
  name: string;
  physical_characteristics: string;
  image_prompt: string;
  imageUrl?: string;
  imageMimeType?: string;
  imageWidth?: number;
  imageHeight?: number;
  tokens?: number;
  costBRL?: number;
  modelUsed?: string;
  isLoading?: boolean;
  isIsolating?: boolean;
  isAnalyzingText?: boolean;
  error?: string;
  previousImageUrl?: string;
  previousImageMimeType?: string;
}

export interface SplitImage {
  id: string;
  prompt: string;
  imageUrl?: string;
  imageMimeType?: string;
  tokens?: number;
  costBRL?: number;
  modelUsed?: string;
  isLoading?: boolean;
  error?: string;
}

// fix: Add Scene interface definition.
export interface Scene {
  id: number;
  scene_id: number;
  sub_id: number;
  order: number;
  original_location: string;
  original_description: string;
  tagged_description: string;
  image_prompt: string;
  style: string;
  isContinuation?: boolean;
  continuationReferenceId?: number | null;
  imageUrl?: string;
  imageMimeType?: string;
  imageWidth?: number;
  imageHeight?: number;
  tokens?: number;
  costBRL?: number;
  modelUsed?: string;
  isLoading?: boolean;
  isUpdatingPrompt?: boolean;
  isAnalyzingText?: boolean;
  isSplitting?: boolean;
  error?: string;
  previousImageUrl?: string;
  previousImageMimeType?: string;
  splitImages?: SplitImage[];
}

// fix: Add SavedAnalysis interface definition.
export interface SavedAnalysis {
  timestamp: number;
  fileName: string;
  generalContext: string;
  characters: Character[];
  scenes: Scene[];
}

export interface AppSettings {
  generalContextPrompt: string;
  characterGenerationPrompt: string;
  sceneAnalysisPrompt: string;
  characterImagePrompt: string;
}

export interface GenerationSettings {
  imageModel: ImageModel;
  characterImageModel: ImageModel;
  aspectRatio: string;
  resolution: '1K' | '2K' | '4K';
  numberOfImages: number;
}

export interface SettingsPreset {
  id: string;
  name: string;
  settings: GenerationSettings;
}

export interface ProjectState {
  version: number;
  fileName: string;
  generalContext: string;
  characters: Character[];
  scenes: Scene[];
  settings: GenerationSettings;
}

export interface TextAnalysisResult {
  errorFound: boolean;
  transcribedText?: string;
  originalText?: string;
  suggestedCorrection?: string;
  explanation?: string;
}

export interface AnalysisModalState {
    item: Character | Scene;
    result: TextAnalysisResult;
}
export interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}