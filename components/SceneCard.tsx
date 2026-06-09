import React, { useState, useRef, useCallback } from 'react';
import type { Character, Scene, SceneRefinement, SceneReference, SceneReferenceKind } from '../types';
import { EditIcon, SparklesIcon, DownloadIcon, RevertIcon, TextAnalysisIcon, ReloadIcon, CropIcon } from './icons';
import ImageLoader from './ImageLoader';
import ImageEditModal from './ImageEditModal';
import SceneReferencesPanel from './SceneReferencesPanel';
import SceneSplitModal from './SceneSplitModal';
import {
  CAMERA_HEIGHT_OPTIONS,
  CAMERA_POSITION_OPTIONS,
  SCENE_STYLE_OPTIONS,
  type CameraHeightId,
  type CameraPositionId,
} from '../utils/promptModules';
import ShotTypeSelector from './ShotTypeSelector';
import CameraPositionControl from './CameraPositionControl';
import { cropImageToRegion, aspectRatioLabel, modelLabelShort } from '../utils/imageHelpers';
import Spinner from './ui/Spinner';
import ImgBtn from './ui/ImgBtn';
import SceneCharacterTags from './SceneCharacterTags';
import SceneLettering from './SceneLettering';
import SceneContinuation from './SceneContinuation';
import SceneSplitSuggestion from './SceneSplitSuggestion';
import {
  REF_QUICK_PROMPTS,
  REF_BLEND_SUGGESTIONS,
  CREATIVE_DIRECTION_SUGGESTIONS,
  REMOVE_VISUAL_OPTIONS,
  REMOVE_ALL_VISUAL_PROMPT,
} from './sceneCard.constants';

type RefExtra = { id: string; previewUrl: string; base64Data: string; mimeType: string };

interface SceneCardProps {
  scene: Scene;
  scenes: Scene[];
  characters: Character[];
  sceneIndex: number;
  availableStyles: string[];
  onImageUpdate: (id: number, newImageUrl: string, newMimeType: string) => void;
  onVisualize: (id: number) => void;
  onVisualizeWithReference: (id: number, prompt: string, croppedBase64: string | null, croppedMimeType: string | null, extraReferences?: { base64Data: string; mimeType: string }[], blendInstruction?: string) => void;
  editImageService: (base64: string, prompt: string) => Promise<{ base64Data: string, mimeType: string }>;
  onPreview: (url: string) => void;
  onPromptChange: (id: number, newPrompt: string) => void;
  onStyleChange: (id: number, newStyle: string) => void;
  onSceneVisualStyleChange: (id: number, sceneStyle: string) => void;
  onSceneCameraPositionChange?: (id: number, position: CameraPositionId | '', height: CameraHeightId | '') => void;
  onSceneCharacterEdit?: (id: number, edit: { type: 'add'; name: string } | { type: 'remove'; name: string } | { type: 'replace'; from: string; to: string }) => void;
  onContinuationChange: (id: number, isChecked: boolean) => void;
  onContinuationReferenceChange: (id: number, refId: string) => void;
  onUpdatePrompt: (id: number) => void;
  onRecreatePrompt?: (id: number, creativeDirection: string) => void | Promise<void>;
  onRevertImage: (id: number) => void;
  onAnalyzeText: (scene: Scene) => void;
  onEditRegion: (scene: Scene) => void;
  onSplitScene: (sceneId: number, count: number, instructions: string) => void;
  onClearSplit: (sceneId: number) => void;
  onApplyAlternativePrompt?: (id: number) => void;
  onApplySplitSuggestion?: (id: number) => void;
  onGenerateEndFrame?: (id: number) => void;
  onUpdateSplitImage?: (sceneId: number, splitId: string, newImageUrl: string, mimeType: string) => void;
  onOpenGraphicStyle?: (id: number) => void;
  onClearGraphicStyle?: (id: number) => void;
  onIncludeLetteringChange?: (id: number, include: boolean) => void;
  onSceneReferencesChange?: (id: number, updater: (current: SceneReference[] | undefined) => SceneReference[] | undefined) => void;
}




/* ── Spinner ──────────────────────────────────────────────────── */
/* ── Main component ───────────────────────────────────────────── */
const SceneCard: React.FC<SceneCardProps> = ({
  scene, scenes, characters, sceneIndex,
  onImageUpdate, onVisualize, onVisualizeWithReference, editImageService,
  onPreview, onPromptChange, onStyleChange, onContinuationChange,
  onSceneVisualStyleChange, onSceneCameraPositionChange, onSceneCharacterEdit, onContinuationReferenceChange, onUpdatePrompt, onRecreatePrompt, onRevertImage, onAnalyzeText, onEditRegion,
  onSplitScene, onClearSplit,
  onApplyAlternativePrompt, onApplySplitSuggestion,
  onGenerateEndFrame,
  onUpdateSplitImage,
  onOpenGraphicStyle,
  onClearGraphicStyle,
  onIncludeLetteringChange,
  onSceneReferencesChange,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editState, setEditState]             = useState<{ isLoading: boolean; error: string | null }>({ isLoading: false, error: null });
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isRemoveMenuOpen, setIsRemoveMenuOpen] = useState(false);
  const [showRefinement, setShowRefinement]     = useState(false);
  const [hoveredSplitIdx, setHoveredSplitIdx]   = useState<number | null>(null);
  const [isCameraControlOpen, setIsCameraControlOpen] = useState(false);
  const [editingSplit, setEditingSplit]          = useState<{ id: string; imageUrl: string } | null>(null);
  const [splitEditState, setSplitEditState]      = useState<{ isLoading: boolean; error: string | null }>({ isLoading: false, error: null });

  // ── Inline reference panel ────────────────────────────────────────────────
  const [isRefPanelOpen,    setIsRefPanelOpen]    = useState(false);
  const [refPoints,         setRefPoints]         = useState<{ x: number; y: number }[]>([]);
  const [refIsDrawingPoly,  setRefIsDrawingPoly]  = useState(false);
  const [refPrompt,         setRefPrompt]         = useState('');
  const [refCroppedPreview, setRefCroppedPreview] = useState<string | null>(null);
  const [refIsCropping,     setRefIsCropping]     = useState(false);
  const [refRefScene,       setRefRefScene]       = useState<Scene | null>(null);
  const [refExtraRefs,      setRefExtraRefs]      = useState<RefExtra[]>([]);
  const [isRefExtraDragging, setIsRefExtraDragging] = useState(false);
  const [refBlend,          setRefBlend]          = useState('');
  const refImgEl  = useRef<HTMLImageElement>(null);
  const refFileEl = useRef<HTMLInputElement>(null);
  const refExtraDragDepth = useRef(0);

  // ── Recriar direção criativa do prompt ──────────────────────────────────────
  const [isCreativeOpen, setIsCreativeOpen] = useState(false);
  const [creativeDirection, setCreativeDirection] = useState('');
  const [isRecreatingCreative, setIsRecreatingCreative] = useState(false);
  const creativePromptBusy = scene.isUpdatingPrompt || isRecreatingCreative;

  const handleRecreatePromptClick = async () => {
    const dir = creativeDirection.trim();
    if (!dir || !onRecreatePrompt || creativePromptBusy) return;

    setIsRecreatingCreative(true);
    try {
      await Promise.resolve(onRecreatePrompt(scene.id, dir));
      setCreativeDirection('');
      setIsCreativeOpen(false);
    } finally {
      setIsRecreatingCreative(false);
    }
  };


  // ── Persistent scene references (used by SceneReferencesPanel) ──
  const sceneReferences = scene.references ?? [];
  const isSceneRefBusy = scene.isLoading || scene.isAnalyzingText || editState.isLoading;

  const getReferenceSceneData = () => {
    if (!scene.isContinuation) return { isValid: true, isImageMissing: false, identifier: '', referenceScene: undefined as Scene | undefined };
    let referenceScene: Scene | undefined;
    let isValid = true;
    let identifier: string | number = '';
    if (scene.continuationReferenceId) {
      identifier = `Ordem ${scene.continuationReferenceId}`;
      referenceScene = scenes.find(s => s.order === scene.continuationReferenceId);
      if (!referenceScene) isValid = false;
    } else if (sceneIndex > 0) {
      identifier = 'anterior';
      referenceScene = scenes[sceneIndex - 1];
    }
    const isImageMissing = !!(isValid && referenceScene && !referenceScene.imageUrl);
    return { isValid, isImageMissing, identifier, referenceScene };
  };

  const referenceSceneData = getReferenceSceneData();
  const cameraRelation = [
    scene.prompt_json?.camera?.relation_to_subject,
    scene.prompt_json?.camera?.framing,
    scene.image_prompt,
  ].filter(Boolean).join(' ').toLowerCase();
  const selectedCameraPosition = (
    CAMERA_POSITION_OPTIONS.find(option => cameraRelation.includes(option.relation.toLowerCase()))?.id || ''
  ) as CameraPositionId | '';
  const selectedCameraHeight = (
    CAMERA_HEIGHT_OPTIONS.find(option => cameraRelation.includes(option.relation.toLowerCase()))?.id || ''
  ) as CameraHeightId | '';
  const selectedCameraPositionLabel = CAMERA_POSITION_OPTIONS.find(option => option.id === selectedCameraPosition)?.label;
  const selectedCameraHeightLabel = CAMERA_HEIGHT_OPTIONS.find(option => option.id === selectedCameraHeight)?.label;
  const cameraPositionSummary = [
    selectedCameraPositionLabel,
    selectedCameraHeightLabel,
  ].filter(Boolean).join(' · ') || 'Sem posição definida';
  const isBusy = scene.isLoading || scene.isAnalyzingText || editState.isLoading;

  let busyMessage = '';
  if (scene.isLoading) busyMessage = 'Gerando imagem…';
  else if (scene.isAnalyzingText) busyMessage = 'Analisando texto…';
  else if (editState.isLoading) busyMessage = 'Editando imagem…';

  const handleConfirmEdit = async (prompt: string) => {
    if (!scene.imageUrl) return;
    setEditState({ isLoading: true, error: null });
    try {
      const { base64Data, mimeType } = await editImageService(scene.imageUrl, prompt);
      onImageUpdate(scene.id, `data:${mimeType};base64,${base64Data}`, mimeType);
      setIsEditModalOpen(false);
      setEditState({ isLoading: false, error: null });
    } catch (e) {
      setEditState({ isLoading: false, error: e instanceof Error ? e.message : 'Falha ao editar.' });
    }
  };

  const handleDownload = () => {
    if (!scene.imageUrl) return;
    const link = document.createElement('a');
    link.href = scene.imageUrl;
    link.download = `Cena_${scene.scene_id}-${scene.sub_id}.${scene.imageMimeType?.split('/')[1] || 'png'}`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleRemoveVisualElements = async (instruction: string) => {
    if (!scene.imageUrl) return;
    setIsRemoveMenuOpen(false);
    setEditState({ isLoading: true, error: null });
    try {
      const prompt = `${instruction} Preserve a cena, personagens, enquadramento, iluminação, estilo visual, cores, profundidade e atmosfera. Preencha a área removida de forma natural, fotorrealista e coerente com o ambiente. Não adicione novos textos, logos, gráficos, interfaces ou elementos editoriais.`;
      const { base64Data, mimeType } = await editImageService(scene.imageUrl, prompt);
      onImageUpdate(scene.id, `data:${mimeType};base64,${base64Data}`, mimeType);
      setEditState({ isLoading: false, error: null });
    } catch (e) {
      setEditState({ isLoading: false, error: e instanceof Error ? e.message : 'Falha ao remover elementos da imagem.' });
    }
  };

  /* ── Inline reference panel handlers ───────────────────────── */
  const openRefPanel = () => {
    setIsRefPanelOpen(true);
    setRefPrompt(scene.image_prompt);
    setRefPoints([]); setRefIsDrawingPoly(false); setRefCroppedPreview(null);
    setRefRefScene(null); setRefExtraRefs([]); setRefBlend('');
  };

  const REF_MIN_DIST = 4;
  const refPolyBBox = (pts: { x: number; y: number }[]) => {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  };

  const getRefPointerXY = (e: React.PointerEvent<HTMLDivElement>): { x: number; y: number } | null => {
    if (!refImgEl.current) return null;
    const r = refImgEl.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - r.left, r.width)),
      y: Math.max(0, Math.min(e.clientY - r.top,  r.height)),
    };
  };

  const onRefPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (refRefScene) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = getRefPointerXY(e);
    if (!pt) return;
    setRefPoints([pt]);
    setRefIsDrawingPoly(true);
    setRefCroppedPreview(null);
  };

  const onRefPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!refIsDrawingPoly) return;
    const pt = getRefPointerXY(e);
    if (!pt) return;
    setRefPoints(prev => {
      if (prev.length === 0) return [pt];
      const last = prev[prev.length - 1];
      if (Math.sqrt((last.x - pt.x) ** 2 + (last.y - pt.y) ** 2) < REF_MIN_DIST) return prev;
      return [...prev, pt];
    });
  };

  const onRefPointerUp = useCallback(async () => {
    if (!refIsDrawingPoly) return;
    setRefIsDrawingPoly(false);
    if (refPoints.length >= 3 && refImgEl.current) {
      setRefIsCropping(true);
      try {
        const r = refImgEl.current.getBoundingClientRect();
        const bb = refPolyBBox(refPoints);
        const { base64, mimeType } = await cropImageToRegion(scene.imageUrl!, bb, r.width, r.height);
        setRefCroppedPreview(`data:${mimeType};base64,${base64}`);
      } catch { setRefCroppedPreview(null); }
      finally   { setRefIsCropping(false); }
    } else {
      setRefCroppedPreview(null);
      if (refPoints.length < 3) setRefPoints([]);
    }
  }, [refIsDrawingPoly, refPoints, scene.imageUrl]);

  const addRefExtraFiles = (fileList: FileList | File[] | null) => {
    const files = Array.from(fileList ?? []) as File[];
    files
      .filter((f: File) => ['image/png', 'image/jpeg', 'image/webp'].includes(f.type))
      .forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = ev => {
          const dataUrl = ev.target?.result as string;
          const [hdr, b64] = dataUrl.split(',');
          setRefExtraRefs(p => [...p, {
            id: `${Date.now()}${Math.random()}`,
            previewUrl: dataUrl,
            base64Data: b64,
            mimeType: hdr.match(/:(.*?);/)?.[1] || file.type,
          }]);
        };
        reader.readAsDataURL(file);
      });
  };

  const onRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addRefExtraFiles(e.target.files);
    if (e.target) e.target.value = '';
  };

  const onRefExtraDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    refExtraDragDepth.current += 1;
    if (!isBusy) setIsRefExtraDragging(true);
  };

  const onRefExtraDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const onRefExtraDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    refExtraDragDepth.current = Math.max(0, refExtraDragDepth.current - 1);
    if (refExtraDragDepth.current === 0) setIsRefExtraDragging(false);
  };

  const onRefExtraDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    refExtraDragDepth.current = 0;
    setIsRefExtraDragging(false);
    if (isBusy) return;
    addRefExtraFiles(event.dataTransfer.files);
  };

  const onRefGenerate = async () => {
    const extra = refExtraRefs.length > 0 ? refExtraRefs.map(r => ({ base64Data: r.base64Data, mimeType: r.mimeType })) : undefined;
    const blend = refBlend.trim() || undefined;
    if (refRefScene?.imageUrl && refRefScene.imageMimeType) {
      onVisualizeWithReference(scene.id, refPrompt, refRefScene.imageUrl.split(',')[1], refRefScene.imageMimeType, extra, blend);
      setIsRefPanelOpen(false); return;
    }
    let cb64: string | null = null, cmime: string | null = null;
    if (refPoints.length >= 3 && refImgEl.current) {
      try {
        const r = refImgEl.current.getBoundingClientRect();
        const bb = refPolyBBox(refPoints);
        const res = await cropImageToRegion(scene.imageUrl!, bb, r.width, r.height);
        cb64 = res.base64; cmime = res.mimeType;
      } catch { /* sem crop */ }
    }
    onVisualizeWithReference(scene.id, refPrompt, cb64, cmime, extra, blend);
    setIsRefPanelOpen(false);
  };

  const refValidSel = refPoints.length >= 3;
  const refScenes    = scenes.filter(s => s.id !== scene.id && s.imageUrl && s.imageMimeType);

  /* ── Image panel ────────────────────────────────────────────── */
  const renderImagePanel = () => {
    if (scene.imageUrl) {
      return (
        <div className="img-group" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 200 }}>
          <button
            onClick={() => onPreview(scene.imageUrl!)}
            style={{ display: 'block', width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}
          >
            <img
              src={scene.imageUrl}
              alt={`Cena ${scene.original_location}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .4s ease' }}
            />
          </button>

          {isBusy && <ImageLoader message={busyMessage} />}

          {/* Gradient overlay */}
          <div className="img-overlay" />

          {/* Top-left: status + cost */}
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5, alignItems: 'center', zIndex: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--green)',
              boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
              animation: 'pulse-dot 2s ease-in-out infinite',
              flexShrink: 0,
            }} />
            {(scene.costBRL !== undefined || scene.modelUsed) && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '2px 8px', borderRadius: 6,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.07)',
                fontSize: 11,
              }}>
                {scene.modelUsed && (
                  <span style={{ fontWeight: 700, color: '#A5B4FC' }}>{modelLabelShort(scene.modelUsed)}</span>
                )}
                {scene.costBRL !== undefined && (
                  <>
                    {scene.modelUsed && <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>}
                    <span style={{ fontFamily: 'var(--mono)', color: '#34D399' }}>R${scene.costBRL.toFixed(3).replace('.', ',')}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Top-right: action icons (show on hover) */}
          <div className="img-hover-row" style={{
            position: 'absolute', top: 8, right: 8,
            display: 'flex', gap: 4, zIndex: 10,
            opacity: 0, transition: 'opacity .15s ease',
          }}>
            <ImgBtn onClick={() => onAnalyzeText(scene)} disabled={isBusy} title="Analisar texto" color="rgba(139,92,246,0.8)">
              <TextAnalysisIcon width={13} height={13} />
            </ImgBtn>
            <ImgBtn onClick={handleDownload} disabled={isBusy} title="Baixar" color="rgba(16,185,129,0.8)">
              <DownloadIcon width={13} height={13} />
            </ImgBtn>
            <ImgBtn onClick={() => setIsEditModalOpen(true)} disabled={isBusy} title="Editar imagem" color="rgba(99,102,241,0.8)">
              <EditIcon width={13} height={13} />
            </ImgBtn>
          </div>

          {/* Bottom-left: revert */}
          {scene.previousImageUrl && (
            <div className="img-hover-revert" style={{
              position: 'absolute', bottom: 8, left: 8,
              display: 'flex', alignItems: 'center', gap: 5, zIndex: 10,
              padding: '4px 5px', borderRadius: 8,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.07)',
              opacity: 0, transition: 'opacity .15s ease',
            }}>
              <img src={scene.previousImageUrl} alt="Anterior"
                style={{ width: 32, height: 24, objectFit: 'cover', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)' }} />
              <button onClick={() => onRevertImage(scene.id)} title="Reverter" style={{
                padding: 5, borderRadius: 5, background: 'rgba(255,255,255,0.08)',
                border: 'none', cursor: 'pointer', color: '#fff', display: 'flex',
                transition: 'background .12s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              >
                <RevertIcon width={12} height={12} />
              </button>
            </div>
          )}

          {/* Bottom-right: dimensions */}
          {scene.imageWidth && scene.imageHeight && (
            <div style={{
              position: 'absolute', bottom: 8, right: 8, zIndex: 10,
              padding: '2px 7px', borderRadius: 6,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.5)',
              pointerEvents: 'none',
            }}>
              {scene.imageWidth}×{scene.imageHeight}
              <span style={{ marginLeft: 5, color: 'rgba(255,255,255,0.25)' }}>
                {aspectRatioLabel(scene.imageWidth, scene.imageHeight)}
              </span>
            </div>
          )}

          {/* Reference badge + hover preview */}
          {scene.isContinuation && referenceSceneData.referenceScene?.imageUrl && (
            <div className="img-ref-badge" style={{
              position: 'absolute', bottom: 8, left: 8, zIndex: 20,
              display: 'flex', alignItems: 'center', gap: 5,
              cursor: 'default',
            }}>
              {/* Tooltip preview — shown via CSS sibling selector on hover */}
              <div className="img-ref-tooltip" style={{
                position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
                background: 'rgba(10,10,18,0.92)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(99,102,241,0.35)',
                borderRadius: 10, padding: 8,
                display: 'flex', flexDirection: 'column', gap: 6,
                width: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                opacity: 0, pointerEvents: 'none',
                transition: 'opacity .15s ease, transform .15s ease',
                transform: 'translateY(4px)',
              }}>
                <p style={{ fontSize: 10, color: '#A5B4FC', fontWeight: 600, margin: 0 }}>
                  Referência usada
                </p>
                <img
                  src={referenceSceneData.referenceScene.imageUrl}
                  alt="Referência"
                  style={{ width: '100%', borderRadius: 6, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.08)' }}
                />
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                  Cena {referenceSceneData.identifier}
                </p>
              </div>
              {/* Badge pill */}
              <div style={{
                padding: '2px 7px', borderRadius: 6,
                background: 'rgba(99,102,241,0.25)', backdropFilter: 'blur(6px)',
                border: '1px solid rgba(99,102,241,0.4)',
                fontSize: 10, fontWeight: 600, color: '#A5B4FC',
                letterSpacing: '0.02em',
              }}>
                ref
              </div>
            </div>
          )}
        </div>
      );
    }

    if (scene.isLoading) {
      return (
        <div style={{
          width: '100%', height: '100%', minHeight: 200,
          position: 'relative', overflow: 'hidden',
          background: 'var(--surface-2)',
        }}>
          {/* Shimmer sweep */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(105deg, transparent 35%, rgba(79,140,255,0.07) 50%, transparent 65%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.6s ease-in-out infinite',
          }} />
          {/* Rule-of-thirds grid lines */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.05 }} preserveAspectRatio="none">
            <line x1="33%" y1="0" x2="33%" y2="100%" stroke="white" strokeWidth="1"/>
            <line x1="66%" y1="0" x2="66%" y2="100%" stroke="white" strokeWidth="1"/>
            <line x1="0" y1="33%" x2="100%" y2="33%" stroke="white" strokeWidth="1"/>
            <line x1="0" y1="66%" x2="100%" y2="66%" stroke="white" strokeWidth="1"/>
          </svg>
          {/* Center badge */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--indigo-s)', border: '1px solid var(--indigo-b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Spinner size={16} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 500, letterSpacing: '0.03em' }}>
              Gerando visualização…
            </p>
          </div>
        </div>
      );
    }

    if (scene.error) {
      return (
        <div style={{
          width: '100%', height: '100%', minHeight: 200,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: 20, textAlign: 'center',
          background: 'rgba(248,113,113,0.04)',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>Erro ao gerar</p>
          <p style={{ fontSize: 11, color: 'rgba(248,113,113,0.6)', lineHeight: 1.5, maxWidth: 180 }}>{scene.error}</p>
          <button onClick={() => onVisualize(scene.id)} className="btn btn-primary" style={{ fontSize: 11, marginTop: 4 }}>
            Tentar novamente
          </button>
        </div>
      );
    }

    /* Empty state */
    return (
      <div style={{
        width: '100%', height: '100%', minHeight: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: 24, textAlign: 'center',
        background: 'var(--surface-2)',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'var(--indigo-s)', border: '1px solid var(--indigo-b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SparklesIcon width={22} height={22} style={{ color: '#818CF8' }} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Visualizar cena</p>
          <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5 }}>Gere uma imagem de IA para esta cena do roteiro</p>
        </div>
        <button
          onClick={() => onVisualize(scene.id)}
          disabled={!referenceSceneData.isValid || referenceSceneData.isImageMissing}
          className="btn btn-primary"
          style={{ fontSize: 12 }}
        >
          <SparklesIcon width={13} height={13} />
          Gerar Visualização
        </button>
        {referenceSceneData.isImageMissing && (
          <p style={{ fontSize: 11, color: 'var(--amber)', lineHeight: 1.5 }}>
            A cena de referência ({referenceSceneData.identifier}) precisa ser gerada primeiro.
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="card card-hover anim-up" style={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',
        minHeight: 220,
      }}>
        {/* ── Image panel (left, 36%) ── */}
        <div style={{ width: '36%', flexShrink: 0, position: 'relative', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
          {renderImagePanel()}
        </div>

        {/* ── Content panel (right) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 16px 14px', minWidth: 0 }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text-1)',
                lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {scene.original_location}
              </p>
            </div>
            {/* Scene ID badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)',
              padding: '2px 8px', borderRadius: 6, flexShrink: 0,
              background: 'var(--indigo-s)', color: '#818CF8', border: '1px solid var(--indigo-b)',
              letterSpacing: '0.03em',
            }}>
              C:{scene.scene_id} · S:{scene.sub_id} · O:{scene.order}
            </span>
          </div>

          {/* ── Cost strip ── */}
          {scene.imageUrl && (scene.costBRL !== undefined || scene.modelUsed) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 6,
              padding: '8px 10px',
              marginBottom: 8,
              borderRadius: 8,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Atual</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#34D399', fontFamily: 'var(--mono)', marginTop: 2, whiteSpace: 'nowrap' }}>
                  {scene.costBRL !== undefined ? `R$ ${scene.costBRL.toFixed(3).replace('.', ',')}` : '—'}
                </p>
                <p style={{ fontSize: 10, color: '#818CF8', fontWeight: 700, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {scene.modelUsed ? modelLabelShort(scene.modelUsed) : 'Modelo não registrado'}
                </p>
              </div>

              <div style={{ minWidth: 0, paddingLeft: 7, borderLeft: '1px solid var(--border)' }}
                title="Custo acumulado desta cena">
                <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acumulado</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#FCD34D', fontFamily: 'var(--mono)', marginTop: 2, whiteSpace: 'nowrap' }}>
                  R$ {(scene.accumulatedCostBRL ?? scene.costBRL ?? 0).toFixed(3).replace('.', ',')}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 1, whiteSpace: 'nowrap' }}>{scene.versionCount ?? 1} {(scene.versionCount ?? 1) === 1 ? 'versão' : 'versões'}</p>
              </div>

              <div style={{ minWidth: 0, paddingLeft: 7, borderLeft: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tokens</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', fontFamily: 'var(--mono)', marginTop: 2, whiteSpace: 'nowrap' }}>
                  {scene.tokens ? scene.tokens.toLocaleString('pt-BR') : '—'}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 1, whiteSpace: 'nowrap' }}>geração atual</p>
              </div>
            </div>
          )}

          {/* ── Description ── */}
          <p
            style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, marginBottom: 8 }}
            dangerouslySetInnerHTML={{
              __html: scene.tagged_description.replace(
                /\[(.*?)\]/g,
                '<strong style="color:#818CF8;font-weight:600">[$1]</strong>'
              ),
            }}
          />

          {/* ── Character tags ── */}
          <SceneCharacterTags
            scene={scene}
            characters={characters}
            isBusy={isBusy}
            onSceneCharacterEdit={onSceneCharacterEdit}
          />

          <SceneLettering scene={scene} onIncludeLetteringChange={onIncludeLetteringChange} />

          {/* ── Split suggestion ── */}
          <SceneSplitSuggestion scene={scene} onOpenSplit={() => setIsSplitModalOpen(true)} />

          {/* ── Continuation ── */}
          <SceneContinuation
            scene={scene}
            sceneIndex={sceneIndex}
            isBusy={isBusy}
            referenceSceneData={referenceSceneData}
            onContinuationChange={onContinuationChange}
            onContinuationReferenceChange={onContinuationReferenceChange}
          />

          {/* ── Persistent scene references (objetos, logos, imagens externas) ── */}
          {onSceneReferencesChange && (
            <div style={{ marginBottom: 10 }}>
              <SceneReferencesPanel
                references={sceneReferences}
                onChange={updater => onSceneReferencesChange(scene.id, updater)}
                disabled={isSceneRefBusy}
              />
            </div>
          )}

          {/* ── Style + prompt ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {/* Visual style module (a família/medium da imagem: foto, anime, cartoon...) */}
            <div>
              <label className="label">Estética</label>
              <select
                value={scene.prompt_json?.visual_style?.style_family || ''}
                onChange={e => onSceneVisualStyleChange(scene.id, e.target.value)}
                className="field"
                style={{ fontSize: 12, width: '100%' }}
                disabled={isBusy || scene.isUpdatingPrompt || !scene.prompt_json}
                title={scene.prompt_json ? 'Altera apenas o módulo visual_style do prompt JSON' : 'Disponível para cenas com prompt JSON modular'}
              >
                <option value="">Manter estilo atual</option>
                {SCENE_STYLE_OPTIONS.map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>

            {/* Shot/camera module */}
            <div>
              <label className="label">Tipo de plano / câmera</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <ShotTypeSelector
                  value={scene.style}
                  onChange={(v) => onStyleChange(scene.id, v)}
                  disabled={isBusy || scene.isUpdatingPrompt}
                />
                {/* Botão de re-análise via IA — só aparece quando NÃO há prompt_json
                    (cena legada / análise pendente). Quando o JSON existe, o onChange
                    do select acima já aplica a mudança em handleSceneStyleChange. */}
                {!scene.prompt_json && (
                  <button
                    onClick={() => onUpdatePrompt(scene.id)}
                    disabled={isBusy || scene.isUpdatingPrompt}
                    className="btn btn-ghost"
                    style={{ fontSize: 12, flexShrink: 0, padding: '6px 10px' }}
                    title="Analisar a cena com IA para gerar o prompt JSON modular"
                  >
                    {scene.isUpdatingPrompt
                      ? <Spinner size={12} />
                      : <SparklesIcon width={13} height={13} />}
                    <span>{scene.isUpdatingPrompt ? 'Analisando…' : 'Analisar com IA'}</span>
                  </button>
                )}
              </div>
            </div>

            {onSceneCameraPositionChange && (
              <div>
                <label className="label">Posição da câmera</label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', margin: 0 }}>
                      {cameraPositionSummary}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
                      Controle 3D carregado sob demanda.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCameraControlOpen(open => !open)}
                    disabled={isBusy || scene.isUpdatingPrompt}
                    className="btn btn-ghost"
                    style={{
                      fontSize: 11,
                      padding: '5px 9px',
                      flexShrink: 0,
                      color: isCameraControlOpen ? '#C4B5FD' : 'var(--text-3)',
                      borderColor: isCameraControlOpen ? 'rgba(139,92,246,0.55)' : 'var(--border-md)',
                    }}
                  >
                    {isCameraControlOpen ? 'Fechar 3D' : 'Abrir 3D'}
                  </button>
                </div>
                {isCameraControlOpen && (
                  <div style={{ marginTop: 8 }}>
                    <CameraPositionControl
                      position={selectedCameraPosition}
                      height={selectedCameraHeight}
                      disabled={isBusy || scene.isUpdatingPrompt}
                      onChange={(position, height) => onSceneCameraPositionChange(scene.id, position, height)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Graphic style (preset/modificador aplicado POR CIMA da Estética via promptSuffix) */}
            {onOpenGraphicStyle && (
              <div>
                <label className="label">Refinamento gráfico</label>
                <button
                  onClick={() => onOpenGraphicStyle(scene.id)}
                  disabled={isBusy}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, width: '100%', justifyContent: 'flex-start', gap: 7 }}
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12a4 4 0 0 1 8 0"/>
                    <line x1="12" y1="8" x2="12" y2="8.01"/>
                  </svg>
                  {scene.sceneGraphicStyle
                    ? <><span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{scene.sceneGraphicStyle.label}</span><span style={{ color: 'var(--text-4)', marginLeft: 'auto', fontSize: 11 }}>Alterar</span></>
                    : <span style={{ color: 'var(--text-4)' }}>Usar estilo global · clique para definir por cena</span>
                  }
                </button>
                {scene.sceneGraphicStyle && onClearGraphicStyle && (
                  <button
                    onClick={() => onClearGraphicStyle(scene.id)}
                    style={{ fontSize: 10, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textDecoration: 'underline' }}
                  >
                    Remover · usar estilo global
                  </button>
                )}
              </div>
            )}

            {/* Prompt */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <label className="label" style={{ marginBottom: 0 }}>Prompt de Imagem</label>
                {onRecreatePrompt && (
                  <button
                    onClick={() => setIsCreativeOpen(o => !o)}
                    disabled={isBusy || creativePromptBusy}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600,
                      color: isCreativeOpen ? '#C4B5FD' : '#A78BFA',
                      background: isCreativeOpen ? 'rgba(139,92,246,0.12)' : 'none',
                      border: `1px solid ${isCreativeOpen ? 'rgba(139,92,246,0.4)' : 'transparent'}`,
                      borderRadius: 6, padding: '3px 8px',
                      cursor: (isBusy || creativePromptBusy) ? 'not-allowed' : 'pointer',
                      opacity: (isBusy || creativePromptBusy) ? 0.5 : 1,
                      transition: 'background .12s, border-color .12s, color .12s',
                    }}
                    title="Descreva uma nova direção criativa e a IA refaz o prompt da imagem do zero, mantendo o conteúdo da cena"
                  >
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    Refazer direção criativa
                  </button>
                )}
              </div>

              {/* Painel de direção criativa */}
              {onRecreatePrompt && isCreativeOpen && (
                <div style={{
                  margin: '6px 0 8px',
                  padding: '10px 11px',
                  borderRadius: 8,
                  background: 'rgba(139,92,246,0.07)',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: '#C4B5FD', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                    Nova direção criativa
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
                    {CREATIVE_DIRECTION_SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => setCreativeDirection(prev => {
                          const t = prev.trim();
                          return t ? `${t}; ${s.toLowerCase()}` : s;
                        })}
                        disabled={isBusy || creativePromptBusy}
                        style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 20,
                          cursor: (isBusy || creativePromptBusy) ? 'not-allowed' : 'pointer',
                          border: '1px solid rgba(139,92,246,0.35)',
                          background: 'transparent', color: '#C4B5FD',
                          transition: 'background .12s',
                        }}
                        onMouseEnter={e => { if (!(isBusy || creativePromptBusy)) (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.15)'; }}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={creativeDirection}
                    onChange={e => setCreativeDirection(e.target.value)}
                    disabled={isBusy || creativePromptBusy}
                    rows={3}
                    placeholder="Ex: deixe a cena mais cinematográfica, ângulo baixo, luz dramática de fim de tarde, paleta âmbar — mantendo os mesmos personagens e ação."
                    className="field"
                    style={{ fontSize: 12, resize: 'none', width: '100%' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.4 }}>
                      A IA refaz o prompt mantendo o conteúdo da cena.
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => { setCreativeDirection(''); setIsCreativeOpen(false); }}
                        disabled={creativePromptBusy}
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '5px 10px' }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleRecreatePromptClick}
                        disabled={isBusy || creativePromptBusy || !creativeDirection.trim()}
                        className="btn btn-primary"
                        style={{ fontSize: 11, padding: '5px 12px', background: '#7C3AED', borderColor: '#7C3AED' }}
                      >
                        {creativePromptBusy ? <Spinner size={12} /> : <SparklesIcon width={13} height={13} />}
                        {creativePromptBusy ? 'Recriando…' : 'Recriar prompt'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <textarea
                value={scene.image_prompt}
                onChange={e => onPromptChange(scene.id, e.target.value)}
                className="field"
                rows={4}
                style={{ resize: 'none', fontSize: 12, flex: 1, minHeight: 80, marginTop: isCreativeOpen ? 0 : 4 }}
                disabled={isBusy || scene.isUpdatingPrompt}
              />
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {scene.imageUrl ? (
              <>
                <button
                  onClick={openRefPanel}
                  disabled={isBusy || scene.isUpdatingPrompt}
                  className="btn btn-primary"
                  style={{ fontSize: 12 }}
                >
                  <CropIcon width={13} height={13} />
                  Gerar Novamente
                </button>
                <button
                  onClick={() => onEditRegion(scene)}
                  disabled={isBusy || scene.isUpdatingPrompt}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: '#818CF8', borderColor: 'rgba(129,140,248,0.35)' }}
                  title="Selecionar uma região e editar apenas ela"
                >
                  <EditIcon width={13} height={13} />
                  Editar Região
                </button>
                <button
                  onClick={() => onVisualize(scene.id)}
                  disabled={isBusy || scene.isUpdatingPrompt || !referenceSceneData.isValid || referenceSceneData.isImageMissing}
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  title="Regerar sem modal de referência"
                >
                  <ReloadIcon width={13} height={13} />
                  Rápido
                </button>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setIsRemoveMenuOpen(open => !open)}
                    disabled={isBusy || scene.isUpdatingPrompt}
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    title="Remover textos, logos, gráficos ou interfaces da imagem gerada"
                  >
                    <EditIcon width={13} height={13} />
                    Remover
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isRemoveMenuOpen && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 'calc(100% + 6px)',
                      width: 270,
                      zIndex: 30,
                      background: 'var(--surface)',
                      border: '1px solid var(--border-md)',
                      borderRadius: 9,
                      boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
                      overflow: 'hidden',
                    }}>
                      <div style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-1)' }}>Remover da imagem</p>
                        <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.45, marginTop: 2 }}>Edita a imagem atual preservando a cena.</p>
                      </div>
                      <button
                        onClick={() => handleRemoveVisualElements(REMOVE_ALL_VISUAL_PROMPT)}
                        style={{
                          width: '100%', padding: '9px 10px', textAlign: 'left',
                          background: 'var(--indigo-s)', border: 'none', borderBottom: '1px solid var(--border)',
                          cursor: 'pointer', color: '#A5B4FC', fontSize: 12, fontWeight: 800,
                        }}
                      >
                        Remover todos os elementos proibidos
                      </button>
                      {REMOVE_VISUAL_OPTIONS.map(option => (
                        <button
                          key={option.id}
                          onClick={() => handleRemoveVisualElements(option.prompt)}
                          style={{
                            width: '100%', padding: '8px 10px', textAlign: 'left',
                            background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
                            cursor: 'pointer', color: 'var(--text-2)', fontSize: 12,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : !scene.isLoading && (
              <button
                onClick={() => onVisualize(scene.id)}
                disabled={!referenceSceneData.isValid || referenceSceneData.isImageMissing}
                className="btn btn-primary"
                style={{ fontSize: 12 }}
              >
                <SparklesIcon width={13} height={13} />
                Gerar Visualização
              </button>
            )}

            {/* Dividir */}
            <button
              onClick={() => setIsSplitModalOpen(true)}
              disabled={isBusy || scene.isUpdatingPrompt || scene.isSplitting}
              className="btn btn-ghost"
              style={{ fontSize: 12, marginLeft: scene.imageUrl ? 0 : 'auto' }}
              title="Dividir em múltiplos planos"
            >
              {scene.isSplitting ? <Spinner size={12} /> : (
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/>
                </svg>
              )}
              {scene.isSplitting ? 'Dividindo…' : 'Dividir'}
            </button>

            {/* Frame final para vídeo */}
            {onGenerateEndFrame && scene.end_frame_prompt && (
              <button
                onClick={() => onGenerateEndFrame(scene.id)}
                disabled={isBusy || scene.isUpdatingPrompt || scene.endFrameIsLoading}
                className="btn btn-ghost"
                style={{ fontSize: 12, color: '#34D399', borderColor: 'rgba(52,211,153,0.30)' }}
                title="Gerar frame final para uso em ferramentas de vídeo (Runway, Kling, Pika)"
              >
                {scene.endFrameIsLoading ? <Spinner size={12} /> : (
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                )}
                {scene.endFrameIsLoading ? 'Gerando…' : scene.endFrameUrl ? 'Reger frame final' : 'Frame final'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Split images grid ── */}
      {scene.splitImages && scene.splitImages.length > 0 && (
        <div className="card" style={{ marginTop: 6, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/>
              </svg>
              Planos gerados ({scene.splitImages.length})
            </p>
            <button
              onClick={() => onClearSplit(scene.id)}
              style={{ fontSize: 11, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color .12s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}
            >
              ✕ Limpar
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {scene.splitImages.map((img, idx) => (
              <div
                key={img.id}
                onMouseEnter={() => setHoveredSplitIdx(idx)}
                onMouseLeave={() => setHoveredSplitIdx(null)}
                style={{
                  position: 'relative', borderRadius: 8, overflow: 'hidden',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  aspectRatio: '16/9',
                }}
              >
                {img.isLoading ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Spinner size={14} />
                    <p style={{ fontSize: 10, color: 'var(--text-4)' }}>Plano {idx + 1}</p>
                  </div>
                ) : img.error ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8, textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>Erro</p>
                    <p style={{ fontSize: 10, color: 'rgba(248,113,113,0.5)', marginTop: 2 }}>{img.error}</p>
                  </div>
                ) : img.imageUrl ? (
                  <>
                    {/* Clickable image */}
                    <button
                      onClick={() => onPreview(img.imageUrl!)}
                      style={{ display: 'block', width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}
                    >
                      <img
                        src={img.imageUrl}
                        alt={`Plano ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .3s ease', transform: hoveredSplitIdx === idx ? 'scale(1.04)' : 'scale(1)' }}
                      />
                    </button>

                    {/* Gradient + prompt — pointer-events none so clicks reach the button */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 55%)',
                      padding: '0 6px 6px',
                      display: 'flex', alignItems: 'flex-end',
                      opacity: hoveredSplitIdx === idx ? 1 : 0,
                      transition: 'opacity .15s ease',
                      pointerEvents: 'none',
                    }}>
                      <p style={{ fontSize: 10, color: '#fff', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {img.prompt}
                      </p>
                    </div>

                    {/* Action buttons (top-right) */}
                    <div style={{
                      position: 'absolute', top: 4, right: 4,
                      display: 'flex', gap: 3,
                      opacity: hoveredSplitIdx === idx ? 1 : 0,
                      transition: 'opacity .15s',
                    }}>
                      {/* Edit */}
                      {onUpdateSplitImage && (
                        <button
                          onClick={e => { e.stopPropagation(); setEditingSplit({ id: img.id, imageUrl: img.imageUrl! }); setSplitEditState({ isLoading: false, error: null }); }}
                          title="Editar imagem"
                          style={{ padding: 4, borderRadius: 5, background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', transition: 'background .12s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.75)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.65)')}
                        >
                          <EditIcon width={11} height={11} />
                        </button>
                      )}
                      {/* Download */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const ext = (img.imageMimeType ?? 'image/png').split('/')[1] || 'png';
                          const link = document.createElement('a');
                          link.href = img.imageUrl!;
                          link.download = `Cena_${scene.scene_id}-${scene.sub_id}_plano_${idx + 1}.${ext}`;
                          document.body.appendChild(link); link.click(); document.body.removeChild(link);
                        }}
                        title="Baixar"
                        style={{ padding: 4, borderRadius: 5, background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', transition: 'background .12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.75)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.65)')}
                      >
                        <DownloadIcon width={11} height={11} />
                      </button>
                    </div>

                    {/* Plan badge (top-left) */}
                    <div style={{ position: 'absolute', top: 4, left: 4, display: 'flex', gap: 3, alignItems: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.65)', color: '#fff', fontFamily: 'var(--mono)' }}>
                        {idx + 1}
                      </span>
                      {(img.modelUsed || img.costBRL !== undefined) && (
                        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {img.modelUsed && <span style={{ color: '#A5B4FC', fontWeight: 700 }}>{modelLabelShort(img.modelUsed)}</span>}
                          {img.costBRL !== undefined && <span style={{ color: '#34D399', fontFamily: 'var(--mono)' }}>R${img.costBRL.toFixed(3).replace('.', ',')}</span>}
                        </span>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── End frame for video ─────────────────────────────────── */}
      {(scene.endFrameUrl || scene.endFrameIsLoading || scene.endFrameError) && (
        <div className="card" style={{ marginTop: 6, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span style={{ color: '#34D399' }}>Frames para vídeo</span>
            </p>
            <span style={{ fontSize: 10, color: 'var(--text-4)' }}>Início → Fim · Runway / Kling / Pika</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}>
            {/* Start frame */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frame inicial</p>
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '16/9', background: 'var(--surface-2)' }}>
                {scene.imageUrl ? (
                  <button onClick={() => onPreview(scene.imageUrl!)} style={{ display: 'block', width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}>
                    <img src={scene.imageUrl} alt="Frame inicial" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-4)' }}>Gere a cena primeiro</p>
                  </div>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
              <span style={{ fontSize: 9, color: 'var(--text-4)', letterSpacing: '0.04em' }}>MOVER</span>
            </div>

            {/* End frame */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frame final</p>
              <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${scene.endFrameUrl ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`, aspectRatio: '16/9', background: 'var(--surface-2)', position: 'relative' }}>
                {scene.endFrameIsLoading ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 80 }}>
                    <Spinner size={16} />
                    <p style={{ fontSize: 10, color: 'var(--text-4)' }}>Gerando…</p>
                  </div>
                ) : scene.endFrameError ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 10, textAlign: 'center', minHeight: 80 }}>
                    <p style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>Erro</p>
                    <p style={{ fontSize: 10, color: 'rgba(248,113,113,0.6)', marginTop: 2, lineHeight: 1.4 }}>{scene.endFrameError}</p>
                  </div>
                ) : scene.endFrameUrl ? (
                  <>
                    <button onClick={() => onPreview(scene.endFrameUrl!)} style={{ display: 'block', width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }}>
                      <img src={scene.endFrameUrl} alt="Frame final" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                    <button
                      onClick={() => {
                        const ext = (scene.endFrameMimeType ?? 'image/png').split('/')[1] || 'png';
                        const link = document.createElement('a');
                        link.href = scene.endFrameUrl!;
                        link.download = `Cena_${scene.scene_id}-${scene.sub_id}_frame_final.${ext}`;
                        document.body.appendChild(link); link.click(); document.body.removeChild(link);
                      }}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        padding: 4, borderRadius: 5,
                        background: 'rgba(0,0,0,0.55)', border: 'none',
                        cursor: 'pointer', color: '#fff', display: 'flex',
                        opacity: 0, transition: 'opacity .15s, background .12s',
                      }}
                      className="group-hover:opacity-100"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.7)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.55)'; }}
                    >
                      <DownloadIcon width={11} height={11} />
                    </button>
                  </>
                ) : null}
              </div>
              {scene.endFrameUrl && scene.endFrameCostBRL !== undefined && (
                <p style={{ fontSize: 10, color: '#34D399', fontFamily: 'var(--mono)' }}>R${scene.endFrameCostBRL.toFixed(3).replace('.', ',')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reference modal ──────────────────────────────────────── */}
      {isRefPanelOpen && scene.imageUrl && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setIsRefPanelOpen(false)}
        >
          <div
            className="card"
            style={{ width: 'min(1040px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CropIcon width={14} height={14} style={{ color: '#22D3EE', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>Gerar com Referência Visual</p>
                <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                  {refRefScene
                    ? `Cena ${refRefScene.scene_id}-${refRefScene.sub_id} como referência`
                    : refValidSel
                    ? 'Região selecionada ativa'
                    : 'Selecione uma cena, desenhe uma região ou adicione imagens de objetos'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsRefPanelOpen(false)}
              className="icon-btn"
              title="Fechar"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

            {/* LEFT — imagem com desenho de área */}
            <div style={{ flex: 1, position: 'relative', borderRight: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Instruction bar */}
              <div style={{
                padding: '6px 14px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface-2)', flexShrink: 0,
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CropIcon width={11} height={11} />
                  {refRefScene
                    ? 'Seleção de região desativada — cena de referência ativa'
                    : refValidSel
                    ? 'Região desenhada — desenhe novamente para refazer'
                    : 'Clique e arraste livremente sobre a imagem para desenhar a seleção'}
                </span>
                {refValidSel && !refRefScene && (
                  <button
                    onClick={() => { setRefPoints([]); setRefCroppedPreview(null); }}
                    style={{ fontSize: 11, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}
                  >✕ Limpar</button>
                )}
              </div>

              {/* Drawing zone */}
              <div
                style={{
                  flex: 1, padding: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg)',
                  cursor: refRefScene ? 'not-allowed' : 'crosshair',
                  userSelect: 'none', overflow: 'hidden',
                }}
                onPointerDown={onRefPointerDown}
                onPointerMove={onRefPointerMove}
                onPointerUp={onRefPointerUp}
              >
                <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                  <img
                    ref={refImgEl}
                    src={scene.imageUrl}
                    alt="Imagem atual"
                    draggable={false}
                    style={{
                      maxWidth: '100%', maxHeight: '58vh',
                      objectFit: 'contain', display: 'block',
                      borderRadius: 10,
                      opacity: refRefScene ? 0.15 : 1,
                      transition: 'opacity .2s ease',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Ref scene overlay */}
                  {refRefScene?.imageUrl && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 8, pointerEvents: 'none',
                    }}>
                      <img
                        src={refRefScene.imageUrl}
                        alt={`Cena ${refRefScene.scene_id}-${refRefScene.sub_id}`}
                        style={{ maxHeight: 240, maxWidth: '92%', borderRadius: 9, border: '2px solid #22D3EE', objectFit: 'contain' }}
                      />
                      <span style={{
                        background: 'rgba(6,182,212,0.92)', color: '#fff',
                        fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                      }}>
                        Cena {refRefScene.scene_id}-{refRefScene.sub_id} · {refRefScene.original_location}
                      </span>
                    </div>
                  )}

                  {/* SVG polygon overlay */}
                  {refPoints.length > 0 && !refRefScene && (
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                      {refPoints.length >= 3 && (
                        <polygon
                          points={refPoints.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="rgba(34,211,238,0.18)"
                          stroke="#22D3EE"
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeDasharray={refIsDrawingPoly ? undefined : '6 3'}
                        />
                      )}
                      {refIsDrawingPoly && refPoints.length > 1 && (
                        <polyline
                          points={refPoints.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#22D3EE"
                          strokeWidth={2}
                          strokeLinejoin="round"
                        />
                      )}
                      <circle cx={refPoints[0].x} cy={refPoints[0].y} r={5} fill="#22D3EE" opacity={0.9} />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT — controles */}
            <div style={{
              width: 300, flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              padding: '14px 16px', gap: 14, overflowY: 'auto',
            }}>

              {/* Scene selector */}
              {refScenes.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="label">Usar outra cena</label>
                    {refRefScene && (
                      <button
                        onClick={() => setRefRefScene(null)}
                        style={{ fontSize: 10, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}
                      >✕ Limpar</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                    {refScenes.map(s => {
                      const isSel = refRefScene?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setRefRefScene(prev => prev?.id === s.id ? null : s)}
                          title={`${s.original_location} (Cena ${s.scene_id}-${s.sub_id})`}
                          style={{
                            flexShrink: 0, width: 72, borderRadius: 7, overflow: 'hidden', padding: 0,
                            border: isSel ? '2px solid #22D3EE' : '1px solid var(--border-md)',
                            background: 'var(--surface-2)', cursor: 'pointer',
                          }}
                        >
                          <img src={s.imageUrl!} alt={`C${s.scene_id}-${s.sub_id}`} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: '3px 5px', background: isSel ? '#0891B2' : 'var(--surface-3)' }}>
                            <p style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--mono)', color: isSel ? '#fff' : 'var(--text-2)' }}>C{s.scene_id}-{s.sub_id}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 10, color: refRefScene ? '#22D3EE' : 'var(--text-4)', marginTop: 4 }}>
                    {refRefScene ? `✦ Cena ${refRefScene.scene_id}-${refRefScene.sub_id} selecionada` : 'Ou arraste na imagem para selecionar uma região'}
                  </p>
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)' }} />
                </div>
              )}

              {/* Cropped region preview */}
              {!refRefScene && (refCroppedPreview || refIsCropping) && (
                <div>
                  <label className="label">Região selecionada</label>
                  <div style={{
                    borderRadius: 7, overflow: 'hidden',
                    border: '1px solid rgba(34,211,238,0.35)',
                    background: 'var(--surface-2)',
                    minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {refIsCropping
                      ? <Spinner size={14} />
                      : <img src={refCroppedPreview!} alt="Região" style={{ maxWidth: '100%', maxHeight: 110, objectFit: 'contain', display: 'block' }} />
                    }
                  </div>
                  <p style={{ fontSize: 10, color: '#22D3EE', marginTop: 3 }}>✦ Esta região será enviada como referência visual</p>
                </div>
              )}

              {/* Extra refs (objetos) */}
              <div
                onDragEnter={onRefExtraDragEnter}
                onDragOver={onRefExtraDragOver}
                onDragLeave={onRefExtraDragLeave}
                onDrop={onRefExtraDrop}
                style={{
                  borderRadius: 8,
                  padding: isRefExtraDragging ? 6 : 0,
                  margin: isRefExtraDragging ? -6 : 0,
                  background: isRefExtraDragging ? 'rgba(245,158,11,0.08)' : 'transparent',
                  outline: isRefExtraDragging ? '1px solid rgba(245,158,11,0.38)' : '1px solid transparent',
                  transition: 'background .15s, outline-color .15s, padding .15s, margin .15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="label" style={{ color: 'var(--amber)', marginBottom: 0 }}>Referências de objetos</label>
                  <button
                    onClick={() => refFileEl.current?.click()}
                    style={{ fontSize: 10, color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >+ Adicionar</button>
                </div>
                <input ref={refFileEl} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onRefFileChange} style={{ display: 'none' }} />

                {refExtraRefs.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {refExtraRefs.map((ref, i) => (
                      <div key={ref.id} className="group" style={{ position: 'relative', flexShrink: 0 }}>
                        <img src={ref.previewUrl} alt={`Ref ${i + 1}`} style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6, border: '2px solid rgba(245,158,11,0.5)', display: 'block' }} />
                        <span style={{
                          position: 'absolute', top: -5, left: -5, width: 16, height: 16,
                          borderRadius: '50%', background: 'var(--amber)', color: '#fff',
                          fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                        }}>{i + 1}</span>
                        <button
                          onClick={() => setRefExtraRefs(p => p.filter(r => r.id !== ref.id))}
                          className="group-hover:opacity-100"
                          style={{
                            position: 'absolute', inset: 0, borderRadius: 6, background: 'rgba(0,0,0,0.55)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14,
                            transition: 'opacity .12s ease',
                          }}
                        >✕</button>
                      </div>
                    ))}
                    <button
                      onClick={() => refFileEl.current?.click()}
                      style={{
                        width: 56, height: 42, borderRadius: 6, cursor: 'pointer',
                        border: `2px dashed ${isRefExtraDragging ? 'rgba(245,158,11,0.7)' : 'rgba(245,158,11,0.3)'}`,
                        background: isRefExtraDragging ? 'rgba(245,158,11,0.08)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'rgba(245,158,11,0.5)', fontSize: 18,
                      }}
                    >+</button>
                  </div>
                ) : (
                  <div
                    onClick={() => refFileEl.current?.click()}
                    style={{
                      border: `2px dashed ${isRefExtraDragging ? 'rgba(245,158,11,0.72)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 7,
                      padding: '8px 10px', textAlign: 'center', cursor: 'pointer', marginBottom: 8,
                      background: isRefExtraDragging ? 'rgba(245,158,11,0.08)' : 'transparent',
                      transition: 'background .15s, border-color .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.45)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = isRefExtraDragging ? 'rgba(245,158,11,0.72)' : 'rgba(245,158,11,0.2)')}
                  >
                    <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5 }}>
                      {isRefExtraDragging ? (
                        <span style={{ color: 'var(--amber)' }}>Solte as imagens aqui para mesclar.</span>
                      ) : (
                        <>
                          <span style={{ color: 'var(--amber)' }}>Adicione imagens</span> de objetos ou estilos para mesclar
                        </>
                      )}
                    </p>
                  </div>
                )}

                {refExtraRefs.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {REF_BLEND_SUGGESTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => setRefBlend(s)}
                          style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 20, cursor: 'pointer',
                            border: refBlend === s ? '1px solid var(--amber)' : '1px solid var(--border-md)',
                            background: refBlend === s ? 'rgba(245,158,11,0.1)' : 'transparent',
                            color: refBlend === s ? 'var(--amber)' : 'var(--text-3)',
                          }}
                        >{s}</button>
                      ))}
                    </div>
                    <textarea
                      value={refBlend}
                      onChange={e => setRefBlend(e.target.value)}
                      className="field"
                      rows={2}
                      placeholder="Como mesclar? Ex: use a cadeira como elemento central, mantendo a iluminação..."
                      style={{ fontSize: 11, resize: 'none', width: '100%' }}
                      disabled={isBusy}
                    />
                  </div>
                )}
              </div>

              {/* Quick prompts */}
              <div>
                <label className="label">Sugestões rápidas</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {REF_QUICK_PROMPTS.map(s => (
                    <button
                      key={s}
                      onClick={() => setRefPrompt(s)}
                      style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 20, cursor: 'pointer',
                        border: refPrompt === s ? '1px solid #22D3EE' : '1px solid var(--border-md)',
                        background: refPrompt === s ? 'rgba(34,211,238,0.1)' : 'transparent',
                        color: refPrompt === s ? '#22D3EE' : 'var(--text-3)',
                      }}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* Prompt textarea */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label className="label">Prompt de geração</label>
                <textarea
                  value={refPrompt}
                  onChange={e => setRefPrompt(e.target.value)}
                  className="field"
                  rows={4}
                  style={{ resize: 'none', fontSize: 12, flex: 1 }}
                  disabled={isBusy}
                />
              </div>

              {/* Generate button */}
              <button
                onClick={onRefGenerate}
                disabled={isBusy || !refPrompt.trim()}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isBusy ? <Spinner size={13} /> : <SparklesIcon width={13} height={13} />}
                {isBusy ? 'Gerando…'
                  : refRefScene
                    ? `Gerar com Cena ${refRefScene.scene_id}-${refRefScene.sub_id}`
                    : refExtraRefs.length > 0
                    ? `Gerar com ${refExtraRefs.length} ref.`
                    : refValidSel
                    ? 'Gerar com Região Selecionada'
                    : 'Gerar'}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ── Refinement section ───────────────────────────────────── */}
      {scene.isRefining && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', margin: '0 0 0 0',
          background: 'rgba(245,158,11,0.07)', borderTop: '1px solid rgba(245,158,11,0.18)',
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid rgba(245,158,11,0.3)', borderTopColor: '#F59E0B',
            animation: 'spin .7s linear infinite', flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: '#F59E0B' }}>Refinando com IA…</span>
        </div>
      )}

      {scene.refinement && !scene.isRefining && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Toggle button */}
          <button
            onClick={() => setShowRefinement(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', transition: 'background .12s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', flex: 1 }}>
              Análise de refinamento
            </span>
            {scene.refinement.needsSplit && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.30)',
                color: '#F59E0B', fontWeight: 600,
              }}>
                Divisão sugerida
              </span>
            )}
            <svg
              width={11} height={11} viewBox="0 0 24 24" fill="none"
              stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showRefinement ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease', flexShrink: 0 }}
            >
              <path d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {showRefinement && (
            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Split suggestion */}
              {scene.refinement.needsSplit && scene.refinement.splitSuggestion && (
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>
                      Dividir em {scene.refinement.splitSuggestion.length} sub-cenas
                    </p>
                    {onApplySplitSuggestion && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '3px 8px', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.30)' }}
                        onClick={() => onApplySplitSuggestion(scene.id)}
                      >
                        Aplicar divisão
                      </button>
                    )}
                  </div>
                  {scene.refinement.splitReason && (
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.5 }}>
                      {scene.refinement.splitReason}
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {scene.refinement.splitSuggestion.map((sub, i) => (
                      <div key={i} style={{
                        padding: '7px 10px', borderRadius: 6,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                      }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', marginBottom: 3 }}>
                          Sub-cena {i + 1}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 4 }}>
                          {sub.description}
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--mono)', lineHeight: 1.4 }}>
                          {sub.prompt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alternative prompt */}
              {scene.refinement.alternativePrompt && (
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.22)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA' }}>
                      Prompt alternativo
                    </p>
                    {onApplyAlternativePrompt && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '3px 8px', color: '#A78BFA', borderColor: 'rgba(139,92,246,0.30)' }}
                        onClick={() => onApplyAlternativePrompt(scene.id)}
                        title="Trocar o prompt atual pelo alternativo (o atual vira alternativo)"
                      >
                        Aplicar alternativo
                      </button>
                    )}
                  </div>
                  {scene.refinement.alternativeReason && (
                    <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
                      {scene.refinement.alternativeReason}
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    {scene.refinement.alternativePrompt}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {scene.imageUrl && (
        <ImageEditModal
          isOpen={isEditModalOpen}
          imageUrl={scene.imageUrl}
          onClose={() => { setIsEditModalOpen(false); setEditState({ isLoading: false, error: null }); }}
          onConfirm={handleConfirmEdit}
          isEditing={editState.isLoading}
          error={editState.error}
        />
      )}

      {editingSplit && (
        <ImageEditModal
          isOpen={true}
          imageUrl={editingSplit.imageUrl}
          onClose={() => { setEditingSplit(null); setSplitEditState({ isLoading: false, error: null }); }}
          onConfirm={async (prompt) => {
            if (!editingSplit) return;
            setSplitEditState({ isLoading: true, error: null });
            try {
              const { base64Data, mimeType } = await editImageService(editingSplit.imageUrl, prompt);
              const newUrl = `data:${mimeType};base64,${base64Data}`;
              onUpdateSplitImage?.(scene.id, editingSplit.id, newUrl, mimeType);
              setEditingSplit(null);
              setSplitEditState({ isLoading: false, error: null });
            } catch (e) {
              setSplitEditState({ isLoading: false, error: e instanceof Error ? e.message : 'Falha ao editar.' });
            }
          }}
          isEditing={splitEditState.isLoading}
          error={splitEditState.error}
        />
      )}

      <SceneSplitModal
        isOpen={isSplitModalOpen}
        sceneLabel={`Cena ${scene.scene_id}-${scene.sub_id} · ${scene.original_location}`}
        isGenerating={scene.isSplitting ?? false}
        onClose={() => { if (!scene.isSplitting) setIsSplitModalOpen(false); }}
        onGenerate={(count, instructions) => { setIsSplitModalOpen(false); onSplitScene(scene.id, count, instructions); }}
      />
    </>
  );
};

export default React.memo(SceneCard);
