import React, { useState } from 'react';
import type { Scene } from '../types';
import { EditIcon, SparklesIcon, DownloadIcon, RevertIcon, TextAnalysisIcon, ReloadIcon } from './icons';
import ImageLoader from './ImageLoader';
import ImageEditModal from './ImageEditModal';
import SceneReferenceModal from './SceneReferenceModal';
import SceneSplitModal from './SceneSplitModal';

interface SceneCardProps {
  scene: Scene;
  scenes: Scene[];
  sceneIndex: number;
  availableStyles: string[];
  onImageUpdate: (id: number, newImageUrl: string, newMimeType: string) => void;
  onVisualize: (id: number) => void;
  onVisualizeWithReference: (id: number, prompt: string, croppedBase64: string | null, croppedMimeType: string | null, extraReferences?: { base64Data: string; mimeType: string }[], blendInstruction?: string) => void;
  editImageService: (base64: string, prompt: string) => Promise<{ base64Data: string, mimeType: string }>;
  onPreview: (url: string) => void;
  onPromptChange: (id: number, newPrompt: string) => void;
  onStyleChange: (id: number, newStyle: string) => void;
  onContinuationChange: (id: number, isChecked: boolean) => void;
  onContinuationReferenceChange: (id: number, refId: string) => void;
  onUpdatePrompt: (id: number) => void;
  onRevertImage: (id: number) => void;
  onAnalyzeText: (scene: Scene) => void;
  onSplitScene: (sceneId: number, count: number, instructions: string) => void;
  onClearSplit: (sceneId: number) => void;
}

const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

const modelLabelShort = (model: string): string => {
  switch (model) {
    case 'gemini-2.5-flash-image':         return 'Flash 2.5';
    case 'gemini-3.1-flash-image-preview': return 'Flash 3.1';
    case 'gemini-3-pro-image-preview':     return 'Pro 3';
    case 'imagen-4.0-generate-001':        return 'Imagen 4';
    default:                               return model.split('-')[0];
  }
};

const SceneCard: React.FC<SceneCardProps> = ({
  scene, scenes, sceneIndex, availableStyles,
  onImageUpdate, onVisualize, onVisualizeWithReference, editImageService,
  onPreview, onPromptChange, onStyleChange, onContinuationChange,
  onContinuationReferenceChange, onUpdatePrompt, onRevertImage, onAnalyzeText,
  onSplitScene, onClearSplit,
}) => {
  const [isEditModalOpen, setIsEditModalOpen]       = useState(false);
  const [editState, setEditState]                   = useState<{ isLoading: boolean; error: string | null }>({ isLoading: false, error: null });
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const [referenceModalError, setReferenceModalError]   = useState<string | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen]     = useState(false);

  const getReferenceSceneData = () => {
    if (!scene.isContinuation) return { isValid: true, isImageMissing: false, identifier: '' };
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
    return { isValid, isImageMissing, identifier };
  };

  const referenceSceneData = getReferenceSceneData();
  const characterTags = [...new Set((scene.tagged_description.match(/\[(.*?)\]/g) || []))];
  const isBusy = scene.isLoading || scene.isAnalyzingText;

  let busyMessage = '';
  if (scene.isLoading) busyMessage = 'Gerando imagem de cena...';
  else if (scene.isAnalyzingText) busyMessage = 'Analisando texto...';

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
    link.download = `Cena ${scene.scene_id} - Img ${scene.order}.${scene.imageMimeType?.split('/')[1] || 'png'}`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const renderImageContainer = () => {
    if (scene.imageUrl) {
      return (
        <>
          <button onClick={() => onPreview(scene.imageUrl!)} className="w-full h-full block group">
            <img
              src={scene.imageUrl}
              alt={`Cena em ${scene.original_location}`}
              className="w-full h-64 md:h-full object-cover aspect-video transition-transform duration-500 group-hover:scale-105"
            />
          </button>

          {isBusy && <ImageLoader message={busyMessage} />}

          {/* Dim overlay */}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all duration-300 pointer-events-none" />

          {/* Dimensions — bottom right */}
          {scene.imageWidth && scene.imageHeight && (
            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg pointer-events-none z-10 font-mono">
              {scene.imageWidth}×{scene.imageHeight}
              <span className="ml-1.5 text-slate-400">
                {scene.imageWidth / gcd(scene.imageWidth, scene.imageHeight)}:
                {scene.imageHeight / gcd(scene.imageWidth, scene.imageHeight)}
              </span>
            </div>
          )}

          {/* Status bar — top left */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
            <div className="group/dot relative flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black/50 block animate-pulse-glow" />
              <div className="absolute bottom-full left-0 mb-1.5 w-max px-2.5 py-1.5 bg-slate-900/95 backdrop-blur-sm text-white text-xs rounded-xl border border-white/10 opacity-0 group-hover/dot:opacity-100 transition-opacity pointer-events-none z-20">
                Imagem Gerada
              </div>
            </div>
            {(scene.costBRL !== undefined || scene.modelUsed) && (
              <div
                className="bg-black/65 backdrop-blur-sm text-xs px-2.5 py-1 rounded-xl pointer-events-none flex items-center gap-1.5 border border-white/5"
                title={scene.tokens ? `${scene.tokens.toLocaleString('pt-BR')} tokens` : 'Custo estimado'}
              >
                {scene.modelUsed && (
                  <span className="text-violet-400 font-semibold">{modelLabelShort(scene.modelUsed)}</span>
                )}
                {scene.costBRL !== undefined && (
                  <>
                    {scene.modelUsed && <span className="text-white/15">·</span>}
                    <span className="text-emerald-400">R${scene.costBRL.toFixed(3).replace('.', ',')}</span>
                    {scene.tokens && <span className="text-slate-600">{(scene.tokens / 1000).toFixed(1)}K tk</span>}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Top-right icon buttons */}
          <div className="absolute top-2 right-2 flex gap-1.5 z-10">
            <button onClick={() => onAnalyzeText(scene)} disabled={isBusy}
              className="p-2 rounded-xl bg-black/55 backdrop-blur-sm hover:bg-purple-600/80 disabled:opacity-40 transition-all"
              title="Analisar texto">
              <TextAnalysisIcon />
            </button>
            <button onClick={handleDownload} disabled={isBusy}
              className="p-2 rounded-xl bg-black/55 backdrop-blur-sm hover:bg-emerald-600/80 disabled:opacity-40 transition-all"
              title="Baixar imagem">
              <DownloadIcon />
            </button>
            <button onClick={() => setIsEditModalOpen(true)} disabled={isBusy}
              className="p-2 rounded-xl bg-black/55 backdrop-blur-sm hover:bg-violet-600/80 disabled:opacity-40 transition-all"
              title="Editar imagem">
              <EditIcon />
            </button>
          </div>

          {/* Previous image revert — bottom left */}
          {scene.previousImageUrl && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm p-1 rounded-xl z-10">
              <img src={scene.previousImageUrl} alt="Versão anterior"
                className="w-12 h-9 object-cover rounded-lg border border-white/10" />
              <button onClick={() => onRevertImage(scene.id)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-yellow-500/70 transition-colors" title="Reverter">
                <RevertIcon />
              </button>
            </div>
          )}
        </>
      );
    }

    if (scene.isLoading) {
      return (
        <div className="w-full h-64 md:h-full aspect-video flex items-center justify-center bg-violet-500/5">
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 border-2 border-violet-500/30 border-t-violet-400 rounded-full" style={{animation:'spin .8s linear infinite'}} />
            <p className="text-xs text-slate-500">Gerando visualização...</p>
          </div>
        </div>
      );
    }

    if (scene.error) {
      return (
        <div className="w-full h-64 md:h-full aspect-video flex flex-col items-center justify-center text-center p-5 bg-red-500/5">
          <p className="text-red-400 font-semibold">Erro ao Gerar</p>
          <p className="text-xs text-red-400/70 mt-1 max-w-xs">{scene.error}</p>
          <button onClick={() => onVisualize(scene.id)}
            disabled={!referenceSceneData.isValid || referenceSceneData.isImageMissing}
            className="btn-primary mt-4 px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40">
            Tentar Novamente
          </button>
        </div>
      );
    }

    return (
      <div className="w-full h-64 md:h-full aspect-video flex flex-col items-center justify-center text-center p-5 bg-violet-500/5">
        <div className="w-14 h-14 flex items-center justify-center bg-violet-500/10 border border-violet-500/20 rounded-2xl mb-4">
          <SparklesIcon className="text-violet-400" />
        </div>
        <h4 className="text-base font-bold text-slate-200">Visualizar esta Cena</h4>
        <p className="text-xs text-slate-500 mt-1 mb-5 max-w-xs">Gere uma imagem de IA para esta cena do roteiro.</p>
        <button
          onClick={() => onVisualize(scene.id)}
          disabled={!referenceSceneData.isValid || referenceSceneData.isImageMissing}
          className="btn-primary px-7 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40"
        >
          Gerar Visualização
        </button>
        {referenceSceneData.isImageMissing && (
          <p className="text-xs text-yellow-500/80 mt-3 max-w-xs">
            A cena de referência ({referenceSceneData.identifier}) precisa ser gerada primeiro.
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="glass glass-hover rounded-2xl overflow-hidden flex flex-col md:flex-row transition-all duration-300 animate-fade-in-up">
        {/* Image panel */}
        <div className="md:w-2/5 lg:w-1/3 relative flex-shrink-0 overflow-hidden">
          {renderImageContainer()}
        </div>

        {/* Content panel */}
        <div className="p-6 md:w-3/5 lg:w-2/3 flex flex-col">
          {/* Header row */}
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-bold text-lg text-white leading-tight">{scene.original_location}</h3>
            <span className="text-xs font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2.5 py-1 rounded-xl flex-shrink-0 ml-3">
              C:{scene.scene_id} / S:{scene.sub_id} / O:{scene.order}
            </span>
          </div>

          {/* Description */}
          <p
            className="text-slate-400 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: scene.tagged_description.replace(
                /\[(.*?)\]/g,
                '<strong class="text-violet-300 font-semibold">[$1]</strong>'
              )
            }}
          />

          {/* Character tags */}
          {characterTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Personagens:</span>
              {characterTags.map((tag: string) => (
                <span key={tag} className="bg-violet-500/10 text-violet-300 text-xs font-medium px-2.5 py-1 rounded-xl border border-violet-500/15">
                  {tag.slice(1, -1)}
                </span>
              ))}
            </div>
          )}

          {/* Continuation toggle */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
                <input
                  type="checkbox"
                  checked={!!scene.isContinuation}
                  onChange={(e) => onContinuationChange(scene.id, e.target.checked)}
                  disabled={sceneIndex === 0 || isBusy}
                  className="w-4 h-4 rounded accent-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                Continuação da cena anterior
              </label>
              <span className="text-xs text-slate-700" title="Use [ref:Ordem] na coluna context do CSV">
                Dica: [ref:Ordem]
              </span>
            </div>
            {sceneIndex === 0 && <p className="text-xs text-slate-700 ml-6 mt-1">A primeira cena não pode ser uma continuação.</p>}
            {scene.isContinuation && (
              <div className="ml-6 mt-2">
                <div className="flex items-center gap-2">
                  <label htmlFor={`ref-${scene.id}`} className="text-xs font-semibold text-slate-500 flex-shrink-0">Ordem de Referência:</label>
                  <input
                    type="number"
                    id={`ref-${scene.id}`}
                    value={scene.continuationReferenceId ?? ''}
                    onChange={(e) => onContinuationReferenceChange(scene.id, e.target.value)}
                    placeholder="Padrão: anterior"
                    disabled={isBusy}
                    min="1"
                    className={`input-glass w-28 rounded-xl px-2.5 py-1.5 text-sm ${!referenceSceneData.isValid ? 'border-red-500/50' : ''}`}
                  />
                </div>
                {!referenceSceneData.isValid && (
                  <p className="text-xs text-red-400 mt-1">Ordem da cena não encontrada.</p>
                )}
                {referenceSceneData.isImageMissing && (
                  <p className="text-xs text-yellow-500/80 mt-1">
                    A imagem da cena ({referenceSceneData.identifier}) precisa ser gerada primeiro.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Style + prompt */}
          <div className="mt-4 flex-grow flex flex-col gap-3">
            <div>
              <label htmlFor={`style-${scene.id}`} className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 block">Estilo da Cena</label>
              <div className="flex items-center gap-2">
                <select
                  id={`style-${scene.id}`}
                  value={scene.style}
                  onChange={(e) => onStyleChange(scene.id, e.target.value)}
                  className="input-glass rounded-xl px-3 py-2 text-sm w-full flex-grow"
                  disabled={isBusy || scene.isUpdatingPrompt}
                >
                  <option value="">Sem estilo</option>
                  {availableStyles.sort().map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
                <button
                  onClick={() => onUpdatePrompt(scene.id)}
                  disabled={isBusy || scene.isUpdatingPrompt}
                  className="btn-ghost flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl"
                  title="Atualizar prompt com o estilo selecionado"
                >
                  {scene.isUpdatingPrompt
                    ? <div className="w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full" style={{animation:'spin .8s linear infinite'}} />
                    : <ReloadIcon width={14} height={14} />}
                  <span>{scene.isUpdatingPrompt ? '' : 'Atualizar'}</span>
                </button>
              </div>
            </div>
            <div>
              <label htmlFor={`prompt-${scene.id}`} className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 block">Prompt de Imagem</label>
              <textarea
                id={`prompt-${scene.id}`}
                value={scene.image_prompt}
                onChange={(e) => onPromptChange(scene.id, e.target.value)}
                className="input-glass w-full rounded-xl p-2.5 text-sm resize-none"
                rows={4}
                disabled={isBusy || scene.isUpdatingPrompt}
              />
            </div>
          </div>

          {/* Action buttons */}
          {!scene.isLoading && scene.imageUrl && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => { setReferenceModalError(null); setIsReferenceModalOpen(true); }}
                disabled={isBusy || scene.isUpdatingPrompt}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl"
                title="Selecionar referência visual e regerar"
              >
                <SparklesIcon width={15} height={15} />
                Gerar Novamente
              </button>
              <button
                onClick={() => onVisualize(scene.id)}
                disabled={isBusy || scene.isUpdatingPrompt || !referenceSceneData.isValid || referenceSceneData.isImageMissing}
                className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-40"
                title="Regerar sem abrir modal de referência"
              >
                <ReloadIcon width={14} height={14} />
                Rápido
              </button>
              <button
                onClick={() => setIsSplitModalOpen(true)}
                disabled={isBusy || scene.isUpdatingPrompt || scene.isSplitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-400 bg-white/5 border border-white/8 hover:bg-violet-500/15 hover:text-violet-300 hover:border-violet-500/25 rounded-xl disabled:opacity-40 transition-all"
                title="Dividir em múltiplos planos"
              >
                {scene.isSplitting
                  ? <div className="w-3.5 h-3.5 border-2 border-slate-400/30 border-t-slate-400 rounded-full" style={{animation:'spin .8s linear infinite'}} />
                  : (
                    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/>
                    </svg>
                  )}
                {scene.isSplitting ? 'Dividindo...' : 'Dividir'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Split images grid */}
      {scene.splitImages && scene.splitImages.length > 0 && (
        <div className="mt-4 glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/>
              </svg>
              Planos gerados ({scene.splitImages.length})
            </h4>
            <button onClick={() => onClearSplit(scene.id)}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors">
              ✕ Limpar
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {scene.splitImages.map((img, idx) => (
              <div key={img.id} className="relative rounded-xl overflow-hidden bg-black/30 border border-white/5 group">
                {img.isLoading ? (
                  <div className="aspect-video flex flex-col items-center justify-center gap-2 p-2">
                    <div className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full" style={{animation:'spin .8s linear infinite'}} />
                    <p className="text-xs text-slate-600">Plano {idx + 1}</p>
                  </div>
                ) : img.error ? (
                  <div className="aspect-video flex flex-col items-center justify-center p-2 text-center">
                    <p className="text-xs text-red-400">Erro</p>
                    <p className="text-xs text-red-400/60 mt-1 line-clamp-2">{img.error}</p>
                  </div>
                ) : img.imageUrl ? (
                  <>
                    <button onClick={() => onPreview(img.imageUrl!)} className="block w-full">
                      <img src={img.imageUrl} alt={`Plano ${idx + 1}`}
                        className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105" />
                    </button>
                    {/* Prompt on hover */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white line-clamp-2 leading-tight">{img.prompt}</p>
                    </div>
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
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-600/80"
                      title="Baixar plano"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    {/* Plan number + model badge */}
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                      <div className="bg-black/65 text-white text-xs px-1.5 py-0.5 rounded-lg font-semibold">
                        {idx + 1}
                      </div>
                      {(img.modelUsed || img.costBRL !== undefined) && (
                        <div className="bg-black/65 text-xs px-1.5 py-0.5 rounded-lg flex items-center gap-1"
                          title={img.tokens ? `${img.tokens.toLocaleString('pt-BR')} tokens` : 'Custo estimado'}>
                          {img.modelUsed && <span className="text-violet-400">{modelLabelShort(img.modelUsed)}</span>}
                          {img.costBRL !== undefined && <span className="text-emerald-400">R${img.costBRL.toFixed(3).replace('.', ',')}</span>}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
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

      {scene.imageUrl && (
        <SceneReferenceModal
          isOpen={isReferenceModalOpen}
          imageUrl={scene.imageUrl}
          currentPrompt={scene.image_prompt}
          currentSceneId={scene.id}
          scenes={scenes}
          isGenerating={scene.isLoading ?? false}
          error={referenceModalError}
          onClose={() => { if (!scene.isLoading) { setIsReferenceModalOpen(false); setReferenceModalError(null); } }}
          onGenerate={({ prompt, croppedBase64, croppedMimeType, extraReferences, blendInstruction }) => {
            setReferenceModalError(null);
            onVisualizeWithReference(scene.id, prompt, croppedBase64, croppedMimeType, extraReferences, blendInstruction);
            setIsReferenceModalOpen(false);
          }}
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
