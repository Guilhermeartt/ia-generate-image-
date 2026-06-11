import type { Character, CsvRow, StoryboardRow, ImageModel, SceneRefinement, TextAnalysisResult, StoryboardStructureConfig, SceneAnalysisConfig, ScenePromptJson } from '../types';
import { getAuthToken, type CurrentUser } from './saasService';
import { apiFetch as csrfFetch } from './httpClient';

type SceneAnalysisResult = {
  tagged_description: string;
  detected_characters: string[];
  visual_intention?: string;
  prompt_json?: ScenePromptJson;
  image_prompt: string;
  mood: string;
  suggests_split: boolean;
  split_reason: string;
  end_frame_prompt: string;
};

type AspectRatioFitMode = 'cover' | 'contain' | 'blur';

type TextSafeCharacter = Pick<Character, 'name' | 'physical_characteristics' | 'character_type' | 'origin' | 'firstSceneOrder'>;

type CostEmitPayload = {
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costBRL: number;
};

type CostEmitFn = (payload: CostEmitPayload) => void;
type UserEmitFn = (user: CurrentUser) => void;

let _costEmitter: CostEmitFn | null = null;
let _userEmitter: UserEmitFn | null = null;

export const registerCostEmitter = (fn: CostEmitFn): void => {
  _costEmitter = fn;
};

export const registerUserEmitter = (fn: UserEmitFn): void => {
  _userEmitter = fn;
};

export const API_KEY_STORAGE_KEY = 'gemini-api-key';

/** Lê somente a API key própria do usuário. A key da plataforma fica no servidor. */
export const getStoredApiKey = (): string => {
  try {
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch {}
  return '';
};

export type PlatformProvider = 'vertex' | 'vertex_express' | 'api_key' | null;

export interface GeminiServerStatus {
  hasPlatformKey: boolean;
  platformProvider?: PlatformProvider;
  vertex?: { project?: string; location?: string; express?: boolean } | null;
  user?: unknown;
}

export const getGeminiServerStatus = async (): Promise<GeminiServerStatus> => {
  const response = await csrfFetch('/api/gemini/status');
  if (!response.ok) return { hasPlatformKey: false };
  return response.json();
};

const emitCost = (payload?: CostEmitPayload): void => {
  if (payload && _costEmitter) _costEmitter(payload);
};

const emitUser = (user?: CurrentUser): void => {
  if (user && _userEmitter) _userEmitter(user);
};

const apiPost = async <T>(endpoint: string, body: unknown): Promise<T> => {
  const userApiKey = getStoredApiKey();
  const authToken = getAuthToken();

  let response: Response;
  try {
    response = await csrfFetch(`/api/gemini/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(body),
      authToken: authToken || undefined,
      userApiKey: userApiKey || undefined,
    });
  } catch (networkErr: any) {
    const msg = `[${endpoint}] Erro de rede: ${networkErr?.message || networkErr}`;
    console.error(msg);
    throw new Error(`Servidor inacessível — verifique se o servidor está rodando. (${networkErr?.message || 'network error'})`, { cause: networkErr });
  }

  const rawText = await response.text().catch(() => '');
  let payload: any = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    console.error(`[${endpoint}] HTTP ${response.status} — resposta não-JSON:`, rawText.slice(0, 400));
    throw new Error(`Servidor retornou resposta inválida (HTTP ${response.status}). Verifique o console do servidor.`);
  }

  if (!response.ok) {
    const serverMessage = payload?.error || payload?.message;
    const detail = serverMessage || `HTTP ${response.status} ${response.statusText}`;
    console.error(`[${endpoint}] Erro ${response.status}:`, serverMessage || rawText.slice(0, 300));
    throw new Error(detail);
  }

  emitCost(payload.costEntry);
  emitUser(payload.user);
  return payload.result as T;
};

const toTextSafeCharacters = (characters: Character[] = []): TextSafeCharacter[] =>
  characters.map((char) => ({
    name: char.name,
    physical_characteristics: char.physical_characteristics,
    character_type: char.character_type,
    origin: char.origin,
    firstSceneOrder: char.firstSceneOrder,
  }));

export const generateGeneralContext = async (
  csvContent: string,
  promptTemplate: string
): Promise<string> => {
  return apiPost<string>('general-context', { csvContent, promptTemplate });
};

export const generateCharacters = async (
  csvContent: string,
  promptTemplate: string
): Promise<Character[]> => {
  return apiPost<Character[]>('characters', { csvContent, promptTemplate });
};

/** Sugere, via IA, o texto de cada slot de texto de um modelo a partir da cena. */
export const suggestTemplateBinding = async (
  slots: { id: string; name: string; type: string }[],
  scene: { lettering?: string; description?: string; location?: string }
): Promise<Record<string, string>> => {
  return apiPost<Record<string, string>>('suggest-template-binding', { slots, scene });
};

export const convertScriptToScenes = async (
  scriptText: string,
  maxScenes: number = 80,
  promptTemplate?: string
): Promise<CsvRow[]> => {
  return apiPost<CsvRow[]>('script-to-scenes', { scriptText, maxScenes, promptTemplate });
};

export const structureStoryboard = async (
  scriptText: string,
  maxRows: number = 200,
  storyboardConfig?: Partial<StoryboardStructureConfig>,
): Promise<StoryboardRow[]> => {
  return apiPost<StoryboardRow[]>('structure-storyboard', { scriptText, maxRows, storyboardConfig });
};

export const analyzeStoryboardScene = async (
  row: StoryboardRow,
  characterList: Character[],
  generalContext?: string,
  sceneAnalysisConfig?: Partial<SceneAnalysisConfig>,
): Promise<SceneAnalysisResult> => {
  return apiPost('analyze-storyboard-scene', {
    row,
    characterList: toTextSafeCharacters(characterList),
    generalContext,
    sceneAnalysisConfig,
  });
};

export const analyzeScene = async (
  location: string,
  description: string,
  characterList: Character[],
  style: string,
  promptTemplate: string,
  generalContext?: string
): Promise<SceneAnalysisResult> => {
  return apiPost<SceneAnalysisResult>('analyze-scene', {
    location,
    description,
    characterList: toTextSafeCharacters(characterList),
    style,
    promptTemplate,
    generalContext,
  });
};

/**
 * Recria a direção criativa de uma cena.
 * Recebe a nova direção criativa do usuário + contexto da cena e devolve um novo
 * prompt_json + image_prompt fiel ao conteúdo narrativo mas com nova estética/composição.
 *
 * Backend: POST /api/gemini/recreate-prompt
 */
export const recreateScenePrompt = async (params: {
  location: string;
  description: string;
  currentImagePrompt?: string;
  currentPromptJson?: ScenePromptJson;
  creativeDirection: string;
  style?: string;
  characterList: Character[];
  generalContext?: string;
}): Promise<SceneAnalysisResult> => {
  return apiPost<SceneAnalysisResult>('recreate-prompt', {
    location: params.location,
    description: params.description,
    currentImagePrompt: params.currentImagePrompt,
    currentPromptJson: params.currentPromptJson,
    creativeDirection: params.creativeDirection,
    style: params.style,
    characterList: toTextSafeCharacters(params.characterList),
    generalContext: params.generalContext,
  });
};

export const generateImage = async (
  prompt: string,
  imageModel: ImageModel,
  aspectRatio?: string,
  numberOfImages: number = 1,
  generalContext?: string,
  resolution: '1K' | '2K' | '4K' = '1K',
  aspectRatioFitMode: AspectRatioFitMode = 'cover'
): Promise<{ base64Data: string; mimeType: string; tokens?: number; costBRL?: number }> => {
  return apiPost('generate-image', {
    prompt,
    imageModel,
    aspectRatio,
    numberOfImages,
    generalContext,
    resolution,
    aspectRatioFitMode,
  });
};

export const generateSceneImage = async (
  prompt: string,
  characterReferences: { name: string; base64Data: string; mimeType: string }[],
  aspectRatio: string,
  generalContext?: string,
  sceneReference?: { base64Data: string; mimeType: string },
  model: string = 'gemini-2.5-flash-image',
  resolution: '1K' | '2K' | '4K' = '1K',
  extraReferences?: { base64Data: string; mimeType: string }[],
  blendInstruction?: string,
  aspectRatioFitMode: AspectRatioFitMode = 'cover'
): Promise<{ base64Data: string; mimeType: string; tokens?: number; costBRL?: number }> => {
  return apiPost('generate-scene-image', {
    prompt,
    characterReferences,
    aspectRatio,
    generalContext,
    sceneReference,
    model,
    resolution,
    extraReferences,
    blendInstruction,
    aspectRatioFitMode,
  });
};

export const editImage = async (
  base64ImageDataWithPrefix: string,
  prompt: string,
  generalContext?: string,
  maskBase64WithPrefix?: string
): Promise<{ base64Data: string; mimeType: string; tokens?: number; costBRL?: number }> => {
  return apiPost('edit-image', {
    base64ImageDataWithPrefix,
    prompt,
    generalContext,
    ...(maskBase64WithPrefix ? { maskBase64WithPrefix } : {}),
  });
};

export const isolateCharacter = async (
  base64ImageDataWithPrefix: string
): Promise<{ base64Data: string; mimeType: string; tokens?: number; costBRL?: number }> => {
  return apiPost('isolate-character', { base64ImageDataWithPrefix });
};

export const analyzeImageText = async (
  imageSource: string,
  originalPrompt: string
): Promise<TextAnalysisResult> => {
  return apiPost<TextAnalysisResult>('analyze-image-text', {
    imageSource,
    originalPrompt,
  });
};

export const generateSplitPrompts = async (
  originalPrompt: string,
  generalContext: string,
  count: number,
  instructions: string
): Promise<string[]> => {
  return apiPost<string[]>('split-prompts', {
    originalPrompt,
    generalContext,
    count,
    instructions,
  });
};

export const analyzeUploadedImage = async (
  base64Data: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  return apiPost<string>('analyze-uploaded-image', {
    base64Data,
    mimeType,
    prompt,
  });
};

/**
 * Refine a scene: evaluate split necessity + generate alternative prompt.
 *
 * Backend endpoint: POST /api/gemini/refine-scene
 * Request body: { location, description, imagePrompt, generalContext, characterList }
 * Response: SceneRefinement (see types.ts)
 *
 * Suggested Gemini prompt for the backend (Flash 2.0 / Flash 2.5):
 * ---
 * You are a visual story consultant reviewing a single scene from a screenplay.
 *
 * Scene location: {location}
 * Scene description: {description}
 * Current image prompt: {imagePrompt}
 * General story context: {generalContext}
 *
 * Do TWO things:
 * 1. SPLIT ANALYSIS — Decide if this scene is too complex for a single image (e.g., contains
 *    multiple distinct story beats, two very different locations, or a significant time jump).
 *    If yes, suggest 2-3 sub-scenes that capture each beat separately.
 * 2. ALTERNATIVE PROMPT — Write ONE alternative image prompt that conveys the same narrative
 *    moment but from a different camera angle, lighting mood, or visual metaphor.
 *
 * Respond ONLY with JSON matching this schema:
 * {
 *   "needsSplit": boolean,
 *   "splitReason": string | null,
 *   "splitSuggestion": [{ "description": string, "prompt": string }] | null,
 *   "alternativePrompt": string,
 *   "alternativeReason": string
 * }
 * ---
 */
export const refineScene = async (
  location: string,
  description: string,
  imagePrompt: string,
  generalContext: string,
  characterList: Character[]
): Promise<SceneRefinement> => {
  return apiPost<SceneRefinement>('refine-scene', {
    location,
    description,
    imagePrompt,
    generalContext,
    characterList: toTextSafeCharacters(characterList),
  });
};
