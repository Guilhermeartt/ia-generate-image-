export type ImageModel =
  | 'gemini-2.5-flash-image'
  | 'gemini-3.1-flash-image-preview'
  | 'gemini-3-pro-image-preview'
  | 'imagen-4.0-generate-001';

// fix: Add CsvRow interface definition.
export interface CsvRow {
  scene_id: string;
  sub_id: string;
  order: string;
  loc: string;
  context: string;
  style: string;
}

export interface StoryboardRow {
  ordem: number;
  local: string;     // local/ambiente da cena
  locucao: string;   // narração / voice-over
  imagem: string;    // descrição visual da cena
  lettering: string; // texto visível na tela
  tipo_cena: string; // ex: Narração, Entrevista, B-roll, Motion Graphics
}

// fix: Add Character interface definition.
export interface Character {
  name: string;
  physical_characteristics: string;
  image_prompt: string;
  /** Brief description of where/how the character first appears in the script */
  origin?: string;
  /** Scene order where the character first appears */
  firstSceneOrder?: number;
  /** Whether the character is physically present in scenes or only cited by name */
  character_type?: 'personagem' | 'citado';
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
  imageHistory?: CharacterImageVersion[];
}

export interface CharacterImageVersion {
  id: string;
  imageUrl: string;
  imageMimeType: string;
  imageWidth?: number;
  imageHeight?: number;
  tokens?: number;
  costBRL?: number;
  modelUsed?: string;
  createdAt: number;
  label?: string;
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

/** Suggestion for a single sub-scene when splitting */
export interface RefinedSubScene {
  description: string;
  prompt: string;
}

/** AI refinement result for a scene */
export interface SceneRefinement {
  needsSplit: boolean;
  splitReason?: string;
  splitSuggestion?: RefinedSubScene[];
  alternativePrompt: string;
  alternativeReason?: string;
}

export interface ScenePromptJson {
  scene_goal?: string;
  visual_style?: {
    style_family?: string;
    medium?: string;
    realism_level?: string;
    style_rules?: string[];
  };
  action?: {
    main_action?: string;
    subject_relationship?: string;
    emotional_state?: string;
  };
  camera?: {
    scene_type?: string;
    shot_type?: string;
    angle?: string;
    lens?: string;
    framing?: string;
    relation_to_subject?: string;
    depth_of_field?: string;
  };
  characters?: Array<{
    name: string;
    role_in_frame?: string;
    visual_continuity?: string;
  }>;
  environment?: {
    location?: string;
    time_of_day?: string;
    set_design?: string;
    atmosphere?: string;
  };
  lighting?: {
    key_light?: string;
    fill_light?: string;
    contrast?: string;
    color_temperature?: string;
  };
  color_texture?: {
    palette?: string;
    texture?: string;
    finishing?: string;
  };
  lettering?: {
    has_text: boolean;
    exact_text?: string;
    language?: string;
    placement?: string;
    text_rules?: string[];
  };
  required_elements?: string[];
  negative_constraints?: string[];
  output?: {
    aspect_ratio_hint?: string;
    quality?: string;
  };
}

/**
 * Papel funcional de uma referência visual.
 *  - `spatial`: influencia composição, cenário, enquadramento e organização do espaço.
 *  - `object`: elemento localizado a ser inserido (produto, livro, xícara, acessório…).
 *  - `screen`: conteúdo a ser exibido DENTRO de uma tela já presente na cena
 *    (celular, tablet, notebook, monitor, painel digital).
 */
export type SceneReferenceKind = 'spatial' | 'object' | 'screen';

export type VideoLetteringPosition = 'top' | 'center' | 'bottom';
export type VideoLetteringAlign = 'left' | 'center' | 'right';
export type VideoLetteringStyle =
  | 'cinematic'
  | 'box'
  | 'clean'
  | 'title'
  | 'lower-third'
  | 'glass'
  | 'neon'
  | 'subtitle'
  | 'marker'
  | 'gradient'
  | 'outline'
  | 'cg-box';

/** Lado chanfrado (inclinado) da caixa do estilo `cg-box`. */
export type VideoCgChamferSide = 'none' | 'left' | 'right' | 'top' | 'bottom';

/** Posição do logo dentro da caixa do estilo `cg-box`. */
export type VideoLogoPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';
export type VideoLetteringEnterAnimation =
  | 'fade'
  | 'slide-up'
  | 'slide-left'
  | 'zoom'
  | 'none'
  | 'typewriter'
  | 'blur-in'
  | 'bounce'
  | 'pop'
  | 'glitch'
  | 'rise';
export type VideoLetteringExitAnimation =
  | 'fade'
  | 'slide-down'
  | 'slide-right'
  | 'zoom'
  | 'none'
  | 'blur-out'
  | 'pop-out'
  | 'swipe-out'
  | 'dissolve';

/** Tipo de transição visual entre dois clipes consecutivos. */
export type VideoClipTransition =
  | 'cut'
  | 'crossfade'
  | 'fade-black'
  | 'fade-white'
  | 'blur'
  | 'zoom'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down';

/** Curva de aceleração aplicada às transições entre clipes e ao Ken Burns. */
export type VideoTransitionEasing =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out';

/** Direção do efeito Ken Burns (pan + zoom) aplicado à imagem do clipe. */
export type VideoKenBurnsDirection =
  | 'none'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down';

/** Configuração do efeito Ken Burns por clipe. */
export interface VideoKenBurnsConfig {
  direction: VideoKenBurnsDirection;
  /** Intensidade 0..1 — escala alvo no fim do clipe (1.0 = sem zoom; 1.1 = +10%). */
  intensity: number;
}

/** Texto sobreposto à cena na composição de vídeo Remotion. */
export interface SceneVideoLettering {
  text: string;
  position: VideoLetteringPosition;
  align: VideoLetteringAlign;
  style: VideoLetteringStyle;
  fontSize: number;
  color: string;
  /** Tempo relativo ao início da cena-pai, atravessando todos os seus planos. */
  startSeconds?: number;
  /** Tempo relativo ao início da cena-pai. Ausente mantém até o fim da cena. */
  endSeconds?: number;
  enterAnimation?: VideoLetteringEnterAnimation;
  exitAnimation?: VideoLetteringExitAnimation;
  enterDurationSeconds?: number;
  exitDurationSeconds?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  fontWeight?: number;
  letterSpacing?: number;
  borderRadius?: number;
  /** Opacidade do próprio texto (0..1). */
  textOpacity?: number;
  // ── Estilo `cg-box` (selo/quadro institucional) ──
  /** Lado chanfrado da caixa CG. Default: 'none'. */
  chamferSide?: VideoCgChamferSide;
  /** Profundidade do chanfro em % da dimensão do lado (0..60). */
  chamferSize?: number;
  /** Logo (data URL) exibido junto da caixa CG. */
  logoUrl?: string;
  /** Posição do logo dentro da caixa CG. Default: 'bottom-right'. */
  logoPosition?: VideoLogoPosition;
  /** Largura do logo em % do lado menor do vídeo (2..40). */
  logoSizePercent?: number;
  /** Ajuste fino horizontal do bloco, em % da largura do frame (-50..50). */
  offsetXPercent?: number;
  /** Ajuste fino vertical do bloco, em % da altura do frame (-50..50). */
  offsetYPercent?: number;
}

/** Override de configuração por clipe individual (uma imagem do vídeo). */
export interface SceneVideoClipOverride {
  /** Imagem alvo: `main`, `split:<id>` ou `end`. */
  sourceId: string;
  /** Duração específica deste clipe em segundos. */
  durationSeconds?: number;
  /** Transição usada para entrar neste clipe (cobre o final do clipe anterior). */
  transitionIn?: VideoClipTransition;
  /** Duração da transição em segundos. */
  transitionDurationSeconds?: number;
  /** Curva de easing da transição de entrada (ease-in / ease-out / ease-in-out / linear). */
  transitionEasing?: VideoTransitionEasing;
  /** Ken Burns específico deste clipe. */
  kenBurns?: VideoKenBurnsConfig;
  /** Lettering específico deste clipe — sobrescreve o da cena-pai. */
  lettering?: SceneVideoLettering;
}

/** Trilha de áudio sobreposta ao vídeo inteiro. */
export interface VideoAudioTrack {
  /** Identificador estável (file name ou nanoid). */
  id: string;
  /** Rótulo amigável exibido na UI. */
  label: string;
  /** Source URL ou data URL. */
  src: string;
  /** Volume 0..1. */
  volume: number;
  /** Offset em segundos do início do vídeo. */
  startOffsetSeconds?: number;
  /** Fade in em segundos. */
  fadeInSeconds?: number;
  /** Fade out em segundos. */
  fadeOutSeconds?: number;
}

/** Referência visual persistente anexada a uma cena (objeto, logo, imagem externa, screenshot…). */
export interface SceneReference {
  id: string;
  /** Rótulo livre — ex: "logo da marca", "produto", "moodboard". */
  label?: string;
  /** Imagem base64 (sem o prefixo data:…;base64,). */
  base64Data: string;
  mimeType: string;
  /** Miniatura como data URL para exibição rápida na UI. */
  previewUrl: string;
  /**
   * Papel da referência. Default: `object`. Define como o modelo deve incorporar
   * a imagem (estrutura da cena, objeto localizado, ou conteúdo de tela).
   */
  kind?: SceneReferenceKind;
  /**
   * Alvo de inserção textual — onde aplicar a referência.
   * Exemplos: "na mão da pessoa", "sobre a mesa", "na tela do tablet", "no cenário".
   * Especialmente útil para `object` e `screen`.
   */
  target?: string;
  /** Instrução opcional de mesclagem específica desta referência. */
  blendNote?: string;
  /** Quando true, a referência é incluída automaticamente na próxima geração. */
  enabled?: boolean;
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
  visual_intention?: string;
  prompt_json?: ScenePromptJson;
  image_prompt: string;
  style: string;
  mood?: string;
  detected_characters?: string[];
  lettering_notes?: string[];
  /** When false, strip the lettering from the prompt at generation time. Default: true. */
  includeLettering?: boolean;
  suggests_split?: boolean;
  split_reason?: string;
  end_frame_prompt?: string;
  endFrameUrl?: string;
  endFrameMimeType?: string;
  endFrameWidth?: number;
  endFrameHeight?: number;
  endFrameIsLoading?: boolean;
  endFrameError?: string;
  endFrameTokens?: number;
  endFrameCostBRL?: number;
  isContinuation?: boolean;
  continuationReferenceId?: number | null;
  imageUrl?: string;
  imageMimeType?: string;
  imageWidth?: number;
  imageHeight?: number;
  tokens?: number;
  costBRL?: number;
  modelUsed?: string;
  sceneGraphicStyle?: { id?: string; label: string; promptSuffix: string };
  isLoading?: boolean;
  isUpdatingPrompt?: boolean;
  isAnalyzingText?: boolean;
  isSplitting?: boolean;
  isRefining?: boolean;
  error?: string;
  previousImageUrl?: string;
  previousImageMimeType?: string;
  splitImages?: SplitImage[];
  refinement?: SceneRefinement;
  accumulatedCostBRL?: number;
  versionCount?: number;
  /** Referências visuais persistentes (objetos, logos, imagens externas) anexadas à cena. */
  references?: SceneReference[];
  /** Configuração editável do lettering usado no vídeo do storyboard. */
  videoLettering?: SceneVideoLettering;
  /**
   * Fontes visuais incluídas no vídeo, na ordem escolhida.
   * IDs possíveis: `main`, `split:<id>` e `end`.
   * Ausente preserva o comportamento legado: usar apenas a imagem principal.
   */
  videoImageSourceIds?: string[];
  /** Overrides por clipe (duração, Ken Burns, transição, lettering individual). */
  videoClipOverrides?: SceneVideoClipOverride[];
  /** Modelo de cena (template SVG da biblioteca) aplicado a esta cena. */
  templateId?: string;
  /** Conteúdo por slot que sobrescreve o binding automático. Chave: id do slot. */
  templateOverrides?: Record<string, { text?: string; imageHref?: string }>;
}

/** Configuração global do estúdio de vídeo do storyboard. */
export interface VideoStudioConfig {
  /** Duração padrão por clipe quando não há override. */
  defaultSecondsPerClip: number;
  /** Mostrar lettering no preview. */
  showCaptions: boolean;
  /** Aspect ratio efetivo do preview ("16:9", "9:16", etc.). */
  aspectRatio: string;
  /** Transição global padrão (pode ser sobrescrita por clipe). */
  defaultTransition: VideoClipTransition;
  /** Duração padrão da transição em segundos. */
  defaultTransitionSeconds: number;
  /** Easing padrão das transições (pode ser sobrescrito por clipe). */
  defaultTransitionEasing?: VideoTransitionEasing;
  /** Ken Burns padrão (pode ser sobrescrito por clipe). */
  defaultKenBurns: VideoKenBurnsConfig;
  /** Trilha de áudio opcional. */
  audio?: VideoAudioTrack;
}

// fix: Add SavedAnalysis interface definition.
export interface SavedAnalysis {
  timestamp: number;
  fileName: string;
  generalContext: string;
  characters: Character[];
  scenes: Scene[];
}

// ── Structured prompt config types ────────────────────────────────────────────

export interface TipoCenaStyle {
  /** Camera framing guidance (applied as aesthetic, not content). */
  framing: string;
  /** Visual aesthetic direction. */
  aesthetic: string;
  /** Always reinforces that image CONTENT follows the visual description. */
  content_note: string;
}

export interface StoryboardStructureConfig {
  role: string;
  goal: string;
  fields: {
    ordem: string;
    local: string;
    locucao: string;
    imagem: string;
    lettering: string;
    tipo_cena: string;
  };
  /** Valid tipo_cena values shown to the model. */
  tipo_cena_options: string[];
  rules: {
    /** How to handle numbered CENA markers in the source script. */
    scene_structure: string[];
    /** When to create additional rows (conservative). */
    split_conditions: string[];
    /** Fidelity to the source IMAGEM: field. */
    content_fidelity: string[];
    /** General output quality rules. */
    general: string[];
  };
}

export interface SceneAnalysisConfig {
  role: string;
  /** Per tipo_cena visual style directives — framing + aesthetic only, not content. */
  tipo_cena_styles: Record<string, TipoCenaStyle>;
  image_prompt: {
    /** Modular JSON schema that guides how image prompts are structured. */
    prompt_json_schema?: Record<string, unknown>;
    /** Ordered structure fields for the generated English prompt. */
    structure_fields: string[];
    /** Critical content fidelity rule injected into Task 4. */
    content_rule: string;
    word_range: { min: number; max: number };
    language: string;
  };
  end_frame_prompt: {
    description: string;
    word_range: { min: number; max: number };
  };
  /** Restrictions applied to all generated prompts. */
  restrictions: string[];
}

// ── App settings ──────────────────────────────────────────────────────────────

export interface AppSettings {
  scriptStructuringPrompt: string;
  generalContextPrompt: string;
  characterGenerationPrompt: string;
  sceneAnalysisPrompt: string;
  characterImagePrompt: string;
  /** JSON config for POST /api/gemini/structure-storyboard */
  storyboardStructureConfig: StoryboardStructureConfig;
  /** JSON config for POST /api/gemini/analyze-storyboard-scene */
  sceneAnalysisConfig: SceneAnalysisConfig;
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

/** Bounding box normalizada [0,1] — top-left origin */
export interface BoundingBox { x: number; y: number; w: number; h: number; }

export interface TextError {
  originalText: string;
  suggestedCorrection: string;
  explanation?: string;
  /** Posição do texto na imagem (normalizada 0-1). Disponível quando Gemini detecta. */
  boundingBox?: BoundingBox;
}

export interface TextAnalysisResult {
  errorFound: boolean;
  transcribedText?: string;
  errors?: TextError[];
  // legacy single-error fields (kept for backward compat)
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

export interface PolygonPoint {
  x: number;
  y: number;
}

/** Result from the region selector modal */
export type RegionActionResult =
  | { action: 'analyze'; region: ImageRegion | null }
  | { action: 'remove'; annotatedImageBase64: string; mimeType: string; polygon: PolygonPoint[] }
  | { action: 'edit'; annotatedImageBase64: string; mimeType: string; polygon: PolygonPoint[]; editInstruction: string };

/** Uma entrada de custo para chamadas de texto/análise da API Gemini */
export interface TextCostEntry {
  id: string;
  operation: string;       // 'Contexto Geral', 'Personagens', 'Análise de Cena', etc.
  model: string;
  inputTokens: number;
  outputTokens: number;
  costBRL: number;
  timestamp: number;
}
