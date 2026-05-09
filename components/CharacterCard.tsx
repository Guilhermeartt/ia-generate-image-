import React, { useState, useRef } from 'react';
import type { Character, Scene } from '../types';
import { SparklesIcon, EditIcon, DownloadIcon, RevertIcon, UploadIcon, IsolateIcon, TextAnalysisIcon } from './icons';
import ImageLoader from './ImageLoader';
import ImageEditModal from './ImageEditModal';

interface CharacterCardProps {
  character: Character;
  scenes: Scene[];
  onImageUpdate: (name: string, newImageUrl: string, newMimeType: string) => void;
  onGenerateImage: (name: string) => void;
  onDescriptionChange: (name: string, newDescription: string) => void;
  onPromptChange: (name: string, newPrompt: string) => void;
  editImageService: (base64: string, prompt: string) => Promise<{ base64Data: string; mimeType: string; }>;
  onPreview: (url: string) => void;
  onRevertImage: (name: string) => void;
  onIsolateImage: (name: string) => void;
  onAnalyzeText: (character: Character) => void;
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

const CharacterCard: React.FC<CharacterCardProps> = ({
  character, scenes, onImageUpdate, onGenerateImage, onDescriptionChange,
  onPromptChange, editImageService, onPreview, onRevertImage, onIsolateImage, onAnalyzeText,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editState, setEditState] = useState<{ isLoading: boolean; error: string | null }>({ isLoading: false, error: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scenesWithCharacter = scenes.filter(s => s.tagged_description.includes(`[${character.name}]`));
  const isBusy = character.isLoading || character.isIsolating || character.isAnalyzingText;

  let busyMessage = '';
  if (character.isLoading) busyMessage = 'Gerando retrato...';
  else if (character.isIsolating) busyMessage = 'Isolando personagem...';
  else if (character.isAnalyzingText) busyMessage = 'Analisando texto...';

  const handleConfirmEdit = async (prompt: string) => {
    if (!character.imageUrl) return;
    setEditState({ isLoading: true, error: null });
    try {
      const { base64Data, mimeType } = await editImageService(character.imageUrl, prompt);
      onImageUpdate(character.name, `data:${mimeType};base64,${base64Data}`, mimeType);
      setIsEditModalOpen(false);
      setEditState({ isLoading: false, error: null });
    } catch (e) {
      setEditState({ isLoading: false, error: e instanceof Error ? e.message : 'Falha ao editar.' });
    }
  };

  const handleDownload = () => {
    if (!character.imageUrl) return;
    const link = document.createElement('a');
    link.href = character.imageUrl;
    link.download = `${character.name.replace(/\s+/g, '_')}.${character.imageMimeType?.split('/')[1] || 'png'}`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      alert('Selecione uma imagem válida (PNG, JPG, WebP).'); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') onImageUpdate(character.name, result, file.type);
    };
    reader.readAsDataURL(file);
  };

  const renderImageArea = () => {
    if (character.imageUrl) {
      return (
        <div className="w-full h-full group relative">
          <button onClick={() => onPreview(character.imageUrl!)} className="w-full h-full block">
            <img
              src={character.imageUrl}
              alt={`Retrato de ${character.name}`}
              className="w-full h-full object-cover aspect-[4/3] transition-transform duration-500 group-hover:scale-105"
            />
          </button>

          {isBusy && <ImageLoader message={busyMessage} />}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-300 pointer-events-none" />

          {/* Dimensions */}
          {character.imageWidth && character.imageHeight && (
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 font-mono">
              {character.imageWidth}×{character.imageHeight}
              <span className="ml-1.5 text-slate-400">
                {character.imageWidth / gcd(character.imageWidth, character.imageHeight)}:
                {character.imageHeight / gcd(character.imageWidth, character.imageHeight)}
              </span>
            </div>
          )}

          {/* Top-right icons */}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
            <button onClick={() => onAnalyzeText(character)} disabled={isBusy}
              className="p-2 rounded-xl bg-black/55 backdrop-blur-sm hover:bg-purple-600/80 disabled:opacity-40 transition-all"
              title="Analisar texto na imagem">
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

          {/* Bottom-right action buttons */}
          <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
            <button onClick={() => onIsolateImage(character.name)} disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600/80 hover:bg-indigo-600 backdrop-blur-sm rounded-xl disabled:opacity-40 transition-all">
              <IsolateIcon width={13} height={13} />
              Isolar
            </button>
            <button onClick={() => onGenerateImage(character.name)} disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600/80 hover:bg-violet-600 backdrop-blur-sm rounded-xl disabled:opacity-40 transition-all">
              <SparklesIcon width={13} height={13} />
              Regerar
            </button>
          </div>

          {/* Previous image revert */}
          {character.previousImageUrl && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm p-1 rounded-xl z-10 opacity-0 group-hover:opacity-100 transition-all duration-200">
              <img src={character.previousImageUrl} alt="Versão anterior"
                className="w-9 h-9 object-cover rounded-lg border border-white/10" />
              <button onClick={() => onRevertImage(character.name)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-yellow-500/70 transition-colors" title="Reverter">
                <RevertIcon width={14} height={14} />
              </button>
            </div>
          )}
        </div>
      );
    }

    if (character.isLoading) {
      return (
        <div className="w-full aspect-[4/3] flex flex-col items-center justify-center bg-violet-500/5">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-400 rounded-full" style={{animation:'spin .8s linear infinite'}} />
          <p className="mt-3 text-xs text-slate-500">Gerando retrato...</p>
        </div>
      );
    }

    if (character.error) {
      return (
        <div className="w-full aspect-[4/3] flex flex-col items-center justify-center text-center p-4 bg-red-500/5">
          <p className="text-red-400 font-semibold text-sm">Erro</p>
          <p className="text-xs text-red-400/70 mt-1 max-w-xs">{character.error}</p>
          <button onClick={() => onGenerateImage(character.name)}
            className="btn-primary mt-3 px-4 py-1.5 text-xs font-semibold text-white rounded-xl">
            Tentar Novamente
          </button>
        </div>
      );
    }

    return (
      <div className="w-full aspect-[4/3] flex flex-col items-center justify-center text-center p-5 bg-violet-500/5">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/png,image/jpeg,image/webp" />
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button onClick={() => onGenerateImage(character.name)}
            className="btn-primary flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl">
            <SparklesIcon width={15} height={15} />
            Gerar
          </button>
          <span className="text-slate-700 text-xs">ou</span>
          <button onClick={() => fileInputRef.current?.click()}
            className="btn-ghost flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl">
            <UploadIcon width={15} height={15} />
            Enviar
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="glass glass-hover rounded-2xl overflow-hidden flex flex-col transition-all duration-300 animate-fade-in-up">
        {/* Image */}
        <div className="relative overflow-hidden">
          {renderImageArea()}
        </div>

        {/* Model + cost strip */}
        {character.imageUrl && (character.costBRL !== undefined || character.modelUsed) && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 border-b border-violet-500/10 bg-black/30 text-xs"
            title={character.tokens ? `${character.tokens.toLocaleString('pt-BR')} tokens` : 'Custo estimado'}
          >
            {character.modelUsed && (
              <span className="text-violet-400 font-semibold">{modelLabelShort(character.modelUsed)}</span>
            )}
            {character.costBRL !== undefined && (
              <>
                {character.modelUsed && <span className="text-white/10">·</span>}
                <span className="text-emerald-400 font-medium">R${character.costBRL.toFixed(3).replace('.', ',')}</span>
              </>
            )}
            {character.tokens && (
              <span className="text-slate-700 ml-auto font-mono">{character.tokens.toLocaleString('pt-BR')} tk</span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-4 flex flex-col flex-grow">
          <h3 className="font-bold text-base text-violet-300 mb-3">{character.name}</h3>

          <div className="space-y-3 flex-grow">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Características Físicas</label>
              <textarea
                value={character.physical_characteristics}
                onChange={(e) => onDescriptionChange(character.name, e.target.value)}
                className="input-glass w-full rounded-xl p-2.5 text-sm mt-1.5 resize-none"
                rows={3}
                disabled={isBusy}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Prompt da Imagem</label>
              <textarea
                value={character.image_prompt}
                onChange={(e) => onPromptChange(character.name, e.target.value)}
                className="input-glass w-full rounded-xl p-2.5 text-sm mt-1.5 resize-none"
                rows={4}
                disabled={isBusy}
              />
            </div>
          </div>

          {/* Scenes */}
          <div className="mt-4 pt-3 border-t border-violet-500/10">
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Aparece nas cenas</h4>
            {scenesWithCharacter.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {scenesWithCharacter.map(s => (
                  <span key={s.id} className="bg-violet-500/10 text-violet-400 text-xs font-mono px-2 py-0.5 rounded-lg border border-violet-500/15">
                    {s.scene_id}-{s.sub_id}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-700">Não encontrado em nenhuma cena.</p>
            )}
          </div>
        </div>
      </div>

      {character.imageUrl && (
        <ImageEditModal
          isOpen={isEditModalOpen}
          imageUrl={character.imageUrl}
          onClose={() => { setIsEditModalOpen(false); setEditState({ isLoading: false, error: null }); }}
          onConfirm={handleConfirmEdit}
          isEditing={editState.isLoading}
          error={editState.error}
        />
      )}
    </>
  );
};

export default React.memo(CharacterCard);
