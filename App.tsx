import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Character, Scene, CsvRow, StoryboardRow, ImageModel, SavedAnalysis, AppSettings, ProjectState, TextAnalysisResult, AnalysisModalState, ImageRegion, RegionActionResult, GenerationSettings, SettingsPreset, TextCostEntry, TextError, BoundingBox } from './types';
import Loader from './components/Loader';
import CharacterCard from './components/CharacterCard';
import SceneCard from './components/SceneCard';
import HistoryLoader from './components/HistoryLoader';
import SettingsModal from './components/SettingsModal';
import TextAnalysisModal from './components/TextAnalysisModal';
import ImageRegionSelectorModal from './components/ImageRegionSelectorModal';
import { useSettings } from './hooks/useSettings';
import { useCharacters } from './hooks/useCharacters';
import { useScenes } from './hooks/useScenes';
import { useBatchGeneration } from './hooks/useBatchGeneration';
import { useProjectIO } from './hooks/useProjectIO';
import { useAutosave } from './hooks/useAutosave';
import { loadDraft, clearDraft, draftHasContent, type DraftState } from './utils/localDraft';
import {
  generateGeneralContext,
  generateCharacters,
  analyzeScene,
  editImage,
  analyzeImageText,
  refineScene,
  registerCostEmitter,
  registerUserEmitter,
  convertScriptToScenes,
  structureStoryboard,
  analyzeStoryboardScene,
} from './services/geminiService';
import { SparklesIcon, ReloadIcon, ArchiveIcon, SettingsIcon, FolderOpenIcon, GalleryIcon, CostReportIcon, SunIcon, MoonIcon, UploadIcon } from './components/icons';
import ImagePreviewModal from './components/ImagePreviewModal';
import QuickAnalyzer from './components/QuickAnalyzer';
import ProjectGalleryModal, { ProjectImageItem } from './components/ProjectGalleryModal';
import CostReportView from './components/CostReportView';
import { getStoredApiKey } from './services/geminiService';
import { getGeminiServerStatus, type PlatformProvider } from './services/geminiService';
import AuthModal from './components/AuthModal';
import AccountModal from './components/AccountModal';
import ScriptPasteModal from './components/ScriptPasteModal';
import StyleSelectionModal, { type StyleOption } from './components/StyleSelectionModal';
import AnalysisReportView from './components/AnalysisReportView';
import SceneTableView from './components/SceneTableView';
import StoryboardReviewView from './components/StoryboardReviewView';
import CreditAlert from './components/CreditAlert';
import FlowStepper from './components/FlowStepper';
import ProjectStartCard from './components/ProjectStartCard';
import ScriptPreviewShowcase from './components/ScriptPreviewShowcase';
import PricingNotice from './components/PricingNotice';
import Toast, { type ToastMessage } from './components/Toast';
import BatchProgressBar from './components/BatchProgressBar';
import ActionLog from './components/ActionLog';
import { useActionLog } from './hooks/useActionLog';
import { applyPromptStyle, buildSceneAnalysisStyleInstruction } from './utils/stylePrompt';
import { SHOT_TYPE_OPTIONS } from './utils/promptModules';
import { normalizePromptJson, serializeImagePrompt, extractLetteringFromScript } from './utils/promptCoherence';
import {
  clearAuthToken,
  getCurrentUser,
  type CurrentUser,
} from './services/saasService';
import { primeCsrfCookie } from './services/httpClient';
import AdminPanel from './components/AdminPanel';

/** Retorna um rótulo curto do modelo para exibição na interface. */
const modelLabel = (model: string): string => {
  switch (model) {
    case 'gemini-2.5-flash-image':         return 'Nano Banana 2.5';
    case 'gemini-3.1-flash-image-preview': return 'Nano Banana 3.1';
    case 'gemini-3-pro-image-preview':     return 'Nano Banana Pro';
    case 'imagen-4.0-generate-001':        return 'Imagen 4';
    default:                               return model.split('-')[0];
  }
};

type ProcessingState =
  | 'idle'
  | 'parsing'
  | 'structuring'
  | 'reviewing'
  | 'context'
  | 'characters'
  | 'scenes'
  | 'refining'
  | 'done'
  | 'error';
  
declare const JSZip: any;

const HISTORY_KEY = 'scriptVisualizerHistory';
const PRESETS_KEY = 'generationSettingsPresets';

const PREDEFINED_STYLES = [...SHOT_TYPE_OPTIONS];

type ActiveView = 'characters' | 'scenes' | 'costs';

const storyboardRowsToCsvRows = (rows: StoryboardRow[]): CsvRow[] =>
  rows.map(r => {
    const contextParts: string[] = [];
    if (r.locucao) contextParts.push(`LOCUÇÃO: ${r.locucao}`);
    if (r.imagem) contextParts.push(r.imagem);
    if (r.lettering) contextParts.push(`LETTERING: ${r.lettering}`);
    return {
      scene_id: String(r.ordem),
      sub_id: '1',
      order: String(r.ordem),
      loc: r.local || '',
      context: contextParts.join('\n') || r.imagem,
      style: r.tipo_cena || '',
    };
  });

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processingState, setProcessingState] =
    useState<ProcessingState>('idle');
  const [processingMessage, _setProcessingMessageRaw] = useState('');
  const actionLog = useActionLog();
  const currentProcessingActionRef = useRef<string | null>(null);
  const setProcessingMessage = useCallback((msg: string) => {
    _setProcessingMessageRaw(msg);
    const trimmed = (msg || '').trim();
    const prevId = currentProcessingActionRef.current;
    if (!trimmed) {
      if (prevId) {
        actionLog.finish(prevId, 'success');
        currentProcessingActionRef.current = null;
      }
      return;
    }
    if (prevId) {
      actionLog.finish(prevId, 'success');
    }
    currentProcessingActionRef.current = actionLog.start(trimmed);
  }, [actionLog]);
  const [generalContext, setGeneralContext] = useState<string>('');
  const [forcePortugueseText, setForcePortugueseText] = useState<boolean>(true);
  const [scenesViewMode, setScenesViewMode] = useState<'cards' | 'table'>('cards');
  const PT_DIRECTIVE = '\n\nDiretiva de Idioma: Todo texto visível nas imagens (placas, telas, documentos, letreiros, rótulos, botões) deve estar em português do Brasil. Nunca gere texto em inglês ou outro idioma dentro da imagem.';
  const effectiveGeneralContext = forcePortugueseText
    ? (generalContext || '') + PT_DIRECTIVE
    : generalContext;
  const [error, setError] = useState<string | null>(null);
  const [imageModel, setImageModel] = useState<ImageModel>('gemini-2.5-flash-image');
  const [characterImageModel, setCharacterImageModel] = useState<ImageModel>('imagen-4.0-generate-001');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [numberOfImages, setNumberOfImages] = useState<number>(1);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings, saveSettings, isLoaded } = useSettings();
  const projectInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [analysisModalState, setAnalysisModalState] = useState<AnalysisModalState | null>(null);
  const [availableStyles, setAvailableStyles] = useState<string[]>([]);
  const [regionSelectorState, setRegionSelectorState] = useState<{ item: Character | Scene; initialMode?: 'analyze' | 'edit' | 'remove' } | null>(null);
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
  const [activeView, setActiveView] = useState<ActiveView>('characters');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isGalleryEditing, setIsGalleryEditing] = useState(false);
  const [textCosts, setTextCosts] = useState<TextCostEntry[]>([]);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('app-theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
  });
  const [hasServerPlatformKey, setHasServerPlatformKey] = useState(false);
  const [platformProvider, setPlatformProvider] = useState<PlatformProvider>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isScriptPasteOpen, setIsScriptPasteOpen] = useState(false);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [globalStyle, setGlobalStyle] = useState<StyleOption | null>(null);
  const [referenceImage, setReferenceImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [showAnalysisReport, setShowAnalysisReport] = useState(false);
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
  const [storyboardRows, setStoryboardRows] = useState<StoryboardRow[]>([]);
  const [pendingScriptText, setPendingScriptText] = useState<string>('');
  const [graphicStyleSceneId, setGraphicStyleSceneId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: `${Date.now()}`, message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const getImageDimensions = useCallback((base64Url: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = (err) => {
        console.error('Failed to load image for dimension check', err);
        reject(new Error('Não foi possível carregar a imagem para obter as dimensões.'));
      };
      image.src = base64Url;
    });
  }, []);

  // ── Custom hooks ──────────────────────────────────────────────────────────
  const {
    characters,
    setCharacters,
    isReloadingChars,
    handleGenerateCharacterImage,
    handleIsolateCharacter,
    handleCharacterDescriptionChange,
    handleCharacterPromptChange,
    handleCharacterImageUpdate,
    handleRevertCharacterImage,
    handleSelectCharacterImageVersion,
    handleReloadCharacters: handleReloadCharactersBase,
  } = useCharacters({
    characterImageModel,
    generalContext: effectiveGeneralContext,
    resolution,
    globalStyle,
    settings,
    getImageDimensions,
    file,
  });

  const {
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
  } = useScenes({
    imageModel,
    aspectRatio,
    generalContext: effectiveGeneralContext,
    globalReferenceImage: referenceImage,
    resolution,
    numberOfImages,
    characters,
    settings,
    getImageDimensions,
    showToast,
  });

  const {
    isGeneratingAllChars,
    isGeneratingAllScenes,
    batchProgress,
    handleGenerateAllCharacterImages,
    handleGenerateAllSceneImages,
  } = useBatchGeneration({
    characters,
    scenes,
    handleGenerateCharacterImage,
    handleGenerateSceneImage,
  });

  const resetState = useCallback(() => {
    setProcessingState('idle');
    setGeneralContext('');
    setCharacters([]);
    setScenes([]);
    setError(null);
    setAvailableStyles([]);
    setActiveView('characters');
    setTextCosts([]);
    setCloudProjectId(null);
    setShowAnalysisReport(false);
    setGlobalStyle(null);
    setReferenceImage(null);
    setStoryboardRows([]);
    void clearDraft();
  }, [setCharacters, setScenes]);

  // We declare cloudProjectId state above so it's available for the hook
  const {
    isDownloading,
    cloudSaveStatus,
    handleExportProject,
    handleImportProject,
    handleProjectFileChange,
    handleLoadCloudProject,
    handleSaveProjectToCloud,
  } = useProjectIO({
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
    setProcessingState: (s) => setProcessingState(s as ProcessingState),
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
  });

  // ── Hidratação inicial a partir do rascunho local (IndexedDB) ───────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadDraft();
      if (cancelled) return;
      if (draftHasContent(draft) && draft) {
        setGeneralContext(draft.generalContext);
        setForcePortugueseText(draft.forcePortugueseText);
        setCharacters(draft.characters);
        setScenes(draft.scenes);
        setStoryboardRows(draft.storyboardRows);
        setGlobalStyle(draft.globalStyle);
        setReferenceImage(draft.referenceImage);
        setCloudProjectId(draft.cloudProjectId);
        setImageModel(draft.imageModel);
        setCharacterImageModel(draft.characterImageModel);
        setAspectRatio(draft.aspectRatio);
        setResolution(draft.resolution);
        setNumberOfImages(draft.numberOfImages);
        setActiveView(draft.activeView);
        setScenesViewMode(draft.scenesViewMode);
        setAvailableStyles(draft.availableStyles);
        if (draft.fileMeta) {
          setFile(new File([new Blob([])], draft.fileMeta.name, { type: draft.fileMeta.type }));
        }
        if (draft.characters.length > 0 || draft.scenes.length > 0) {
          setProcessingState('done');
        }
        showToast('Sessão restaurada', 'success');
      }
      setIsHydrating(false);
    })();
    return () => { cancelled = true; };
  }, [setCharacters, setScenes, showToast]);

  // ── Autosave: rascunho local (1s) e nuvem se logado (5s) ───────────────
  const autosaveDraft: DraftState = {
    version: 1,
    updatedAt: 0,
    fileMeta: file ? { name: file.name, type: file.type } : null,
    generalContext,
    forcePortugueseText,
    characters,
    scenes,
    storyboardRows,
    globalStyle,
    referenceImage,
    cloudProjectId,
    imageModel,
    characterImageModel,
    aspectRatio,
    resolution,
    numberOfImages,
    activeView,
    scenesViewMode,
    availableStyles,
  };
  useAutosave({
    enabled: !isHydrating,
    draft: autosaveDraft,
    currentUser,
    cloudProjectId,
    setCloudProjectId,
  });

  // ── Action log: observa batchProgress (lote de imagens) ─────────────────
  const batchActionRef = useRef<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (batchProgress) {
      const name = batchProgress.currentItemName;
      const label = `Gerando ${name} (${batchProgress.current}/${batchProgress.total})`;
      if (batchActionRef.current && batchActionRef.current.name !== name) {
        actionLog.finish(batchActionRef.current.id, 'success');
        batchActionRef.current = null;
      }
      if (!batchActionRef.current) {
        batchActionRef.current = { id: actionLog.start(label), name };
      } else {
        actionLog.update(batchActionRef.current.id, { label });
      }
    } else if (batchActionRef.current) {
      actionLog.finish(batchActionRef.current.id, 'success');
      batchActionRef.current = null;
    }
  }, [batchProgress, actionLog]);

  // ── Action log: erros → finaliza ações em curso como erro ───────────────
  useEffect(() => {
    if (error) {
      if (currentProcessingActionRef.current) {
        actionLog.finish(currentProcessingActionRef.current, 'error', error);
        currentProcessingActionRef.current = null;
      }
      if (batchActionRef.current) {
        actionLog.finish(batchActionRef.current.id, 'error', error);
        batchActionRef.current = null;
      }
    }
  }, [error, actionLog]);

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

    // Apply saved theme on mount
    document.documentElement.setAttribute('data-theme', localStorage.getItem('app-theme') || 'dark');

    // Garante que o cookie CSRF está disponível antes de qualquer POST.
    void primeCsrfCookie();

    // Atalho Ctrl/⌘+Shift+A para abrir o painel admin
    const handleAdminShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsAdminOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleAdminShortcut);
    const cleanupShortcut = () => window.removeEventListener('keydown', handleAdminShortcut);

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
    registerUserEmitter(user => setCurrentUser(user));

    getGeminiServerStatus()
      .then(status => {
        setHasServerPlatformKey(status.hasPlatformKey);
        setPlatformProvider(status.platformProvider ?? null);
        if (status.user) setCurrentUser(status.user as CurrentUser);
      })
      .catch(() => {
        setHasServerPlatformKey(false);
        setPlatformProvider(null);
      });

    getCurrentUser().then(user => {
      if (user) setCurrentUser(user);
    });

    return cleanupShortcut;
  }, []);

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    resetState();
  };

  const parseCSV = (text: string): CsvRow[] => {
    // ── RFC 4180-compliant CSV tokeniser ──────────────────────────────────
    // Handles: quoted fields with embedded commas/semicolons/newlines,
    // escaped quotes (""), Windows (\r\n) and Unix (\n) line endings.
    const tokeniseCSV = (src: string, delim: string): string[][] => {
      const rows: string[][] = [];
      let row: string[] = [];
      let field = '';
      let inQ = false;
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inQ) {
          if (ch === '"') {
            if (src[i + 1] === '"') { field += '"'; i++; }   // escaped "
            else inQ = false;
          } else {
            field += ch;
          }
        } else {
          if (ch === '"') {
            inQ = true;
          } else if (ch === delim) {
            row.push(field); field = '';
          } else if (ch === '\n') {
            row.push(field); field = '';
            rows.push(row); row = [];
          } else if (ch !== '\r') {
            field += ch;
          }
        }
      }
      row.push(field);
      if (row.some(f => f !== '')) rows.push(row);  // last line (no trailing \n)
      return rows;
    };

    if (!text.trim()) {
      throw new Error('O arquivo CSV está vazio.');
    }

    // Detect delimiter: pick whichever (comma vs semicolon) appears more
    // on the first line to avoid false positives from data in later fields.
    const firstLineEnd = text.indexOf('\n');
    const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
    const commas     = (firstLine.match(/,/g)  || []).length;
    const semicolons = (firstLine.match(/;/g)  || []).length;
    const delimiter  = semicolons > commas ? ';' : ',';

    const rows = tokeniseCSV(text.trim(), delimiter);
    if (rows.length < 2) {
      throw new Error('O arquivo CSV deve ter um cabeçalho e pelo menos uma linha de dados.');
    }

    const headers = rows[0].map(h => h.trim().toLowerCase());

    const sceneIdIndex = headers.indexOf('scene_id');
    const subIdIndex   = headers.indexOf('sub_id');
    const orderIndex   = headers.indexOf('order');
    const locIndex     = headers.indexOf('loc');
    const contextIndex = headers.indexOf('context');
    const styleIndex   = headers.indexOf('style'); // Optional column

    if ([sceneIdIndex, subIdIndex, orderIndex, locIndex, contextIndex].includes(-1)) {
      const missing: string[] = [];
      if (sceneIdIndex === -1) missing.push("'scene_id'");
      if (subIdIndex   === -1) missing.push("'sub_id'");
      if (orderIndex   === -1) missing.push("'order'");
      if (locIndex     === -1) missing.push("'loc'");
      if (contextIndex === -1) missing.push("'context'");
      throw new Error(
        `Não foi possível encontrar as colunas necessárias. Cabeçalhos encontrados:\n${headers.join(', ')}\n` +
        `O CSV deve conter a(s) coluna(s) ${missing.join(', ')}. Verifique a ortografia e certifique-se de que o arquivo usa vírgula (,) ou ponto e vírgula (;) como delimitador.`
      );
    }

    const data: CsvRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      if (values.every(v => !v.trim())) continue;   // skip blank rows
      data.push({
        scene_id: (values[sceneIdIndex] || '').trim(),
        sub_id:   (values[subIdIndex]   || '').trim(),
        order:    (values[orderIndex]   || '').trim(),
        loc:      (values[locIndex]     || '').trim(),
        context:  (values[contextIndex] || '').trim(),
        style:    (styleIndex > -1 ? (values[styleIndex] || '') : '').trim(),
      });
    }
    return data;
  };

  const escapeCsvValue = (value: string): string => {
    const safe = String(value ?? '');
    if (/[",\n\r;]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
    return safe;
  };

  const rowsToCsvText = (rows: CsvRow[]): string => {
    const header = ['scene_id', 'sub_id', 'order', 'loc', 'context', 'style'];
    const lines = rows.map(row => [
      row.scene_id,
      row.sub_id,
      row.order,
      row.loc,
      row.context,
      row.style || '',
    ].map(escapeCsvValue).join(','));
    return [header.join(','), ...lines].join('\n');
  };

  const isDocxFile = (candidate: File): boolean => (
    candidate.name.toLowerCase().endsWith('.docx') ||
    candidate.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );

  const extractTextFromDocx = async (docxFile: File): Promise<string> => {
    if (typeof JSZip === 'undefined') {
      throw new Error('A biblioteca JSZip é necessária para ler arquivos .docx.');
    }

    const zip = await JSZip.loadAsync(docxFile);
    const documentFile = zip.file('word/document.xml');
    if (!documentFile) {
      throw new Error('Não foi possível encontrar o conteúdo principal do arquivo .docx.');
    }

    const xml = await documentFile.async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const paragraphs = Array.from(doc.getElementsByTagName('w:p'));
    const text = paragraphs
      .map(paragraph => Array.from(paragraph.getElementsByTagName('w:t')).map(node => node.textContent || '').join(''))
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n\n');

    if (text.length < 20) {
      throw new Error('O arquivo .docx não possui texto suficiente para análise.');
    }

    return text;
  };

  const handleAnalyze = useCallback(async (
    styleOverride?: StyleOption | null,
    referenceImageOverride?: { base64: string; mimeType: string } | null,
  ) => {
    if (!file || !isLoaded) { // Wait for settings to be loaded
      setError('Por favor, selecione um arquivo primeiro.');
      return;
    }
    // Use values passed directly (avoids React stale-closure issue when called
    // right after setState in the same event handler).
    const activeStyle = styleOverride !== undefined ? styleOverride : globalStyle;
    const activeRefImage = referenceImageOverride !== undefined ? referenceImageOverride : referenceImage;
    resetState();
    setGlobalStyle(activeStyle);
    setReferenceImage(activeRefImage);
    setProcessingState('parsing');

    try {
      setProcessingMessage(isDocxFile(file) ? 'Lendo roteiro do arquivo Word...' : 'Lendo e analisando o arquivo CSV...');
      let text = await file.text();
      if (isDocxFile(file)) {
        const docxText = await extractTextFromDocx(file);
        setProcessingMessage('Organizando estrutura do storyboard...');
        setProcessingState('structuring');
        const sbRows = await structureStoryboard(
          docxText,
          currentUser?.plan?.maxScenesPerScript || (getStoredApiKey() ? 120 : 20),
        );
        setStoryboardRows(sbRows);
        setPendingScriptText(docxText);
        setProcessingState('reviewing');
        return; // wait for user to confirm before running full analysis
      }
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

          // 1. Formal tag: [ref:123] or [ref:previous]
          const refTagMatch = contextText.match(/\[ref:(\d+|previous)\]/i);
          if (refTagMatch) {
            const refValue = refTagMatch[1].toLowerCase();
            if (refValue === 'previous') return { isContinuation: true, referenceId: null };
            const id = parseInt(refValue, 10);
            if (!isNaN(id)) return { isContinuation: true, referenceId: id };
          }

          // 2. Numbered reference patterns (captures the scene/img number)
          const numberedPatterns: RegExp[] = [
            /(?:continuidade|continua(?:ç|c)ão)\s+d(?:a|o)\s+(?:img|imagem|cena)\s+(\d+)/i,
            /\(img\s*(\d+)\)/i,
            /continua(?:ç|c)ão\s+da\s+cena\s+(\d+)/i,
            /continua\s+(?:da|da\s+cena)\s+(\d+)/i,
            /cena\s+(\d+)\s+(?:—|-|–)\s+continuidade/i,
          ];
          for (const regex of numberedPatterns) {
            const match = contextText.match(regex);
            if (match?.[1]) {
              const id = parseInt(match[1], 10);
              if (!isNaN(id)) return { isContinuation: true, referenceId: id };
            }
          }

          // 3. Anonymous continuation (refers to the previous scene)
          const anonymousPatterns: RegExp[] = [
            /continua(?:ç|c)ão\s+da\s+cena\s+anterior/i,
            /continua\s+(?:da\s+)?(?:cena\s+)?anterior/i,
            /\[continuidade\]/i,
            /\(continuidade\)/i,
            /mesma\s+cena\s*[,—]/i,
          ];
          for (const regex of anonymousPatterns) {
            if (regex.test(contextText)) return { isContinuation: true, referenceId: null };
          }

          return { isContinuation: false, referenceId: null };
      };

      // Strip "LETTERING: ..." segments from a description so the lettering text
      // does not appear duplicated in the description AND in the lettering panel.
      const stripLetteringFromDescription = (text: string): string => {
        if (!text) return '';
        return text
          // Remove "LETTERING: ..." until end-of-line OR end-of-string (greedy line consume)
          .replace(/\s*LETTERING\s*:\s*[^\n]*/gi, '')
          // Collapse any orphan punctuation/whitespace left at line breaks
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/\s+\.\s*$/, '.')
          .trim();
      };

      // Pre-validate all rows before hitting the API
      const validatedRows = csvData.map((row, index) => {
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
        return { row, index, scene_id, sub_id, order };
      });

      // Controlled concurrency: analyze up to 5 scenes in parallel to respect rate limits
      const CONCURRENCY = 5;
      const processedSceneResults: Scene[] = new Array(validatedRows.length);
      let completedCount = 0;

      const analyzeWorker = async (workerRows: typeof validatedRows) => {
        for (const { row, index, scene_id, sub_id, order } of workerRows) {
          const continuity = analyzeContinuity(row.context);
          const descriptionForAnalysis = row.context
            .replace(/\[ref:(\d+|previous)\]/i, '')
            .replace(/(?:continuidade|continua(?:ç|c)ão)\s+d(?:a|o)\s+(?:img|imagem|cena)\s*\d*/i, '')
            .replace(/\(img\s*\d+\)/i, '')
            .replace(/continua(?:ç|c)ão\s+da\s+cena\s+(?:anterior|\d+)/i, '')
            .trim();

          const { tagged_description, detected_characters, visual_intention, prompt_json, image_prompt, mood, suggests_split, split_reason, end_frame_prompt } = await analyzeScene(
            row.loc,
            descriptionForAnalysis,
            initialChars,
            [row.style, buildSceneAnalysisStyleInstruction(activeStyle)].filter(Boolean).join('\n'),
            settings.sceneAnalysisPrompt,
            context
          );

          completedCount++;
          setProcessingMessage(`Analisando cenas... (${completedCount}/${validatedRows.length})`);

          const normalizedPromptJson = normalizePromptJson(prompt_json) ?? prompt_json;
          const sceneLetteringNotes = extractLetteringFromScript(row.context);
          const finalImagePrompt = normalizedPromptJson
            ? serializeImagePrompt(normalizedPromptJson, true, sceneLetteringNotes)
            : image_prompt;

          processedSceneResults[index] = {
            id: index,
            scene_id,
            sub_id,
            order,
            original_location: row.loc,
            original_description: stripLetteringFromDescription(row.context),
            tagged_description: stripLetteringFromDescription(tagged_description),
            visual_intention: visual_intention ?? '',
            prompt_json: normalizedPromptJson,
            detected_characters: detected_characters ?? [],
            image_prompt: finalImagePrompt,
            mood: mood ?? '',
            suggests_split: suggests_split ?? false,
            split_reason: split_reason ?? '',
            end_frame_prompt: end_frame_prompt ?? '',
            lettering_notes: sceneLetteringNotes,
            style: row.style,
            isContinuation: continuity.isContinuation,
            continuationReferenceId: continuity.referenceId,
          };
        }
      };

      // Split rows into CONCURRENCY buckets (round-robin)
      const buckets: Array<typeof validatedRows> = Array.from({ length: CONCURRENCY }, () => []);
      validatedRows.forEach((r, i) => buckets[i % CONCURRENCY].push(r));
      await Promise.all(buckets.map(bucket => analyzeWorker(bucket)));

      let processedScenes = processedSceneResults;

      processedScenes.sort((a, b) => {
        if (a.scene_id !== b.scene_id) {
          return a.scene_id - b.scene_id;
        }
        if (a.sub_id !== b.sub_id) {
          return a.sub_id - b.sub_id;
        }
        return a.order - b.order;
      });

      // Apply global style suffix to every scene prompt
      if (activeStyle?.promptSuffix) {
        processedScenes = processedScenes.map(s => ({
          ...s,
          image_prompt: applyPromptStyle(s.image_prompt, activeStyle),
        }));
      }

      // Compute character origins using detected_characters from AI (precise) with fallback
      const charsWithOrigin = initialChars.map(char => {
        const nameLower = char.name.toLowerCase();
        const firstScene = processedScenes.find(s =>
          // Primary: use the AI's explicit detected_characters list
          (s.detected_characters ?? []).map((n: string) => n.toLowerCase()).includes(nameLower) ||
          // Fallback: tagged_description bracket search
          s.tagged_description?.toLowerCase().includes(`[${nameLower}]`)
        );
        return {
          ...char,
          firstSceneOrder: firstScene?.order,
          origin: firstScene
            ? `Aparece pela primeira vez na cena ${firstScene.order} — ${firstScene.original_location}`
            : undefined,
        };
      });
      setCharacters(charsWithOrigin);

      setScenes(processedScenes);

      // ── Refinement pass ───────────────────────────────────────────
      setProcessingState('refining');
      setProcessingMessage('Iniciando refinamento...');

      const refinedScenes = [...processedScenes];
      for (let i = 0; i < processedScenes.length; i++) {
        const scene = processedScenes[i];
        setProcessingMessage(`Refinando cena ${i + 1} de ${processedScenes.length}...`);
        // Mark scene as refining in UI
        setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, isRefining: true } : s));
        try {
          const refinement = await refineScene(
            scene.original_location,
            scene.original_description,
            scene.image_prompt,
            context,      // local variable — state may be stale here
            initialChars
          );
          refinedScenes[i] = { ...refinedScenes[i], refinement, isRefining: false };
        } catch (e) {
          console.warn(`Refinamento da cena ${scene.id} falhou:`, e);
          refinedScenes[i] = { ...refinedScenes[i], isRefining: false };
        }
        // Push incremental updates so the user sees progress
        setScenes([...refinedScenes]);
      }
      // ── End refinement pass ───────────────────────────────────────

      setProcessingState('done');
      setProcessingMessage('');
      setShowAnalysisReport(true);

      const newAnalysis: SavedAnalysis = {
        timestamp: Date.now(),
        fileName: file.name,
        generalContext: context,
        characters: charsWithOrigin,
        scenes: refinedScenes,
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
  }, [file, settings, isLoaded, resetState, currentUser, globalStyle, referenceImage]); // globalStyle/referenceImage kept for fallback when called without args

  const handleConfirmStructure = useCallback(async () => {
    if (storyboardRows.length === 0) return;
    const activeStyle = globalStyle;
    const activeRefImage = referenceImage;
    resetState();
    setGlobalStyle(activeStyle);
    setReferenceImage(activeRefImage);
    setProcessingState('context');
    const csvData = storyboardRowsToCsvRows(storyboardRows);
    const csvText = rowsToCsvText(csvData);
    try {
      const stylesFromCsv = csvData.map(row => row.style).filter(s => s && s.trim() !== '');
      setAvailableStyles([...new Set([...PREDEFINED_STYLES, ...stylesFromCsv])]);

      setProcessingMessage('Gerando contexto geral da história...');
      const context = await generateGeneralContext(csvText, settings.generalContextPrompt);
      setGeneralContext(context);

      setProcessingState('characters');
      setProcessingMessage('Extraindo personagens e personas com IA...');
      const initialCharsRaw = await generateCharacters(csvText, settings.characterGenerationPrompt);
      const initialChars = initialCharsRaw.map(char => ({
        ...char,
        image_prompt: settings.characterImagePrompt.replace('{physical_characteristics}', char.physical_characteristics),
      }));
      setCharacters(initialChars);

      setProcessingState('scenes');
      setProcessingMessage('Analisando cenas e criando prompts de imagem...');

      const stripLetteringFromDescription = (text: string): string => {
        if (!text) return '';
        return text
          // Remove "LETTERING: ..." until end-of-line OR end-of-string (greedy line consume)
          .replace(/\s*LETTERING\s*:\s*[^\n]*/gi, '')
          // Collapse any orphan punctuation/whitespace left at line breaks
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/\s+\.\s*$/, '.')
          .trim();
      };

      const CONCURRENCY = 5;
      const processedSceneResults: Scene[] = new Array(storyboardRows.length);
      let completedCount = 0;
      const indexedSbRows = storyboardRows.map((sbRow, index) => ({ sbRow, index }));
      const storyboardAnalysisContext = [
        context,
        buildSceneAnalysisStyleInstruction(activeStyle),
      ].filter(Boolean).join('\n\n');

      const analyzeWorker = async (workerRows: typeof indexedSbRows) => {
        for (const { sbRow, index } of workerRows) {
          const { tagged_description, detected_characters, visual_intention, prompt_json, image_prompt, mood, suggests_split, split_reason, end_frame_prompt } =
            await analyzeStoryboardScene(sbRow, initialChars, storyboardAnalysisContext);
          completedCount++;
          setProcessingMessage(`Analisando cenas... (${completedCount}/${storyboardRows.length})`);
          const descriptionForDisplay = [
            sbRow.locucao && `LOCUÇÃO: ${sbRow.locucao}`,
            sbRow.imagem,
          ].filter(Boolean).join('\n');
          const normalizedPromptJson = normalizePromptJson(prompt_json) ?? prompt_json;
          const sbLetteringNotes = sbRow.lettering ? [sbRow.lettering] : [];
          const finalImagePrompt = normalizedPromptJson
            ? serializeImagePrompt(normalizedPromptJson, true, sbLetteringNotes)
            : image_prompt;
          processedSceneResults[index] = {
            id: index,
            scene_id: sbRow.ordem,
            sub_id: 1,
            order: sbRow.ordem,
            original_location: sbRow.local || '',
            original_description: descriptionForDisplay,
            tagged_description: stripLetteringFromDescription(tagged_description),
            visual_intention: visual_intention ?? '',
            prompt_json: normalizedPromptJson,
            detected_characters: detected_characters ?? [],
            image_prompt: finalImagePrompt,
            mood: mood ?? '',
            suggests_split: suggests_split ?? false,
            split_reason: split_reason ?? '',
            end_frame_prompt: end_frame_prompt ?? '',
            lettering_notes: sbLetteringNotes,
            style: sbRow.tipo_cena || '',
            isContinuation: false,
            continuationReferenceId: null,
          };
        }
      };

      const buckets: Array<typeof indexedSbRows> = Array.from({ length: CONCURRENCY }, () => []);
      indexedSbRows.forEach((r, i) => buckets[i % CONCURRENCY].push(r));
      await Promise.all(buckets.map(bucket => analyzeWorker(bucket)));

      let processedScenes = processedSceneResults.sort((a, b) => a.order - b.order);

      if (activeStyle?.promptSuffix) {
        processedScenes = processedScenes.map(s => ({
          ...s,
          image_prompt: applyPromptStyle(s.image_prompt, activeStyle),
        }));
      }

      const charsWithOrigin = initialChars.map(char => {
        const nameLower = char.name.toLowerCase();
        const firstScene = processedScenes.find(s =>
          (s.detected_characters ?? []).map((n: string) => n.toLowerCase()).includes(nameLower) ||
          s.tagged_description?.toLowerCase().includes(`[${nameLower}]`)
        );
        return {
          ...char,
          firstSceneOrder: firstScene?.order,
          origin: firstScene
            ? `Aparece pela primeira vez na cena ${firstScene.order} — ${firstScene.original_location}`
            : undefined,
        };
      });
      setCharacters(charsWithOrigin);
      setScenes(processedScenes);

      setProcessingState('refining');
      setProcessingMessage('Iniciando refinamento...');
      const refinedScenes = [...processedScenes];
      for (let i = 0; i < processedScenes.length; i++) {
        const scene = processedScenes[i];
        setProcessingMessage(`Refinando cena ${i + 1} de ${processedScenes.length}...`);
        setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, isRefining: true } : s));
        try {
          const refinement = await refineScene(
            scene.original_location,
            scene.original_description,
            scene.image_prompt,
            context,
            initialChars
          );
          refinedScenes[i] = { ...refinedScenes[i], refinement, isRefining: false };
        } catch (e) {
          console.warn(`Refinamento da cena ${scene.id} falhou:`, e);
          refinedScenes[i] = { ...refinedScenes[i], isRefining: false };
        }
        setScenes([...refinedScenes]);
      }

      setProcessingState('done');
      setProcessingMessage('');
      setShowAnalysisReport(true);

      const fileName = file?.name || 'roteiro';
      const newAnalysis: SavedAnalysis = {
        timestamp: Date.now(),
        fileName,
        generalContext: context,
        characters: charsWithOrigin,
        scenes: refinedScenes,
      };
      setHistory(prevHistory => {
        const updatedHistory = [newAnalysis, ...prevHistory].slice(0, 2);
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory)); } catch {}
        return updatedHistory;
      });
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Ocorreu um erro desconhecido.');
      setProcessingState('error');
    }
  }, [storyboardRows, settings, resetState, globalStyle, referenceImage, file]);

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

  // Wrapper para handleReloadCharacters com tratamento de erro local
  const handleReloadCharacters = useCallback(async () => {
    if (!file) {
      setError('Não é possível recarregar personagens sem um arquivo de origem.');
      return;
    }
    setError(null);
    try {
      await handleReloadCharactersBase();
    } catch (e: any) {
      setError(e.message || 'Falha ao recarregar personagens.');
    }
  }, [file, handleReloadCharactersBase]);

  const handleEditImageWrapper = useCallback(async (base64: string, prompt: string): Promise<{ base64Data: string; mimeType: string }> => {
    return editImage(base64, prompt, effectiveGeneralContext);
  }, [effectiveGeneralContext]);

  const handleImagePreview = useCallback((url: string) => {
    setPreviewImageUrl(url);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewImageUrl(null);
  }, []);


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
    setRegionSelectorState({ item, initialMode: 'analyze' });
  }, []);

  const handleStartRegionEdit = useCallback((item: Character | Scene) => {
    if (!item.imageUrl) return;
    setRegionSelectorState({ item, initialMode: 'edit' });
  }, []);

  const handleConfirmRegionForAnalysis = useCallback(async (result: RegionActionResult) => {
    if (!regionSelectorState) return;

    const { item } = regionSelectorState;
    const isCharacter = 'name' in item;
    setRegionSelectorState(null);

    // ── REMOVE action ────────────────────────────────────────────────
    if (result.action === 'remove') {
      if (isCharacter) return; // removal only applies to scenes for now
      const scene = item as Scene;
      setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, isLoading: true, error: undefined } : s));
      try {
        const removePrompt = `This image has a region highlighted with a semi-transparent red overlay. ` +
          `Please remove and erase the content inside that red-highlighted area completely. ` +
          `Fill the removed area naturally with appropriate background content that matches ` +
          `the surrounding areas of the image. The result should look like the selected element ` +
          `was never in the scene. Do not add any new objects, text, or UI elements.`;
        const { base64Data, mimeType } = await editImage(
          result.annotatedImageBase64,   // full data URL with prefix
          removePrompt,
          generalContext
        );
        const newUrl = `data:${mimeType};base64,${base64Data}`;
        setScenes(prev => prev.map(s =>
          s.id === scene.id
            ? {
                ...s,
                isLoading: false,
                previousImageUrl: scene.imageUrl,
                previousImageMimeType: scene.imageMimeType,
                imageUrl: newUrl,
                imageMimeType: mimeType,
                accumulatedCostBRL: (s.accumulatedCostBRL ?? s.costBRL ?? 0),
                versionCount: (s.versionCount ?? 1) + 1,
              }
            : s
        ));
        showToast('Região removida com sucesso!', 'success');
      } catch (e: any) {
        const errorMessage = e instanceof Error ? e.message : 'Falha ao remover região.';
        setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, isLoading: false, error: errorMessage } : s));
        showToast('Erro ao remover região.', 'error');
      }
      return;
    }

    // ── EDIT action ──────────────────────────────────────────────────
    if (result.action === 'edit') {
      if (isCharacter) return;
      const scene = item as Scene;
      setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, isLoading: true, error: undefined } : s));
      try {
        // Send original clean image as source + annotated image as mask
        // Server handles the two-image inpainting prompt automatically
        const { base64Data, mimeType } = await editImage(
          scene.imageUrl!,
          result.editInstruction,
          generalContext,
          result.annotatedImageBase64
        );
        const newUrl = `data:${mimeType};base64,${base64Data}`;
        setScenes(prev => prev.map(s =>
          s.id === scene.id
            ? { ...s, isLoading: false, previousImageUrl: scene.imageUrl, previousImageMimeType: scene.imageMimeType, imageUrl: newUrl, imageMimeType: mimeType, accumulatedCostBRL: (s.accumulatedCostBRL ?? s.costBRL ?? 0), versionCount: (s.versionCount ?? 1) + 1 }
            : s
        ));
        showToast('Região editada com sucesso!', 'success');
      } catch (e: any) {
        const errorMessage = e instanceof Error ? e.message : 'Falha ao editar região.';
        setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, isLoading: false, error: errorMessage } : s));
        showToast('Erro ao editar região.', 'error');
      }
      return;
    }

    // ── ANALYZE action ───────────────────────────────────────────────
    const region = result.region;

    if (isCharacter) {
      setCharacters(prev => prev.map(c => c.name === (item as Character).name ? { ...c, isAnalyzingText: true, error: undefined } : c));
    } else {
      setScenes(prev => prev.map(s => s.id === (item as Scene).id ? { ...s, isAnalyzingText: true, error: undefined } : s));
    }

    let imageDataForAnalysis = item.imageUrl!;

    if (region) {
        try {
            imageDataForAnalysis = await new Promise<string>((resolve, reject) => {
                const image = new Image();
                if (!item.imageUrl!.startsWith('data:')) {
                    image.crossOrigin = 'anonymous';
                }
                image.onload = () => {
                    const natW = image.naturalWidth;
                    const natH = image.naturalHeight;
                    if (!natW || !natH) {
                        return reject(new Error('Dimensões da imagem indisponíveis.'));
                    }
                    const displayW = image.width  || natW;
                    const displayH = image.height || natH;
                    const scaleX = natW / displayW;
                    const scaleY = natH / displayH;

                    const cropX = Math.round(region.x * scaleX);
                    const cropY = Math.round(region.y * scaleY);
                    const cropW = Math.min(Math.round(region.width  * scaleX), natW - cropX);
                    const cropH = Math.min(Math.round(region.height * scaleY), natH - cropY);

                    if (cropW <= 0 || cropH <= 0) {
                        return reject(new Error('Região de corte inválida.'));
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width  = cropW;
                    canvas.height = cropH;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('Canvas 2D não disponível.'));
                    ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                    resolve(canvas.toDataURL(item.imageMimeType || 'image/png'));
                };
                image.onerror = () => reject(new Error('Falha ao carregar imagem para recorte.'));
                image.src = item.imageUrl!;
            });
        } catch (cropError) {
            console.error('Failed to crop image', cropError);
            const errorMessage = cropError instanceof Error ? cropError.message : 'Falha ao preparar a imagem para análise.';
            if (isCharacter) {
                setCharacters(prev => prev.map(c => c.name === (item as Character).name ? { ...c, isAnalyzingText: false, error: errorMessage } : c));
            } else {
                setScenes(prev => prev.map(s => s.id === (item as Scene).id ? { ...s, isAnalyzingText: false, error: errorMessage } : s));
            }
            return;
        }
    }

    try {
      const analysisResult = await analyzeImageText(imageDataForAnalysis, item.image_prompt);
      setAnalysisModalState({ item, result: analysisResult });
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
  }, [regionSelectorState, showToast]);
  
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
  
  /* ── Abordagem A: Regenera a cena inteira com prompt corrigido ─── */
  const handleRegenerateWithCorrection = useCallback(async (
    item: Character | Scene,
    originalText: string,
    correction: string,
  ) => {
    const isScene = 'scene_id' in item;
    if (!isScene) {
      // Personagens: fallback para edição direta (inpainting genérico)
      const prompt = `CORREÇÃO DE TEXTO: Encontre o texto "${originalText}" na imagem e substitua por "${correction}". Preserve fonte, cor, tamanho e posição originais. Não altere nenhum outro elemento.`;
      await handleApplyTextCorrection(item, originalText, correction);
      return;
    }

    const scene = item as Scene;
    // Monta prompt com instrução explícita de correção anexada
    const correctedPrompt = `${scene.image_prompt}\n\n[CORREÇÃO OBRIGATÓRIA]: O texto "${originalText}" DEVE ser renderizado exatamente como "${correction}" — verifique a ortografia antes de renderizar qualquer texto.`;

    // Atualiza o prompt salvo na cena para que futuras gerações usem o correto
    setScenes(prev => prev.map(s =>
      s.id === scene.id ? { ...s, image_prompt: correctedPrompt } : s
    ));
    setAnalysisModalState(null);

    // Gera com o prompt corrigido (mantém referências de personagens)
    await handleGenerateSceneImageWithReference(scene.id, correctedPrompt, null, null);
  }, [handleApplyTextCorrection, handleGenerateSceneImageWithReference]);

  /* ── Abordagem B: Inpainting seletivo na região do erro ─────────── */
  const handleInpaintCorrection = useCallback(async (
    item: Character | Scene,
    error: TextError,
  ) => {
    if (!item.imageUrl || !error.boundingBox) return;
    const isCharacter = 'name' in item;
    const bb: BoundingBox = error.boundingBox;

    // Marca como carregando
    if (isCharacter) {
      setCharacters(prev => prev.map(c => c.name === (item as Character).name ? { ...c, isLoading: true, error: undefined } : c));
    } else {
      setScenes(prev => prev.map(s => s.id === (item as Scene).id ? { ...s, isLoading: true, error: undefined } : s));
    }
    setAnalysisModalState(null);

    try {
      // 1. Carrega a imagem completa no canvas e recorta a região com padding
      const fullDataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        if (!item.imageUrl!.startsWith('data:')) img.crossOrigin = 'anonymous';
        img.onload = () => {
          const natW = img.naturalWidth;
          const natH = img.naturalHeight;

          // Padding de 15% ao redor da bounding box para dar contexto ao modelo
          const PAD = 0.15;
          const x0 = Math.max(0, bb.x - PAD * bb.w);
          const y0 = Math.max(0, bb.y - PAD * bb.h);
          const x1 = Math.min(1, bb.x + bb.w + PAD * bb.w);
          const y1 = Math.min(1, bb.y + bb.h + PAD * bb.h);

          const px = Math.round(x0 * natW);
          const py = Math.round(y0 * natH);
          const pw = Math.round((x1 - x0) * natW);
          const ph = Math.round((y1 - y0) * natH);

          const canvas = document.createElement('canvas');
          canvas.width  = pw;
          canvas.height = ph;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, px, py, pw, ph, 0, 0, pw, ph);
          resolve(canvas.toDataURL(item.imageMimeType || 'image/png'));
        };
        img.onerror = () => reject(new Error('Falha ao carregar imagem para inpainting.'));
        img.src = item.imageUrl!;
      });

      // 2. Chama o modelo de edição apenas sobre o patch recortado
      const focusedPrompt = `INPAINTING CIRÚRGICO — esta imagem é um recorte de uma cena maior.
TAREFA: Substitua o texto "${error.originalText}" por "${error.suggestedCorrection}".
REGRAS ESTRITAS:
• Preserve exatamente a fonte, cor, tamanho, estilo e posição do texto original.
• Não altere nenhum outro elemento visual — fundo, cores, personagens, iluminação.
• O texto corrigido deve parecer que sempre esteve lá.
• NÃO adicione, remova ou mova nenhum elemento além do texto especificado.`;

      const { base64Data: patchB64, mimeType: patchMime } = await handleEditImageWrapper(fullDataUrl, focusedPrompt);
      const patchDataUrl = `data:${patchMime};base64,${patchB64}`;

      // 3. Compõe o patch corrigido de volta na imagem original
      const composedDataUrl = await new Promise<string>((resolve, reject) => {
        const fullImg  = new Image();
        const patchImg = new Image();
        if (!item.imageUrl!.startsWith('data:')) fullImg.crossOrigin = 'anonymous';

        let loadedCount = 0;
        const onBothLoaded = () => {
          const natW = fullImg.naturalWidth;
          const natH = fullImg.naturalHeight;

          // Área do patch (com padding igual ao usado no crop)
          const PAD = 0.15;
          const x0 = Math.max(0, bb.x - PAD * bb.w);
          const y0 = Math.max(0, bb.y - PAD * bb.h);
          const x1 = Math.min(1, bb.x + bb.w + PAD * bb.w);
          const y1 = Math.min(1, bb.y + bb.h + PAD * bb.h);

          const px = Math.round(x0 * natW);
          const py = Math.round(y0 * natH);
          const pw = Math.round((x1 - x0) * natW);
          const ph = Math.round((y1 - y0) * natH);

          const canvas = document.createElement('canvas');
          canvas.width  = natW;
          canvas.height = natH;
          const ctx = canvas.getContext('2d')!;

          // Desenha imagem original
          ctx.drawImage(fullImg, 0, 0, natW, natH);
          // Sobrepõe o patch corrigido na posição exata
          ctx.drawImage(patchImg, px, py, pw, ph);

          resolve(canvas.toDataURL(item.imageMimeType || 'image/png'));
        };

        const onLoad = () => { loadedCount++; if (loadedCount === 2) onBothLoaded(); };
        const onError = () => reject(new Error('Falha ao compor imagem corrigida.'));

        fullImg.onload  = onLoad;  fullImg.onerror  = onError;
        patchImg.onload = onLoad;  patchImg.onerror = onError;
        fullImg.src  = item.imageUrl!;
        patchImg.src = patchDataUrl;
      });

      // 4. Extrai mime/base64 e atualiza a cena
      const comma = composedDataUrl.indexOf(',');
      const composedMime  = composedDataUrl.slice(5, composedDataUrl.indexOf(';'));
      const composedB64   = composedDataUrl.slice(comma + 1);
      const finalUrl      = `data:${composedMime};base64,${composedB64}`;

      if (isCharacter) {
        handleCharacterImageUpdate((item as Character).name, finalUrl, composedMime);
      } else {
        handleSceneImageUpdate((item as Scene).id, finalUrl, composedMime);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha no inpainting.';
      if (isCharacter) {
        setCharacters(prev => prev.map(c => c.name === (item as Character).name ? { ...c, error: msg } : c));
      } else {
        setScenes(prev => prev.map(s => s.id === (item as Scene).id ? { ...s, error: msg } : s));
      }
    } finally {
      if (isCharacter) {
        setCharacters(prev => prev.map(c => c.name === (item as Character).name ? { ...c, isLoading: false } : c));
      } else {
        setScenes(prev => prev.map(s => s.id === (item as Scene).id ? { ...s, isLoading: false } : s));
      }
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

  const handleToggleTheme = useCallback((newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    // Apply to both the html element (for body:has) and store
    document.documentElement.setAttribute('data-theme', newTheme);
    try { localStorage.setItem('app-theme', newTheme); } catch {}
  }, []);


  const isDone = processingState === 'done';
  const localGeminiApiKey = getStoredApiKey();
  const hasLocalGeminiApiKey = !!localGeminiApiKey;
  const hasApiKey = hasLocalGeminiApiKey || Boolean(currentUser && hasServerPlatformKey);
  const apiSourceInfo = (() => {
    if (hasLocalGeminiApiKey) {
      return {
        label: 'Gemini API própria local',
        description: 'As chamadas usam a chave salva neste navegador. Ela tem prioridade sobre a conta logada e aparece no histórico como API própria local.',
      };
    }

    if (currentUser?.aiBillingMode === 'user_key') {
      if (currentUser.hasGeminiApiKey) {
        return {
          label: 'Gemini API própria salva',
          description: 'As chamadas usam a chave criptografada salva na sua conta. O custo de IA fica direto no seu provedor.',
        };
      }

      return {
        label: 'API própria pendente',
        description: 'O modo BYOK está ativo, mas nenhuma chave Gemini foi salva na conta. Configure a chave antes de gerar.',
      };
    }

    if (currentUser && hasServerPlatformKey) {
      return {
        label: 'Gemini API da plataforma',
        description: `As chamadas usam a chave da plataforma e consomem créditos do plano ${currentUser.plan?.name || currentUser.planId}.`,
      };
    }

    return {
      label: 'IA não configurada',
      description: 'Entre para usar créditos da plataforma ou configure uma API Key Gemini própria.',
    };
  })();

  return (
    <div className="app-layout">

      {/* ══════════════════════════════════════════════════════════
          LEFT SIDEBAR — navigation only
      ══════════════════════════════════════════════════════════ */}
      <aside className="sidebar">

        {/* ── Brand ── */}
        <div style={{padding:'14px 14px 12px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:28,height:28,borderRadius:7,background:'var(--indigo)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <SparklesIcon width={14} height={14} />
            </div>
            <div style={{minWidth:0}}>
              <p style={{fontSize:13,fontWeight:700,color:'var(--text-1)',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Estúdio Visual</p>
              <p style={{fontSize:10,color:'var(--text-4)',lineHeight:1.2}}>Powered by Gemini</p>
            </div>
          </div>

          {file && isDone && (
            <div style={{marginTop:10,padding:'4px 8px',borderRadius:6,background:'var(--surface-2)',border:'1px solid var(--border)',display:'flex',alignItems:'center',gap:6}}>
              <div className="dot-live" style={{flexShrink:0}} />
              <span style={{fontSize:11,color:'var(--text-2)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{file.name}</span>
            </div>
          )}
        </div>

        {/* ── Primary nav ── */}
        <nav style={{flex:1,padding:'8px 0',overflowY:'auto'}}>

          <span className="sidebar-label">Criar</span>
          <button className="sidebar-item" onClick={() => { setFile(null); resetState(); }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Novo projeto
          </button>
          <button className="sidebar-item" onClick={() => setIsScriptPasteOpen(true)}>
            <SparklesIcon width={15} height={15} />
            Colar roteiro
          </button>
          <button className="sidebar-item" onClick={() => csvInputRef.current?.click()}>
            <UploadIcon width={15} height={15} />
            Importar CSV/DOCX
          </button>
          <input
            ref={csvInputRef}
            type="file"
            className="hidden"
            accept=".csv,.docx,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) handleFileChange(selected);
              e.currentTarget.value = '';
            }}
          />

          {isDone && (
            <>
              <span className="sidebar-label" style={{marginTop:8}}>Produção</span>
              {([
                { id: 'characters' as const, label: 'Personagens', count: characters.length,
                  icon: <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="19" cy="11" r="2"/><path d="M23 21v-1a2 2 0 0 0-2-2h-1"/></svg> },
                { id: 'scenes' as const, label: 'Cenas', count: scenes.length,
                  icon: <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg> },
                { id: 'costs' as const, label: 'Custos', count: null,
                  icon: <CostReportIcon width={15} height={15} /> },
              ]).map(item => (
                <button key={item.id} onClick={() => setActiveView(item.id)} className={`sidebar-item${activeView === item.id ? ' active' : ''}`}>
                  {item.icon}
                  <span style={{flex:1}}>{item.label}</span>
                  {item.count !== null && <span className="sidebar-badge">{item.count}</span>}
                </button>
              ))}
              <button className={`sidebar-item${showRightPanel ? ' active' : ''}`} onClick={() => setShowRightPanel(v => !v)}>
                <SettingsIcon width={15} height={15} />
                Propriedades
              </button>
            </>
          )}

          <span className="sidebar-label" style={{marginTop:8}}>Biblioteca</span>
          <label htmlFor="sidebar-project-upload" className="sidebar-item" style={{cursor:'pointer'}}>
            <FolderOpenIcon width={15} height={15} />
            Abrir .zip
          </label>
          <input ref={projectInputRef} type="file" id="sidebar-project-upload" className="hidden" accept=".zip,application/zip" onChange={handleProjectFileChange} />
          {isDone && (
            <>
              <button className="sidebar-item" onClick={() => setIsGalleryOpen(true)}>
                <GalleryIcon width={15} height={15} />
                Galeria
              </button>
              <button className="sidebar-item" onClick={handleSaveProjectToCloud}>
                <ArchiveIcon width={15} height={15} />
                {cloudSaveStatus || (currentUser ? 'Salvar na nuvem' : 'Entrar para salvar')}
              </button>
              <button className="sidebar-item" onClick={handleExportProject} disabled={isDownloading}>
                <ArchiveIcon width={15} height={15} />
                {isDownloading ? 'Exportando…' : 'Exportar'}
              </button>
            </>
          )}
        </nav>

        {/* ── Bottom utilities ── */}
        <div style={{padding:'10px 10px 14px',borderTop:'1px solid var(--border)',flexShrink:0}}>
          <span className="sidebar-label" style={{padding:'0 4px 6px'}}>Conta</span>
          {/* Theme toggle */}
          <div style={{display:'flex',gap:2,padding:3,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,marginBottom:6}}>
            {([
              { value: 'dark'  as const, Icon: MoonIcon, label: 'Escuro' },
              { value: 'light' as const, Icon: SunIcon,  label: 'Claro'  },
            ]).map(({ value, Icon, label }) => (
              <button key={value} onClick={() => handleToggleTheme(value)} title={label} style={{
                flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                padding:'5px 6px', borderRadius:6, fontSize:11, fontWeight:500,
                border: theme === value ? '1px solid var(--border-md)' : '1px solid transparent',
                background: theme === value ? 'var(--surface)' : 'transparent',
                color: theme === value ? 'var(--text-1)' : 'var(--text-3)',
                cursor:'pointer', transition:'all .12s ease',
                boxShadow: theme === value ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
              }}>
                <Icon width={11} height={11} />
                {label}
              </button>
            ))}
          </div>
          <button className="sidebar-item" onClick={() => setIsSettingsOpen(true)}>
            <SettingsIcon width={15} height={15} />
            Configurações
          </button>
          {currentUser && (
            <button className="sidebar-item" onClick={() => setIsAccountOpen(true)}>
              <CostReportIcon width={15} height={15} />
              Plano e uso
            </button>
          )}
          <button
            className="sidebar-item"
            onClick={() => currentUser ? (clearAuthToken().finally(() => {}), setCurrentUser(null), setCloudProjectId(null)) : setIsAuthOpen(true)}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {currentUser ? 'Sair' : 'Entrar'}
          </button>
          {currentUser && (
            <button
              onClick={() => setIsAccountOpen(true)}
              style={{
                width: '100%', textAlign: 'left', cursor: 'pointer',
                marginTop: 8, padding: 8, borderRadius: 8,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5,
              }}
            >
              <p style={{ color: 'var(--text-1)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</p>
              <p>{currentUser.planId} · {currentUser.creditBalance} créditos</p>
              <p>{currentUser.aiBillingMode === 'user_key'
                ? 'API própria'
                : platformProvider === 'vertex_express' || platformProvider === 'vertex'
                  ? 'Vertex AI'
                  : platformProvider === 'api_key'
                    ? 'Google AI Studio'
                    : 'API da plataforma'}</p>
            </button>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════
          CONTENT AREA
      ══════════════════════════════════════════════════════════ */}
      <div className="content-area">

      {/* ── Topbar ── */}
      <header className="topbar">
        {/* Breadcrumb */}
        <div style={{flex:1,display:'flex',alignItems:'center',gap:6,minWidth:0}}>
          {isDone ? (
            <>
              <span style={{fontSize:11,color:'var(--text-4)',whiteSpace:'nowrap'}}>Estúdio Visual</span>
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{color:'var(--text-4)',flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
              <span style={{fontSize:12,fontWeight:600,color:'var(--text-1)',whiteSpace:'nowrap'}}>
                {activeView === 'characters' && 'Personagens'}
                {activeView === 'scenes'     && 'Cenas'}
                {activeView === 'costs'      && 'Relatório de Custos'}
              </span>
              {/* Inline batch progress indicator (minimal — full bar is floating below) */}
              {batchProgress && (
                <>
                  <div className="topbar-sep" style={{marginLeft:4}} />
                  <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0}}>
                    <div style={{width:8,height:8,border:'2px solid var(--indigo-b)',borderTopColor:'var(--indigo)',borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0}} />
                    <span style={{fontFamily:'var(--mono)',fontSize:10,color:'#818CF8',flexShrink:0,whiteSpace:'nowrap'}}>{batchProgress.current}/{batchProgress.total}</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <span style={{fontSize:12,fontWeight:600,color:'var(--text-2)'}}>Início</span>
          )}
        </div>

        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          <button
            className="btn btn-ghost"
            style={{fontSize:12,padding:'5px 10px'}}
            onClick={() => currentUser ? setIsAccountOpen(true) : setIsAuthOpen(true)}
            title={currentUser ? 'Abrir conta, plano e uso' : 'Entrar na conta'}
          >
            {currentUser ? `${currentUser.plan?.name || currentUser.planId} · ${currentUser.creditBalance}` : 'Entrar'}
          </button>
          <button
            className="btn btn-ghost"
            style={{fontSize:12,padding:'5px 10px'}}
            onClick={() => setIsSettingsOpen(true)}
            title="Configurar API, prompts e preferências"
          >
            <SettingsIcon width={13} height={13} />
            Ajustes
          </button>
        </div>

        {/* Primary actions */}
        {isDone && activeView === 'characters' && (
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            <button onClick={handleReloadCharacters} disabled={isReloadingChars || isGeneratingAllChars} className="btn btn-ghost" style={{fontSize:12}}>
              {isReloadingChars ? <div style={{width:12,height:12,border:'2px solid var(--border-md)',borderTopColor:'var(--text-2)',borderRadius:'50%',animation:'spin .8s linear infinite'}} /> : <ReloadIcon width={13} height={13} />}
              {isReloadingChars ? 'Recarregando…' : 'Recarregar'}
            </button>
            <button onClick={handleGenerateAllCharacterImages} disabled={isGeneratingAllChars || isReloadingChars} className="btn btn-primary" style={{fontSize:12}}>
              {isGeneratingAllChars ? <div style={{width:12,height:12,border:'2px solid rgba(255,255,255,.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .8s linear infinite'}} /> : <SparklesIcon width={13} height={13} />}
              {isGeneratingAllChars ? 'Gerando…' : 'Gerar Todos'}
            </button>
          </div>
        )}
        {isDone && activeView === 'scenes' && (
          <button onClick={handleGenerateAllSceneImages} disabled={isGeneratingAllScenes} className="btn btn-primary" style={{fontSize:12,flexShrink:0}}>
            {isGeneratingAllScenes ? <div style={{width:12,height:12,border:'2px solid rgba(255,255,255,.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .8s linear infinite'}} /> : <SparklesIcon width={13} height={13} />}
            {isGeneratingAllScenes ? 'Gerando…' : 'Gerar Todas'}
          </button>
        )}

        {/* Panel toggle (only when project loaded) */}
        {isDone && (
          <>
            <div className="topbar-sep" />
            <button
              className={`icon-btn${showRightPanel ? ' active' : ''}`}
              onClick={() => setShowRightPanel(v => !v)}
              title={showRightPanel ? 'Ocultar painel' : 'Mostrar painel de propriedades'}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            </button>
          </>
        )}
      </header>

      <main style={{flex:1,padding:0,overflowY:'auto'}}>

        {!file && (
          <div className="workspace-shell anim-up">
            <CreditAlert
              user={currentUser}
              hasPlatformKey={hasServerPlatformKey}
              platformProvider={platformProvider}
              hasLocalApiKey={hasLocalGeminiApiKey}
              onConfigure={() => setIsSettingsOpen(true)}
              onLogin={() => setIsAuthOpen(true)}
              onAccount={() => setIsAccountOpen(true)}
            />

            <div className="hero-workspace">
              <section className="hero-copy elevated">
                <div>
                  <div className="hero-kicker">
                    <SparklesIcon width={12} height={12} />
                    Direção visual com IA
                  </div>
                  <h1 className="hero-title">
                    Transforme roteiros em{' '}
                    <span className="text-gradient-cinema">storyboards visuais</span>
                    {' '}com IA.
                  </h1>
                  <p className="hero-subtitle">
                    Cole um roteiro ou importe CSV/DOCX. A IA identifica cenas, personagens e gera prompts visuais consistentes — do briefing à galeria em minutos.
                  </p>
                  <div className="hero-actions">
                    <button className="btn btn-primary btn-lg" onClick={() => setIsScriptPasteOpen(true)}>
                      <SparklesIcon width={15} height={15} />
                      Criar storyboard
                    </button>
                    <button className="btn btn-ghost btn-lg" onClick={() => setIsSettingsOpen(true)}>
                      <SettingsIcon width={15} height={15} />
                      Configurar IA
                    </button>
                    {!currentUser && (
                      <button className="btn btn-ghost btn-lg" onClick={() => setIsAuthOpen(true)}>
                        Entrar
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="metric-row">
                    <div className="metric-card" title="Limite de cenas por roteiro neste plano">
                      <strong style={{color: 'var(--indigo)'}}>
                        {currentUser?.plan?.maxScenesPerScript || (hasLocalGeminiApiKey ? '∞' : 20)}
                      </strong>
                      <span>cenas por roteiro</span>
                    </div>
                    <div
                      className="metric-card"
                      style={{cursor: currentUser ? 'pointer' : 'default'}}
                      onClick={() => currentUser ? setIsAccountOpen(true) : undefined}
                      title={currentUser ? 'Ver uso e plano' : 'Configure sua API Key'}
                    >
                      <strong style={{color: currentUser ? 'var(--green)' : 'var(--cyan)'}}>
                        {currentUser ? currentUser.creditBalance.toLocaleString('pt-BR') : 'BYOK'}
                      </strong>
                      <span>{currentUser ? 'créditos' : 'sua API key'}</span>
                    </div>
                    <div className="metric-card" title="Projetos salvos neste navegador">
                      <strong style={{color: history.length > 0 ? 'var(--text-1)' : 'var(--text-4)'}}>
                        {history.length}
                      </strong>
                      <span>projetos salvos</span>
                    </div>
                  </div>
                </div>
              </section>

              <ProjectStartCard
                hasApiKey={hasApiKey}
                currentUser={currentUser}
                onPasteScript={() => setIsScriptPasteOpen(true)}
                onConfigureAi={() => setIsSettingsOpen(true)}
                onLogin={() => setIsAuthOpen(true)}
                onAccount={() => setIsAccountOpen(true)}
                onFileSelect={handleFileChange}
                projectUploadInputId="sidebar-project-upload"
              />
            </div>

            <FlowStepper />

            <ScriptPreviewShowcase onTryNow={() => setIsScriptPasteOpen(true)} />

            <HistoryLoader history={history} onLoad={handleLoadFromHistory} onClear={handleClearHistory} />
            <PricingNotice
              user={currentUser}
              onLogin={() => setIsAuthOpen(true)}
              onAccount={() => setIsAccountOpen(true)}
              onConfigure={() => setIsSettingsOpen(true)}
            />
            <QuickAnalyzer />
          </div>
        )}
        
        {file && processingState === 'idle' && (
          <div className="anim-up" style={{paddingTop:80,display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
            <div style={{
              display:'flex',alignItems:'center',gap:10,
              padding:'8px 16px',borderRadius:8,
              background:'var(--surface)',border:'1px solid var(--border)',
            }}>
              <div className="dot-live" />
              <span style={{fontSize:13,color:'var(--text-2)'}}>
                <span style={{fontWeight:500,color:'var(--text-1)'}}>{file.name}</span> pronto para análise
              </span>
              <button
                onClick={() => { setFile(null); resetState(); }}
                style={{marginLeft:8,fontSize:12,color:'var(--text-4)',cursor:'pointer',background:'none',border:'none',padding:0}}
              >
                ✕
              </button>
            </div>
            <button
              onClick={() => setShowStyleModal(true)}
              disabled={!isLoaded}
              className="btn btn-primary btn-xl"
            >
              <SparklesIcon width={16} height={16} />
              Analisar com IA
            </button>
            {!isLoaded && <p style={{fontSize:12,color:'var(--text-4)'}}>Carregando configurações…</p>}
          </div>
        )}

        {processingState === 'reviewing' && storyboardRows.length > 0 && (
          <div className="anim-fade" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 0 48px' }}>
            <StoryboardReviewView
              rows={storyboardRows}
              fileName={file?.name}
              onConfirm={handleConfirmStructure}
              isLoading={false}
            />
          </div>
        )}

        {processingState !== 'idle' && processingState !== 'done' && processingState !== 'error' && processingState !== 'reviewing' && (
          <Loader message={processingMessage} />
        )}

        {error && (
          <div className="anim-fade" style={{
            maxWidth:560,margin:'48px auto',padding:24,
            background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:10,
            textAlign:'center'
          }}>
            <p style={{fontSize:14,fontWeight:600,color:'#F87171',marginBottom:6}}>Ocorreu um erro</p>
            <p style={{fontSize:13,color:'rgba(248,113,113,0.7)',whiteSpace:'pre-wrap',lineHeight:1.6}}>{error}</p>
            <button
              onClick={() => { setFile(null); resetState(); }}
              className="btn btn-primary"
              style={{marginTop:16}}
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {processingState === 'done' && showAnalysisReport && (
          <AnalysisReportView
            characters={characters}
            scenes={scenes}
            fileName={file?.name ?? ''}
            globalStyle={globalStyle?.label ?? ''}
            onContinue={() => setShowAnalysisReport(false)}
            onNavigate={(view) => setActiveView(view)}
          />
        )}

        {processingState === 'done' && !showAnalysisReport && (
          <div className="results-shell">
            <div className="results-summary">
              <div className="summary-tile">
                <span>Personagens</span>
                <strong>{characters.length}</strong>
              </div>
              <div className="summary-tile">
                <span>Cenas</span>
                <strong>{scenes.length}</strong>
              </div>
              <div className="summary-tile">
                <span>Imagens</span>
                <strong>{characters.filter(c => c.imageUrl).length + scenes.filter(s => s.imageUrl).length}</strong>
              </div>
              <div className="summary-tile">
                <span>Custo texto</span>
                <strong>R$ {textCosts.reduce((sum, item) => sum + item.costBRL, 0).toFixed(2).replace('.', ',')}</strong>
              </div>
              <button
                onClick={() => setShowAnalysisReport(true)}
                title="Ver relatório da análise"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  color: 'var(--text-3)', fontSize: 12, fontWeight: 600,
                  transition: 'all 0.12s', whiteSpace: 'nowrap',
                }}
              >
                ← Relatório
              </button>
            </div>

            {activeView === 'characters' && (
              <section className="anim-fade">
                <div className="section-hd" style={{marginBottom:14}}>
                  <div>
                    <p className="section-title">Personagens</p>
                    <p className="section-sub">{characters.length} personagem{characters.length !== 1 ? 's' : ''} detectado{characters.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {/* Hint banner: shown only when no characters have images yet */}
                {characters.length > 0 && !characters.some(c => c.imageUrl) && !isGeneratingAllChars && (
                  <div style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 16px', marginBottom:14, borderRadius:10,
                    background:'var(--indigo-s)', border:'1px solid var(--indigo-b)',
                    animation:'slideUp .22s cubic-bezier(0.2,0,0,1) both',
                  }}>
                    <div style={{
                      width:36, height:36, borderRadius:9, flexShrink:0,
                      background:'rgba(79,140,255,0.15)', border:'1px solid var(--indigo-b)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <SparklesIcon width={16} height={16} />
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <p style={{fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:2}}>
                        {characters.length} personagem{characters.length !== 1 ? 's' : ''} sem retrato
                      </p>
                      <p style={{fontSize:11, color:'var(--text-3)', lineHeight:1.5}}>
                        Gere os retratos para usar como referência visual nas cenas. Clique em <strong style={{color:'var(--text-2)'}}>Gerar Todos</strong> para começar.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateAllCharacterImages}
                      disabled={isGeneratingAllChars || isReloadingChars}
                      className="btn btn-primary"
                      style={{fontSize:12, flexShrink:0}}
                    >
                      <SparklesIcon width={13} height={13} />
                      Gerar Todos
                    </button>
                  </div>
                )}
                <div className="stagger" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
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
                      onSelectImageVersion={handleSelectCharacterImageVersion}
                      onIsolateImage={handleIsolateCharacter}
                      onAnalyzeText={handleStartTextAnalysis}
                    />
                  ))}
                </div>
              </section>
            )}

            {activeView === 'costs' && (
              <section className="anim-fade">
                <div className="section-hd" style={{marginBottom:16}}>
                  <div>
                    <p className="section-title">Relatório de Custos</p>
                    <p className="section-sub">Consumo de tokens e custo estimado por chamada de API neste projeto.</p>
                  </div>
                </div>
                <CostReportView
                  characters={characters}
                  scenes={scenes}
                  textCosts={textCosts}
                  apiSourceLabel={apiSourceInfo.label}
                  apiSourceDescription={apiSourceInfo.description}
                />
              </section>
            )}

            {activeView === 'scenes' && (
              <section className="anim-fade">
                <div className="section-hd" style={{marginBottom:14}}>
                  <div>
                    <p className="section-title">Cenas</p>
                    <p className="section-sub">{scenes.length} cena{scenes.length !== 1 ? 's' : ''} no roteiro</p>
                  </div>
                  {/* View mode toggle */}
                  <div style={{display:'flex',gap:2,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:2}}>
                    <button
                      onClick={() => setScenesViewMode('cards')}
                      title="Visualização em cards"
                      style={{
                        padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer',
                        background: scenesViewMode === 'cards' ? 'var(--indigo)' : 'transparent',
                        color: scenesViewMode === 'cards' ? '#fff' : 'var(--text-4)',
                        display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600,
                        transition:'all .15s',
                      }}
                    >
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                      </svg>
                      Cards
                    </button>
                    <button
                      onClick={() => setScenesViewMode('table')}
                      title="Visualização em tabela"
                      style={{
                        padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer',
                        background: scenesViewMode === 'table' ? 'var(--indigo)' : 'transparent',
                        color: scenesViewMode === 'table' ? '#fff' : 'var(--text-4)',
                        display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600,
                        transition:'all .15s',
                      }}
                    >
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <line x1="3" y1="9" x2="21" y2="9"/>
                        <line x1="3" y1="15" x2="21" y2="15"/>
                        <line x1="9" y1="3" x2="9" y2="21"/>
                      </svg>
                      Tabela
                    </button>
                  </div>
                </div>
                {/* Hint banner: shown only when no scenes have images yet */}
                {scenes.length > 0 && !scenes.some(s => s.imageUrl) && !isGeneratingAllScenes && (
                  <div style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 16px', marginBottom:14, borderRadius:10,
                    background:'var(--indigo-s)', border:'1px solid var(--indigo-b)',
                    animation:'slideUp .22s cubic-bezier(0.2,0,0,1) both',
                  }}>
                    <div style={{
                      width:36, height:36, borderRadius:9, flexShrink:0,
                      background:'rgba(79,140,255,0.15)', border:'1px solid var(--indigo-b)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <SparklesIcon width={16} height={16} />
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <p style={{fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:2}}>
                        {scenes.length} cena{scenes.length !== 1 ? 's' : ''} pronta{scenes.length !== 1 ? 's' : ''} para visualizar
                      </p>
                      <p style={{fontSize:11, color:'var(--text-3)', lineHeight:1.5}}>
                        Clique em <strong style={{color:'var(--text-2)'}}>Gerar Todas</strong> no cabeçalho para visualizar todas as cenas em sequência, ou gere cena por cena individualmente.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateAllSceneImages}
                      disabled={isGeneratingAllScenes}
                      className="btn btn-primary"
                      style={{fontSize:12, flexShrink:0}}
                    >
                      <SparklesIcon width={13} height={13} />
                      Gerar Todas
                    </button>
                  </div>
                )}
                {scenesViewMode === 'table' && (
                  <SceneTableView scenes={scenes} fileName={file?.name} />
                )}
                <div style={{display: scenesViewMode === 'table' ? 'none' : 'flex', flexDirection:'column',gap:12}}>
                  {scenes.map((scene, index) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      scenes={scenes}
                      characters={characters}
                      sceneIndex={index}
                      availableStyles={availableStyles}
                      onImageUpdate={handleSceneImageUpdate}
                      onVisualize={handleGenerateSceneImage}
                      onVisualizeWithReference={handleGenerateSceneImageWithReference}
                      editImageService={handleEditImageWrapper}
                      onPreview={handleImagePreview}
                      onPromptChange={handleScenePromptChange}
                      onStyleChange={handleSceneStyleChange}
                      onSceneVisualStyleChange={handleSceneVisualStyleChange}
                      onSceneCameraPositionChange={handleSceneCameraPositionChange}
                      onSceneCharacterEdit={handleSceneCharacterEdit}
                      onContinuationChange={handleSceneContinuationChange}
                      onContinuationReferenceChange={handleContinuationReferenceChange}
                      onUpdatePrompt={handleUpdateScenePrompt}
                      onRecreatePrompt={handleRecreateScenePrompt}
                      onRevertImage={handleRevertSceneImage}
                      onAnalyzeText={handleStartTextAnalysis}
                      onEditRegion={handleStartRegionEdit}
                      onSplitScene={handleSplitScene}
                      onClearSplit={handleClearSplit}
                      onApplyAlternativePrompt={handleApplyAlternativePrompt}
                      onApplySplitSuggestion={handleApplySplitSuggestion}
                      onGenerateEndFrame={handleGenerateEndFrame}
                      onUpdateSplitImage={handleUpdateSplitImage}
                      onOpenGraphicStyle={(id) => setGraphicStyleSceneId(id)}
                      onClearGraphicStyle={(id) => setScenes(prev => prev.map(s => s.id === id ? { ...s, sceneGraphicStyle: undefined } : s))}
                      onIncludeLetteringChange={handleIncludeLetteringChange}
                      onSceneReferencesChange={handleSceneReferencesChange}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ── Floating batch progress bar ── */}
      {batchProgress && (
        <BatchProgressBar
          current={batchProgress.current}
          total={batchProgress.total}
          itemName={batchProgress.currentItemName}
        />
      )}

      {/* ── Dynamic action log (bottom-right) ── */}
      <ActionLog
        entries={actionLog.entries}
        nowTick={actionLog.nowTick}
        onClear={actionLog.clear}
      />

      </div>{/* end content-area */}

      {/* ══════════════════════════════════════════════════════════
          RIGHT PANEL — generation properties
      ══════════════════════════════════════════════════════════ */}
      {isDone && (
        <aside className={`right-panel${showRightPanel ? '' : ' collapsed'}`}>

          {/* Header */}
          <div style={{padding:'14px 16px 12px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
            <p style={{fontSize:12,fontWeight:700,color:'var(--text-1)'}}>Propriedades</p>
            <p style={{fontSize:11,color:'var(--text-4)',marginTop:1}}>Configurações de geração</p>
          </div>

          <div style={{flex:1,overflowY:'auto',padding:'0 0 16px'}}>

            {/* ── Modelos ── */}
            <div className="panel-section">
              <p className="panel-section-title">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                Modelos IA
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div>
                  <label className="panel-field-label">Personagem</label>
                  <select value={characterImageModel} onChange={(e) => { setCharacterImageModel(e.target.value as ImageModel); setSelectedPresetId('custom'); }} className="field" style={{fontSize:12}}>
                    <option value="imagen-4.0-generate-001">Imagen 4</option>
                    <option value="gemini-2.5-flash-image">Nano Banana 2.5</option>
                    <option value="gemini-3.1-flash-image-preview">Nano Banana 3.1</option>
                    <option value="gemini-3-pro-image-preview">Nano Banana Pro</option>
                  </select>
                </div>
                <div>
                  <label className="panel-field-label">Cena</label>
                  <select value={imageModel} onChange={(e) => { setImageModel(e.target.value as ImageModel); setSelectedPresetId('custom'); }} className="field" style={{fontSize:12}}>
                    <option value="gemini-2.5-flash-image">Nano Banana 2.5</option>
                    <option value="gemini-3.1-flash-image-preview">Nano Banana 3.1</option>
                    <option value="imagen-4.0-generate-001">Imagen 4</option>
                    <option value="gemini-3-pro-image-preview">Nano Banana Pro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Imagem ── */}
            <div className="panel-section">
              <p className="panel-section-title">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Imagem
              </p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div>
                  <label className="panel-field-label">Proporção</label>
                  <select value={aspectRatio} onChange={(e) => { setAspectRatio(e.target.value); setSelectedPresetId('custom'); }} className="field" style={{fontSize:12}}>
                    <option value="16:9">16:9 — Cinema</option>
                    <option value="9:16">9:16 — Vertical</option>
                    <option value="1:1">1:1 — Quadrado</option>
                    <option value="4:3">4:3 — Clássico</option>
                    <option value="3:4">3:4 — Retrato</option>
                  </select>
                </div>
                <div>
                  <label className="panel-field-label">
                    Resolução
                    {(imageModel !== 'gemini-3-pro-image-preview' && characterImageModel !== 'gemini-3-pro-image-preview') && (
                      <span style={{color:'var(--text-4)',fontWeight:400}}> (Nano Banana Pro)</span>
                    )}
                  </label>
                  <select value={resolution} onChange={(e) => { setResolution(e.target.value as '1K'|'2K'|'4K'); setSelectedPresetId('custom'); }} disabled={imageModel !== 'gemini-3-pro-image-preview' && characterImageModel !== 'gemini-3-pro-image-preview'} className="field" style={{fontSize:12}}>
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Preset ── */}
            <div className="panel-section">
              <p className="panel-section-title">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                Preset
              </p>
              <select value={selectedPresetId} onChange={handlePresetChange} className="field" style={{fontSize:12,marginBottom:8}}>
                <option value="custom">Personalizado</option>
                {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{display:'flex',gap:6}}>
                <button onClick={handleSavePreset} className="btn btn-ghost" style={{flex:1,fontSize:12,justifyContent:'center'}}>Salvar</button>
                <button onClick={handleDeletePreset} disabled={selectedPresetId === 'custom'} className="btn btn-danger" style={{flex:1,fontSize:12,justifyContent:'center'}}>Excluir</button>
              </div>
            </div>

            {/* ── Idioma do texto na imagem ── */}
            <div className="panel-section">
              <div className="panel-section-title">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                Idioma na imagem
              </div>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'4px 0'}}>
                <div
                  onClick={() => setForcePortugueseText(v => !v)}
                  style={{
                    width: 32, height: 18, borderRadius: 99, flexShrink: 0,
                    background: forcePortugueseText ? 'var(--indigo)' : 'var(--surface-3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    position: 'relative', cursor: 'pointer',
                    transition: 'background .2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, left: forcePortugueseText ? 14 : 2,
                    width: 12, height: 12, borderRadius: '50%',
                    background: '#fff', transition: 'left .2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }} />
                </div>
                <span style={{fontSize:12,color:'var(--text-2)',flex:1}}>
                  Forçar português no texto
                </span>
                {forcePortugueseText && (
                  <span style={{fontSize:10,color:'#34D399',fontWeight:600}}>PT-BR</span>
                )}
              </label>
              {forcePortugueseText && (
                <p style={{fontSize:10,color:'var(--text-4)',lineHeight:1.5,marginTop:2}}>
                  Instrui o modelo a gerar placas, telas e letreiros em português. Resultado pode variar por modelo.
                </p>
              )}
            </div>

            {/* ── Contexto ── */}
            <div className="panel-section">
              <div className="panel-section-title">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Contexto Geral
                <span className="badge badge-indigo" style={{marginLeft:'auto',fontSize:9,padding:'0 5px'}}>IA</span>
              </div>
              <textarea
                value={generalContext}
                onChange={(e) => setGeneralContext(e.target.value)}
                className="field"
                rows={5}
                style={{resize:'vertical',fontSize:12,minHeight:'unset'}}
                placeholder="Descreva o estilo visual, paleta de cores, atmosfera cinematográfica… influencia todas as gerações de imagem."
              />
            </div>

            {/* ── Pricing ── */}
            <div style={{padding:'12px 16px'}}>
              <p className="panel-section-title" style={{marginBottom:8}}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Preços de referência
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {[
                  {label:'Nano Banana 2.5', price:'R$0,005 / 1k tokens', color:'#6366F1'},
                  {label:'Nano Banana 3.1', price:'R$0,005 / 1k tokens', color:'#8B5CF6'},
                  {label:'Nano Banana Pro', price:'R$0,003 / 1k tokens', color:'#A855F7'},
                  {label:'Imagen 4',        price:'R$0,232 / imagem',    color:'#F59E0B'},
                ].map(({label,price,color}) => (
                  <div key={label} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',borderRadius:6,background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                    <span style={{width:7,height:7,borderRadius:'50%',background:color,flexShrink:0}} />
                    <span style={{fontSize:12,fontWeight:600,color:'var(--text-2)',flex:1}}>{label}</span>
                    <span style={{fontSize:11,fontFamily:'var(--mono)',color:'#34D399'}}>{price}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </aside>
      )}

      <nav className="mobile-bottom-nav" aria-label="Navegação principal mobile">
        <button className={!file ? 'active' : ''} onClick={() => { setFile(null); resetState(); }}>
          <SparklesIcon width={15} height={15} />
          Início
        </button>
        <button className={isDone && activeView === 'characters' ? 'active' : ''} disabled={!isDone} onClick={() => setActiveView('characters')}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
          Pessoas
        </button>
        <button className={isDone && activeView === 'scenes' ? 'active' : ''} disabled={!isDone} onClick={() => setActiveView('scenes')}>
          <GalleryIcon width={15} height={15} />
          Cenas
        </button>
        <button className={isDone && activeView === 'costs' ? 'active' : ''} disabled={!isDone} onClick={() => isDone ? setActiveView('costs') : setIsSettingsOpen(true)}>
          <CostReportIcon width={15} height={15} />
          Uso
        </button>
      </nav>

      {/* ── Modals (outside layout, rendered in portal) ── */}
      {previewImageUrl && (
        <ImagePreviewModal imageUrl={previewImageUrl} onClose={handleClosePreview} />
      )}

      {regionSelectorState && (() => {
        const item = regionSelectorState.item;
        const isScene = typeof (item as Scene).id === 'number';
        return (
          <ImageRegionSelectorModal
            isOpen={!!regionSelectorState}
            imageUrl={item.imageUrl!}
            onClose={() => setRegionSelectorState(null)}
            onConfirm={handleConfirmRegionForAnalysis}
            initialMode={regionSelectorState.initialMode ?? 'analyze'}
            references={isScene ? (item as Scene).references ?? [] : undefined}
            onReferencesChange={isScene ? (updater => handleSceneReferencesChange((item as Scene).id, updater)) : undefined}
          />
        );
      })()}

      {analysisModalState && (
        <TextAnalysisModal
          state={analysisModalState}
          onClose={() => setAnalysisModalState(null)}
          onApplyCorrection={handleApplyTextCorrection}
          onRegenerateWithCorrection={handleRegenerateWithCorrection}
          onInpaintCorrection={handleInpaintCorrection}
        />
      )}

      {isLoaded && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          initialSettings={settings}
          onSave={handleSaveSettings}
          currentUser={currentUser}
          onUserUpdate={setCurrentUser}
          platformProvider={platformProvider}
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

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthenticated={setCurrentUser}
      />

      <AccountModal
        isOpen={isAccountOpen}
        user={currentUser}
        onClose={() => setIsAccountOpen(false)}
        onUserUpdate={setCurrentUser}
        onLoadProject={handleLoadCloudProject}
      />

      <ScriptPasteModal
        isOpen={isScriptPasteOpen}
        onClose={() => setIsScriptPasteOpen(false)}
        onFileReady={handleFileChange}
        maxScenesLimit={currentUser?.plan?.maxScenesPerScript || (getStoredApiKey() ? 120 : 20)}
        promptTemplate={settings.scriptStructuringPrompt}
      />

      {showStyleModal && (
        <StyleSelectionModal
          onConfirm={(style, refImg) => {
            setGlobalStyle(style);
            setReferenceImage(refImg);
            setShowStyleModal(false);
            handleAnalyze(style, refImg); // pass directly — avoids stale closure on globalStyle state
          }}
          onSkip={() => {
            setGlobalStyle(null);
            setReferenceImage(null);
            setShowStyleModal(false);
            handleAnalyze(null, null);
          }}
        />
      )}

      {graphicStyleSceneId !== null && (
        <StyleSelectionModal
          onConfirm={(style) => {
            if (style) {
              setScenes(prev => prev.map(s =>
                s.id === graphicStyleSceneId
                  ? { ...s, sceneGraphicStyle: { id: style.id, label: style.label, promptSuffix: style.promptSuffix } }
                  : s
              ));
            }
            setGraphicStyleSceneId(null);
          }}
          onSkip={() => setGraphicStyleSceneId(null)}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {currentUser?.isAdmin && !isAdminOpen && (
        <button
          onClick={() => setIsAdminOpen(true)}
          title="Painel administrativo (Ctrl/⌘+Shift+A)"
          style={{
            position: 'fixed', bottom: 16, right: 16, zIndex: 900,
            background: '#bf3989', color: 'white', border: 'none',
            padding: '10px 16px', borderRadius: 999, cursor: 'pointer',
            fontWeight: 600, fontSize: 13,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          ⚙ Admin
        </button>
      )}

      {isAdminOpen && currentUser?.isAdmin && (
        <AdminPanel onClose={() => setIsAdminOpen(false)} />
      )}
    </div>
  );
};

export default App;
