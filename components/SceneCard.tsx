

import React, { useState } from 'react';
import type { Scene } from '../types';
import { EditIcon, SparklesIcon, DownloadIcon, RevertIcon, TextAnalysisIcon, ReloadIcon } from './icons';
import ImageLoader from './ImageLoader';
import ImageEditModal from './ImageEditModal';

interface SceneCardProps {
  scene: Scene;
  scenes: Scene[];
  sceneIndex: number;
  availableStyles: string[];
  onImageUpdate: (id: number, newImageUrl: string, newMimeType: string) => void;
  onVisualize: (id: number) => void;
  editImageService: (base64: string, prompt: string) => Promise<{ base64Data: string, mimeType: string }>;
  onPreview: (url: string) => void;
  onPromptChange: (id: number, newPrompt: string) => void;
  onStyleChange: (id: number, newStyle: string) => void;
  onContinuationChange: (id: number, isChecked: boolean) => void;
  onContinuationReferenceChange: (id: number, refId: string) => void;
  onUpdatePrompt: (id: number) => void;
  onRevertImage: (id: number) => void;
  onAnalyzeText: (scene: Scene) => void;
}

const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b);
};

const SceneCard: React.FC<SceneCardProps> = ({ scene, scenes, sceneIndex, availableStyles, onImageUpdate, onVisualize, editImageService, onPreview, onPromptChange, onStyleChange, onContinuationChange, onContinuationReferenceChange, onUpdatePrompt, onRevertImage, onAnalyzeText }) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editState, setEditState] = useState<{ isLoading: boolean; error: string | null }>({ isLoading: false, error: null });

    // Removido o useMemo para garantir que o cálculo seja sempre executado em cada renderização relevante.
    // Como o próprio SceneCard é memoizado, isso só será executado quando os adereços (como 'cenas') mudarem, o que é o comportamento desejado.
    const getReferenceSceneData = () => {
        if (!scene.isContinuation) {
            return { isValid: true, isImageMissing: false, identifier: '' };
        }

        let referenceScene: Scene | undefined;
        let isValid = true;
        let identifier: string | number = '';

        if (scene.continuationReferenceId) {
            identifier = `Ordem ${scene.continuationReferenceId}`;
            referenceScene = scenes.find(s => s.order === scene.continuationReferenceId);
            if (!referenceScene) {
                isValid = false;
            }
        } else if (sceneIndex > 0) {
            identifier = 'anterior';
            referenceScene = scenes[sceneIndex - 1];
        }
        
        const isImageMissing = !!(isValid && referenceScene && !referenceScene.imageUrl);

        return { isValid, isImageMissing, identifier };
    };
    
    const referenceSceneData = getReferenceSceneData();

    const characterTags = [...new Set((scene.tagged_description.match(/\[(.*?)\]/g) || []))];

    const handleConfirmEdit = async (prompt: string) => {
        if (!scene.imageUrl) return;

        setEditState({ isLoading: true, error: null });
        try {
            const { base64Data, mimeType } = await editImageService(scene.imageUrl, prompt);
            onImageUpdate(scene.id, `data:${mimeType};base64,${base64Data}`, mimeType);
            setIsEditModalOpen(false);
            setEditState({ isLoading: false, error: null });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Falha ao editar a imagem.";
            setEditState({ isLoading: false, error: errorMessage });
        }
    };

    const handleDownload = () => {
        if (!scene.imageUrl) return;
        const link = document.createElement('a');
        link.href = scene.imageUrl;
        const extension = scene.imageMimeType?.split('/')[1] || 'png';
        link.download = `Cena ${scene.scene_id} - Img ${scene.order}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderImageContainer = () => {
        const isBusy = scene.isLoading || scene.isAnalyzingText;
        
        let busyMessage = '';
        if (scene.isLoading) busyMessage = 'Gerando imagem de cena...';
        else if (scene.isAnalyzingText) busyMessage = 'Analisando texto...';

        if (scene.imageUrl) {
            return (
                <>
                    <button onClick={() => onPreview(scene.imageUrl!)} className="w-full h-full block cursor-pointer group">
                        <img src={scene.imageUrl} alt={`Cena em ${scene.original_location}`} className="w-full h-64 md:h-full object-cover aspect-video transition-transform duration-300 group-hover:scale-105" />
                    </button>
                    {isBusy && <ImageLoader message={busyMessage} />}
                    {scene.imageWidth && scene.imageHeight && (
                        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md pointer-events-none z-10">
                            <span>{scene.imageWidth}x{scene.imageHeight}</span>
                            <span className="ml-2 text-slate-400">
                                {(scene.imageWidth / gcd(scene.imageWidth, scene.imageHeight))}:
                                {(scene.imageHeight / gcd(scene.imageWidth, scene.imageHeight))}
                            </span>
                        </div>
                    )}
                    <div className="absolute top-2 left-2">
                        <div className="group relative flex items-center">
                            <span className="w-3 h-3 rounded-full bg-green-400 ring-2 ring-slate-900/50" />
                            <div className="absolute bottom-full left-0 mb-1 w-max px-2 py-1 bg-slate-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Imagem Gerada
                            </div>
                        </div>
                    </div>
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                         <button
                            onClick={() => onAnalyzeText(scene)}
                            disabled={isBusy}
                            className="p-2 bg-black/50 rounded-full hover:bg-purple-600 disabled:bg-slate-600/80 disabled:cursor-not-allowed transition-colors"
                            aria-label="Analisar Texto na Imagem"
                            title="Analisar Texto na Imagem"
                         >
                            <TextAnalysisIcon />
                         </button>
                         <button 
                            onClick={handleDownload}
                            disabled={isBusy}
                            className="p-2 bg-black/50 rounded-full hover:bg-green-600 disabled:bg-slate-600/80 disabled:cursor-not-allowed transition-colors"
                            aria-label="Baixar Imagem"
                        >
                            <DownloadIcon />
                        </button>
                        <button 
                            onClick={() => setIsEditModalOpen(true)}
                             disabled={isBusy}
                            className="p-2 bg-black/50 rounded-full hover:bg-cyan-600 disabled:bg-slate-600/80 disabled:cursor-not-allowed transition-colors"
                            aria-label="Editar Imagem"
                        >
                            <EditIcon />
                        </button>
                    </div>
                    {scene.previousImageUrl && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 p-1 rounded-lg backdrop-blur-sm z-10">
                            <img src={scene.previousImageUrl} alt="Versão anterior" className="w-16 h-16 object-cover rounded" />
                            <button
                                onClick={() => onRevertImage(scene.id)}
                                className="p-2 bg-slate-700/50 rounded-full hover:bg-yellow-600 transition-colors"
                                aria-label="Reverter para esta versão"
                            >
                                <RevertIcon />
                            </button>
                        </div>
                    )}
                </>
            );
        }

        if (scene.isLoading) {
            return (
                <div className="w-full h-64 md:h-full bg-slate-700/50 p-4 aspect-video flex items-center justify-center">
                  <div className="w-full h-full border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center text-center">
                    <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-3 text-sm text-slate-300">Gerando visualização...</p>
                  </div>
                </div>
            );
        }

        if (scene.error) {
            return (
                <div className="w-full h-64 md:h-full bg-red-900/30 flex flex-col items-center justify-center text-center p-4 aspect-video">
                    <p className="text-red-400 font-semibold">Erro ao Gerar Imagem</p>
                    <p className="text-xs text-red-300 mt-2 max-w-xs">{scene.error}</p>
                    <button
                        onClick={() => onVisualize(scene.id)}
                        disabled={!referenceSceneData.isValid || referenceSceneData.isImageMissing}
                        className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        Tentar Novamente
                    </button>
                </div>
            );
        }

        return (
            <div className="w-full h-64 md:h-full bg-slate-800 flex flex-col items-center justify-center text-center p-4 transition-all aspect-video">
                <div className="w-16 h-16 flex items-center justify-center bg-slate-700 rounded-full mb-4 text-cyan-400">
                    <SparklesIcon />
                </div>
                 <h4 className="text-lg font-semibold text-slate-100">Visualizar esta Cena</h4>
                 <p className="text-sm text-slate-400 mt-1 mb-4 max-w-xs">Clique no botão para gerar uma imagem de IA para esta cena.</p>
                 <button
                    onClick={() => onVisualize(scene.id)}
                    disabled={!referenceSceneData.isValid || referenceSceneData.isImageMissing}
                    className="px-6 py-2 text-md font-semibold text-white bg-cyan-600 rounded-lg shadow-md hover:bg-cyan-700 transition-all transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none"
                 >
                    Gerar Visualização
                 </button>
                 {referenceSceneData.isImageMissing && (
                    <div className="mt-2 text-center max-w-xs">
                        <p className="text-xs text-yellow-400">
                            Aviso: A imagem da cena de referência ({referenceSceneData.identifier}) precisa ser gerada primeiro.
                        </p>
                    </div>
                )}
            </div>
        );
    };

    const isBusy = scene.isLoading || scene.isAnalyzingText;

    return (
        <>
            <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col md:flex-row transition-all duration-300 hover:shadow-cyan-500/10 hover:ring-1 hover:ring-slate-700">
                <div className="md:w-1/2 lg:w-1/3 relative flex-shrink-0">
                    {renderImageContainer()}
                </div>
                <div className="p-6 md:w-1/2 lg:w-2/3 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-xl text-cyan-400">{scene.original_location}</h3>
                        <span className="text-xs font-mono bg-slate-700 text-slate-300 px-2 py-1 rounded-md flex-shrink-0">
                            {`C:${scene.scene_id} / S:${scene.sub_id} / O:${scene.order}`}
                        </span>
                    </div>
                    <p 
                    className="text-slate-300 text-sm" 
                    dangerouslySetInnerHTML={{ __html: scene.tagged_description.replace(/\[(.*?)\]/g, '<strong class="text-teal-300 font-medium">[$1]</strong>') }}
                    />
                    
                    {characterTags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 items-center">
                            <span className="text-xs font-semibold text-slate-400">Personagens:</span>
                            {characterTags.map((tag: string) => (
                                <span key={tag} className="bg-teal-900/50 text-teal-300 text-xs font-medium px-2 py-1 rounded-full">
                                    {tag.slice(1, -1)}
                                </span>
                            ))}
                        </div>
                    )}
                    
                    <div className="mt-3">
                         <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-white transition-colors">
                                <input
                                type="checkbox"
                                checked={!!scene.isContinuation}
                                onChange={(e) => onContinuationChange(scene.id, e.target.checked)}
                                disabled={sceneIndex === 0 || isBusy}
                                className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-cyan-500 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                Continuação da cena anterior
                            </label>
                            <span className="text-xs text-slate-500" title="No seu arquivo CSV, use a tag [ref:NUMERO_DA_ORDEM] ou [ref:previous] na coluna 'context' para definir isso automaticamente.">
                                (Dica CSV: use [ref:Ordem])
                            </span>
                        </div>
                        {sceneIndex === 0 && <p className="text-xs text-slate-500 ml-6">A primeira cena não pode ser uma continuação.</p>}
                        {scene.isContinuation && (
                            <div className="ml-6 mt-2" title="Especifique o número de 'Ordem' da cena a ser usada como referência visual. Se deixado em branco, a cena imediatamente anterior será usada.">
                                <div className="flex items-center gap-2">
                                    <label htmlFor={`ref-${scene.id}`} className="text-xs font-semibold text-slate-400 flex-shrink-0">'Ordem' de Referência:</label>
                                    <input
                                        type="number"
                                        id={`ref-${scene.id}`}
                                        value={scene.continuationReferenceId ?? ''}
                                        onChange={(e) => onContinuationReferenceChange(scene.id, e.target.value)}
                                        placeholder="Padrão: anterior"
                                        disabled={isBusy}
                                        min="1"
                                        className={`w-24 bg-slate-900/70 border rounded-md px-2 py-1 text-sm text-slate-300 focus:ring-1 focus:border-cyan-500 ${!referenceSceneData.isValid ? 'border-red-500/70 ring-1 ring-red-500/50' : 'border-slate-700 focus:ring-cyan-500'}`}
                                    />
                                </div>
                                {!referenceSceneData.isValid && (
                                    <p className="text-xs text-red-400 mt-1">'Ordem' da cena não encontrada no roteiro.</p>
                                )}
                                {referenceSceneData.isImageMissing && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xs text-yellow-400">
                                            Aviso: A imagem da cena de referência ({referenceSceneData.identifier}) precisa ser gerada primeiro.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex-grow flex flex-col gap-4">
                        <div>
                            <label htmlFor={`style-${scene.id}`} className="text-xs font-semibold text-slate-400 mb-1 block">Estilo da Cena</label>
                            <div className="flex items-center gap-2">
                                <select
                                    id={`style-${scene.id}`}
                                    value={scene.style}
                                    onChange={(e) => onStyleChange(scene.id, e.target.value)}
                                    className="text-slate-300 text-sm bg-slate-900/70 border border-slate-700 rounded-md p-2 w-full focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 flex-grow"
                                    disabled={isBusy || scene.isUpdatingPrompt}
                                >
                                    <option value="">Sem estilo</option>
                                    {availableStyles.sort().map((style) => (
                                        <option key={style} value={style}>
                                            {style}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => onUpdatePrompt(scene.id)}
                                    disabled={isBusy || scene.isUpdatingPrompt}
                                    className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-wait transition-colors"
                                    title="Atualizar o prompt da IA com base no estilo selecionado"
                                >
                                    {scene.isUpdatingPrompt ? (
                                        <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <ReloadIcon width={14} height={14} />
                                    )}
                                    <span>{scene.isUpdatingPrompt ? '' : 'Atualizar'}</span>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor={`prompt-${scene.id}`} className="text-xs font-semibold text-slate-400 mb-1">Prompt de Imagem da IA</label>
                            <textarea
                                id={`prompt-${scene.id}`}
                                value={scene.image_prompt}
                                onChange={(e) => onPromptChange(scene.id, e.target.value)}
                                className="text-slate-300 text-sm bg-slate-900/70 border border-slate-700 rounded-md p-2 w-full flex-grow focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                                rows={4}
                                disabled={isBusy || scene.isUpdatingPrompt}
                            />
                        </div>
                    </div>
                    
                    {!scene.isLoading && scene.imageUrl && (
                        <button
                            onClick={() => onVisualize(scene.id)}
                            disabled={isBusy || scene.isUpdatingPrompt || !referenceSceneData.isValid || referenceSceneData.isImageMissing}
                            className="mt-4 w-full md:w-auto self-start flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                        <SparklesIcon width={16} height={16} />
                            Gerar Novamente
                        </button>
                    )}
                </div>
            </div>

            {scene.imageUrl && (
                <ImageEditModal
                    isOpen={isEditModalOpen}
                    imageUrl={scene.imageUrl}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setEditState({ isLoading: false, error: null });
                    }}
                    onConfirm={handleConfirmEdit}
                    isEditing={editState.isLoading}
                    error={editState.error}
                />
            )}
        </>
    );
};

export default React.memo(SceneCard);