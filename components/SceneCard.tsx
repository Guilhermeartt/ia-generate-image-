import React, { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import type {
  Character,
  Scene,
  SceneReference,
  SceneTemplateElement,
  SceneTemplateSlotOverride,
} from '../types';
import { SparklesIcon } from './icons';
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
import Spinner from './ui/Spinner';
import SceneCharacterTags from './SceneCharacterTags';
import SceneLettering from './SceneLettering';
import SceneContinuation from './SceneContinuation';
import SceneSplitSuggestion from './SceneSplitSuggestion';
import SceneActionButtons from './SceneActionButtons';
import SceneSplitGrid from './SceneSplitGrid';
import SceneReferencePanel from './SceneReferencePanel';
import SceneGenerationChecklist from './SceneGenerationChecklist';
import { REMOVE_ALL_VISUAL_PROMPT } from './sceneCard.constants';
import SafeTaggedDescription from './scene-card/SafeTaggedDescription';
import SceneCardHeader from './scene-card/SceneCardHeader';
import SceneCardCostStrip from './scene-card/SceneCardCostStrip';
import SceneCardImagePanel from './scene-card/SceneCardImagePanel';
import SceneTemplateControl from './scene-card/SceneTemplateControl';
import SceneTemplateOverrides from './scene-card/SceneTemplateOverrides';
import SceneTemplateEditorModal from './scene-card/SceneTemplateEditorModal';
import { useTemplateMarkup } from '../hooks/useTemplates';
import { listSlots } from './svg-editor/svgDocument';
import SceneCardEndFramePanel from './scene-card/SceneCardEndFramePanel';
import SceneCardRefinementPanel from './scene-card/SceneCardRefinementPanel';
import SceneCardCompareModal from './scene-card/SceneCardCompareModal';
import SceneCardCreativeModal from './scene-card/SceneCardCreativeModal';
import { useEditImageOperation, type EditImageService } from './scene-card/useEditImageOperation';
import { useSceneCardShortcuts } from './scene-card/useSceneCardShortcuts';
import { initialSceneCardState, sceneCardReducer } from './scene-card/sceneCardState';

interface SceneCardProps {
  scene: Scene;
  scenes: Scene[];
  characters: Character[];
  sceneIndex: number;
  availableStyles: string[];
  onImageUpdate: (id: number, newImageUrl: string, newMimeType: string) => void;
  onVisualize: (id: number) => void;
  onVisualizeWithReference: (id: number, prompt: string, croppedBase64: string | null, croppedMimeType: string | null, extraReferences?: { base64Data: string; mimeType: string }[], blendInstruction?: string) => void;
  editImageService: EditImageService;
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
  onSceneTemplateChange?: (id: number, templateId: string | undefined) => void;
  onSceneTemplateOverrideChange?: (id: number, slotId: string, override: SceneTemplateSlotOverride | undefined) => void;
  onSceneTemplateElementsChange?: (id: number, elements: SceneTemplateElement[]) => void;
}

const sceneArePropsEqual = (prev: SceneCardProps, next: SceneCardProps) => (
  prev.scene === next.scene
  && prev.characters === next.characters
  && prev.sceneIndex === next.sceneIndex
  && prev.scenes === next.scenes
  && prev.availableStyles === next.availableStyles
);

const SceneCard: React.FC<SceneCardProps> = (props) => {
  const {
    scene, scenes, characters, sceneIndex,
    onImageUpdate, onVisualize, onVisualizeWithReference, editImageService,
    onPreview, onPromptChange, onStyleChange, onContinuationChange,
    onSceneVisualStyleChange, onSceneCameraPositionChange, onSceneCharacterEdit,
    onContinuationReferenceChange, onUpdatePrompt, onRecreatePrompt, onRevertImage,
    onAnalyzeText, onEditRegion, onSplitScene, onClearSplit,
    onApplyAlternativePrompt, onApplySplitSuggestion,
    onGenerateEndFrame, onUpdateSplitImage,
    onOpenGraphicStyle, onClearGraphicStyle,
    onIncludeLetteringChange, onSceneReferencesChange, onSceneTemplateChange,
    onSceneTemplateOverrideChange,
    onSceneTemplateElementsChange,
  } = props;

  const cardRef = useRef<HTMLDivElement>(null);
  const templateMarkup = useTemplateMarkup(scene.templateId);
  const templateSlots = useMemo(
    () => (templateMarkup ? listSlots(templateMarkup) : []),
    [templateMarkup],
  );
  const [state, dispatch] = useReducer(sceneCardReducer, initialSceneCardState);
  const [isTemplateEditorOpen, setTemplateEditorOpen] = useState(false);

  const editImage = useEditImageOperation({
    editImageService,
    sceneId: scene.id,
    imageUrl: scene.imageUrl,
    onImageUpdate,
    onSuccess: () => dispatch({ type: 'CLOSE_EDIT' }),
  });

  const splitEditImage = useEditImageOperation({
    editImageService,
    sceneId: scene.id,
    imageUrl: state.editingSplit?.imageUrl,
    onImageUpdate: (sceneId, newUrl, mime) => {
      if (state.editingSplit) {
        onUpdateSplitImage?.(sceneId, state.editingSplit.id, newUrl, mime);
      }
    },
    onSuccess: () => dispatch({ type: 'STOP_EDITING_SPLIT' }),
  });

  const isBusy = scene.isLoading || scene.isAnalyzingText || editImage.isLoading;
  const busyMessage = scene.isLoading
    ? 'Gerando imagem…'
    : scene.isAnalyzingText
      ? 'Analisando texto…'
      : editImage.isLoading
        ? 'Editando imagem…'
        : '';

  // ── Reference data (memoized) ─────────────────────────────────────
  const referenceData = useMemo(() => {
    if (!scene.isContinuation) {
      return { isValid: true, isImageMissing: false, identifier: '' as string | number, referenceScene: undefined as Scene | undefined };
    }
    let referenceScene: Scene | undefined;
    let isValid = true;
    let identifier: string | number = '';
    if (scene.continuationReferenceId) {
      identifier = `Ordem ${scene.continuationReferenceId}`;
      if (scene.continuationReferenceId === scene.order) {
        isValid = false;
      } else {
        referenceScene = scenes.find(s => s.order === scene.continuationReferenceId);
        if (!referenceScene) isValid = false;
      }
    } else if (sceneIndex > 0) {
      identifier = 'anterior';
      referenceScene = scenes[sceneIndex - 1];
    }
    const isImageMissing = !!(isValid && referenceScene && !referenceScene.imageUrl);
    return { isValid, isImageMissing, identifier, referenceScene };
  }, [scene.isContinuation, scene.continuationReferenceId, scene.order, scenes, sceneIndex]);

  // ── Camera summary (memoized) ─────────────────────────────────────
  const cameraSummary = useMemo(() => {
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
    const positionLabel = CAMERA_POSITION_OPTIONS.find(o => o.id === selectedCameraPosition)?.label;
    const heightLabel = CAMERA_HEIGHT_OPTIONS.find(o => o.id === selectedCameraHeight)?.label;
    return {
      position: selectedCameraPosition,
      height: selectedCameraHeight,
      summary: [positionLabel, heightLabel].filter(Boolean).join(' · ') || 'Sem posição definida',
    };
  }, [scene.prompt_json?.camera?.relation_to_subject, scene.prompt_json?.camera?.framing, scene.image_prompt]);

  const handleDownload = useCallback(() => {
    if (!scene.imageUrl) return;
    const link = document.createElement('a');
    link.href = scene.imageUrl;
    link.download = `Cena_${scene.scene_id}-${scene.sub_id}.${scene.imageMimeType?.split('/')[1] || 'png'}`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }, [scene.imageUrl, scene.imageMimeType, scene.scene_id, scene.sub_id]);

  const handleRemoveAllVisualElements = useCallback(async () => {
    const prompt = `${REMOVE_ALL_VISUAL_PROMPT} Preserve a cena, personagens, enquadramento, iluminação, estilo visual, cores, profundidade e atmosfera. Preencha a área removida de forma natural, fotorrealista e coerente com o ambiente. Não adicione novos textos, logos, gráficos, interfaces ou elementos editoriais.`;
    await editImage.run(prompt);
  }, [editImage]);

  const handleRecreatePromptSubmit = useCallback(async (direction: string) => {
    if (!onRecreatePrompt) return;
    await Promise.resolve(onRecreatePrompt(scene.id, direction));
    dispatch({ type: 'CLOSE_CREATIVE' });
  }, [onRecreatePrompt, scene.id]);

  // ── Keyboard shortcuts ─────────────────────────────────────────
  useSceneCardShortcuts({
    cardRef,
    enabled: !isBusy,
    onGenerate: scene.imageUrl ? undefined : () => onVisualize(scene.id),
    onEdit: scene.imageUrl ? () => dispatch({ type: 'OPEN_EDIT' }) : undefined,
    onDownload: scene.imageUrl ? handleDownload : undefined,
    onRecreatePrompt: onRecreatePrompt ? () => dispatch({ type: 'OPEN_CREATIVE' }) : undefined,
  });

  const creativePromptBusy = Boolean(scene.isUpdatingPrompt);

  return (
    <>
      <div
        ref={cardRef}
        className="card card-hover anim-up sc-root"
      >
        <div className="sc-left">
          <div className="sc-image">
            <SceneCardImagePanel
              scene={scene}
              templateMarkup={templateMarkup}
              referenceData={referenceData}
              isBusy={isBusy}
              busyMessage={busyMessage}
              isRefTooltipOpen={state.isRefTooltipOpen}
              onPreview={onPreview}
              onAnalyzeText={() => onAnalyzeText(scene)}
              onDownload={handleDownload}
              onEditImage={() => dispatch({ type: 'OPEN_EDIT' })}
              onCompareVersions={() => dispatch({ type: 'OPEN_COMPARE' })}
              onRevertImage={() => onRevertImage(scene.id)}
              onVisualize={() => onVisualize(scene.id)}
              onToggleRefTooltip={() => dispatch({ type: 'TOGGLE_REF_TOOLTIP' })}
              onCloseRefTooltip={() => dispatch({ type: 'CLOSE_REF_TOOLTIP' })}
            />
            {onSceneTemplateChange && (
              <SceneTemplateControl
                scene={scene}
                disabled={isBusy}
                onChange={(templateId) => onSceneTemplateChange(scene.id, templateId)}
              />
            )}
            {onSceneTemplateOverrideChange && scene.templateId && templateMarkup && (
              <SceneTemplateOverrides
                scene={scene}
                slots={templateSlots}
                disabled={isBusy}
                onChange={(slotId, override) =>
                  onSceneTemplateOverrideChange(scene.id, slotId, override)
                }
                onEdit={() => setTemplateEditorOpen(true)}
              />
            )}
          </div>

          <div className="sc-left-meta">
            <SceneCardHeader scene={scene} />
            <SafeTaggedDescription text={scene.tagged_description} className="sc-description" />

            <SceneCharacterTags
              scene={scene}
              characters={characters}
              isBusy={isBusy}
              onSceneCharacterEdit={onSceneCharacterEdit}
            />

            <SceneLettering scene={scene} onIncludeLetteringChange={onIncludeLetteringChange} />
          </div>
        </div>

        <div className="sc-content">
          <SceneCardCostStrip scene={scene} />

          <SceneGenerationChecklist
            scene={scene}
            characters={characters}
            referenceSceneData={referenceData}
          />

          <SceneSplitSuggestion scene={scene} onOpenSplit={() => dispatch({ type: 'OPEN_SPLIT' })} />

          <SceneContinuation
            scene={scene}
            sceneIndex={sceneIndex}
            isBusy={isBusy}
            referenceSceneData={{
              isValid: referenceData.isValid,
              isImageMissing: referenceData.isImageMissing,
              identifier: String(referenceData.identifier),
            }}
            onContinuationChange={onContinuationChange}
            onContinuationReferenceChange={onContinuationReferenceChange}
          />

          {onSceneReferencesChange && (
            <div style={{ marginBottom: 10 }}>
              <SceneReferencesPanel
                references={scene.references ?? []}
                onChange={updater => onSceneReferencesChange(scene.id, updater)}
                disabled={isBusy}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <div>
              <label className="label" htmlFor={`sc-style-${scene.id}`}>Estética</label>
              <select
                id={`sc-style-${scene.id}`}
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

            <div>
              <label className="label">Tipo de plano / câmera</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <ShotTypeSelector
                  value={scene.style}
                  onChange={(v) => onStyleChange(scene.id, v)}
                  disabled={isBusy || scene.isUpdatingPrompt}
                />
                {!scene.prompt_json && (
                  <button
                    type="button"
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
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', margin: 0 }}>
                      {cameraSummary.summary}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
                      Controle 3D carregado sob demanda.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'TOGGLE_CAMERA' })}
                    disabled={isBusy || scene.isUpdatingPrompt}
                    className="btn btn-ghost"
                    style={{
                      fontSize: 11, padding: '5px 9px', flexShrink: 0,
                      color: state.isCameraControlOpen ? 'var(--violet-text-h)' : 'var(--text-3)',
                      borderColor: state.isCameraControlOpen ? 'rgba(139,92,246,0.55)' : 'var(--border-md)',
                    }}
                    aria-expanded={state.isCameraControlOpen}
                  >
                    {state.isCameraControlOpen ? 'Fechar 3D' : 'Abrir 3D'}
                  </button>
                </div>
                {state.isCameraControlOpen && (
                  <div style={{ marginTop: 8 }}>
                    <CameraPositionControl
                      position={cameraSummary.position}
                      height={cameraSummary.height}
                      disabled={isBusy || scene.isUpdatingPrompt}
                      onChange={(position, height) => onSceneCameraPositionChange(scene.id, position, height)}
                    />
                  </div>
                )}
              </div>
            )}

            {onOpenGraphicStyle && (
              <div>
                <label className="label">Refinamento gráfico</label>
                <button
                  type="button"
                  onClick={() => onOpenGraphicStyle(scene.id)}
                  disabled={isBusy}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, width: '100%', justifyContent: 'flex-start', gap: 7 }}
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12a4 4 0 0 1 8 0" />
                    <line x1="12" y1="8" x2="12" y2="8.01" />
                  </svg>
                  {scene.sceneGraphicStyle
                    ? <><span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{scene.sceneGraphicStyle.label}</span><span style={{ color: 'var(--text-4)', marginLeft: 'auto', fontSize: 11 }}>Alterar</span></>
                    : <span style={{ color: 'var(--text-4)' }}>Usar estilo global · clique para definir por cena</span>
                  }
                </button>
                {scene.sceneGraphicStyle && onClearGraphicStyle && (
                  <button
                    type="button"
                    onClick={() => onClearGraphicStyle(scene.id)}
                    style={{ fontSize: 10, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', textDecoration: 'underline' }}
                  >
                    Remover · usar estilo global
                  </button>
                )}
              </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <label className="label" htmlFor={`sc-prompt-${scene.id}`} style={{ marginBottom: 0 }}>Prompt de Imagem</label>
                {onRecreatePrompt && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'OPEN_CREATIVE' })}
                    disabled={isBusy || creativePromptBusy}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600,
                      color: 'var(--violet-text)',
                      background: 'none',
                      border: '1px solid transparent',
                      borderRadius: 6, padding: '3px 8px',
                      cursor: (isBusy || creativePromptBusy) ? 'not-allowed' : 'pointer',
                      opacity: (isBusy || creativePromptBusy) ? 0.5 : 1,
                    }}
                    title="Cmd/Ctrl+R: descreva uma nova direção criativa e a IA refaz o prompt"
                  >
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Refazer direção criativa
                  </button>
                )}
              </div>

              <textarea
                id={`sc-prompt-${scene.id}`}
                value={scene.image_prompt}
                onChange={e => onPromptChange(scene.id, e.target.value)}
                className="field"
                rows={4}
                style={{ resize: 'none', fontSize: 12, flex: 1, minHeight: 80, marginTop: 4 }}
                disabled={isBusy || scene.isUpdatingPrompt}
                aria-label="Prompt da imagem"
              />
            </div>
          </div>

          <SceneActionButtons
            scene={scene}
            isBusy={isBusy}
            referenceSceneData={referenceData}
            onOpenRefPanel={() => dispatch({ type: 'OPEN_REF_PANEL' })}
            onEditRegion={() => onEditRegion(scene)}
            onVisualize={() => onVisualize(scene.id)}
            onRemoveVisualElements={async (instruction) => {
              if (instruction === REMOVE_ALL_VISUAL_PROMPT) {
                await handleRemoveAllVisualElements();
              } else {
                const prompt = `${instruction} Preserve a cena, personagens, enquadramento, iluminação, estilo visual, cores, profundidade e atmosfera. Preencha a área removida de forma natural, fotorrealista e coerente com o ambiente. Não adicione novos textos, logos, gráficos, interfaces ou elementos editoriais.`;
                await editImage.run(prompt);
              }
            }}
            onOpenSplit={() => dispatch({ type: 'OPEN_SPLIT' })}
            onGenerateEndFrame={onGenerateEndFrame ? () => onGenerateEndFrame(scene.id) : undefined}
          />
        </div>
      </div>

      <SceneSplitGrid
        scene={scene}
        onClearSplit={() => onClearSplit(scene.id)}
        onPreview={onPreview}
        onEditSplit={onUpdateSplitImage ? (split) => { dispatch({ type: 'START_EDITING_SPLIT', payload: split }); splitEditImage.reset(); } : undefined}
      />

      <SceneCardEndFramePanel scene={scene} onPreview={onPreview} />

      {state.isRefPanelOpen && scene.imageUrl && (
        <SceneReferencePanel
          scene={scene}
          scenes={scenes}
          isBusy={isBusy}
          onVisualizeWithReference={onVisualizeWithReference}
          onClose={() => dispatch({ type: 'CLOSE_REF_PANEL' })}
        />
      )}

      <SceneCardRefinementPanel
        scene={scene}
        onApplySplitSuggestion={onApplySplitSuggestion}
        onApplyAlternativePrompt={onApplyAlternativePrompt}
      />

      {scene.imageUrl && (
        <ImageEditModal
          isOpen={state.isEditModalOpen}
          imageUrl={scene.imageUrl}
          onClose={() => { dispatch({ type: 'CLOSE_EDIT' }); editImage.reset(); }}
          onConfirm={async (prompt) => { await editImage.run(prompt); }}
          isEditing={editImage.isLoading}
          error={editImage.error}
        />
      )}

      {state.editingSplit && (
        <ImageEditModal
          isOpen
          imageUrl={state.editingSplit.imageUrl}
          onClose={() => { dispatch({ type: 'STOP_EDITING_SPLIT' }); splitEditImage.reset(); }}
          onConfirm={async (prompt) => { await splitEditImage.run(prompt); }}
          isEditing={splitEditImage.isLoading}
          error={splitEditImage.error}
        />
      )}

      <SceneSplitModal
        isOpen={state.isSplitModalOpen}
        sceneLabel={`Cena ${scene.scene_id}-${scene.sub_id} · ${scene.original_location}`}
        isGenerating={scene.isSplitting ?? false}
        onClose={() => { if (!scene.isSplitting) dispatch({ type: 'CLOSE_SPLIT' }); }}
        onGenerate={(count, instructions) => { dispatch({ type: 'CLOSE_SPLIT' }); onSplitScene(scene.id, count, instructions); }}
      />

      {state.isCreativeOpen && onRecreatePrompt && (
        <SceneCardCreativeModal
          sceneLabel={`Cena ${scene.scene_id}-${scene.sub_id} · ${scene.original_location}`}
          initialValue={state.creativeDirection}
          isBusy={creativePromptBusy}
          onCancel={() => dispatch({ type: 'CLOSE_CREATIVE' })}
          onSubmit={handleRecreatePromptSubmit}
        />
      )}

      {state.isCompareOpen && scene.previousImageUrl && scene.imageUrl && (
        <SceneCardCompareModal
          previousUrl={scene.previousImageUrl}
          currentUrl={scene.imageUrl}
          onClose={() => dispatch({ type: 'CLOSE_COMPARE' })}
        />
      )}

      {isTemplateEditorOpen && templateMarkup && onSceneTemplateOverrideChange && onSceneTemplateElementsChange && (
        <SceneTemplateEditorModal
          scene={scene}
          markup={templateMarkup}
          slots={templateSlots}
          onClose={() => setTemplateEditorOpen(false)}
          onChange={(slotId, override) =>
            onSceneTemplateOverrideChange(scene.id, slotId, override)
          }
          onElementsChange={(elements) => onSceneTemplateElementsChange(scene.id, elements)}
        />
      )}
    </>
  );
};

export default React.memo(SceneCard, sceneArePropsEqual);
