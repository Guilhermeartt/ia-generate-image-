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

const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b);
};

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  scenes,
  onImageUpdate,
  onGenerateImage,
  onDescriptionChange,
  onPromptChange,
  editImageService,
  onPreview,
  onRevertImage,
  onIsolateImage,
  onAnalyzeText,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editState, setEditState] = useState<{ isLoading: boolean; error: string | null }>({ isLoading: false, error: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scenesWithCharacter = scenes.filter(scene =>
    scene.tagged_description.includes(`[${character.name}]`)
  );

  const handleConfirmEdit = async (prompt: string) => {
    if (!character.imageUrl) return;

    setEditState({ isLoading: true, error: null });
    try {
        const { base64Data, mimeType } = await editImageService(character.imageUrl, prompt);
        onImageUpdate(character.name, `data:${mimeType};base64,${base64Data}`, mimeType);
        setIsEditModalOpen(false);
        setEditState({ isLoading: false, error: null });
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Falha ao editar a imagem.";
        setEditState({ isLoading: false, error: errorMessage });
    }
  };


  const handleDownload = () => {
    if (!character.imageUrl) return;
    const link = document.createElement('a');
    link.href = character.imageUrl;
    const extension = character.imageMimeType?.split('/')[1] || 'png';
    link.download = `${character.name.replace(/\s+/g, '_')}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).');
        return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result;
        if (typeof result === 'string') {
            onImageUpdate(character.name, result, file.type);
        }
    };
    reader.readAsDataURL(file);
  };
  
  const renderImageContainer = () => {
    const isBusy = character.isLoading || character.isIsolating || character.isAnalyzingText;
    
    let busyMessage = '';
    if (character.isLoading) busyMessage = 'Gerando novo retrato...';
    else if (character.isIsolating) busyMessage = 'Isolando personagem...';
    else if (character.isAnalyzingText) busyMessage = 'Analisando texto...';

    if (character.imageUrl) {
      return (
        <div className="w-full h-full group relative">
          <button onClick={() => onPreview(character.imageUrl!)} className="w-full h-full block cursor-pointer">
            <img src={character.imageUrl} alt={`Retrato de ${character.name}`} className="w-full h-full object-cover aspect-[16/9] transition-transform duration-300 group-hover:scale-105" />
          </button>
          {isBusy && <ImageLoader message={busyMessage} />}
          {character.imageWidth && character.imageHeight && (
            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <span>{character.imageWidth}x{character.imageHeight}</span>
                <span className="ml-2 text-slate-400">
                    {(character.imageWidth / gcd(character.imageWidth, character.imageHeight))}:
                    {(character.imageHeight / gcd(character.imageWidth, character.imageHeight))}
                </span>
            </div>
          )}
          <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                onClick={() => onAnalyzeText(character)}
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

          <div className="absolute bottom-2 right-2 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
             <button
                onClick={() => onIsolateImage(character.name)}
                disabled={isBusy}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600/80 rounded-md hover:bg-indigo-700 backdrop-blur-sm disabled:bg-slate-600/80 transition-colors"
                title="Isolar personagem do fundo"
              >
                <IsolateIcon width={14} height={14} />
                Isolar
              </button>
              <button
                onClick={() => onGenerateImage(character.name)}
                disabled={isBusy}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600/80 rounded-md hover:bg-cyan-700 backdrop-blur-sm disabled:bg-slate-600/80 transition-colors"
                title="Gerar uma nova imagem"
              >
                <SparklesIcon width={14} height={14} />
                Gerar Novamente
              </button>
          </div>
          
          {character.previousImageUrl && (
            <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 p-1 rounded-lg backdrop-blur-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <img src={character.previousImageUrl} alt="Versão anterior" className="w-10 h-10 object-cover rounded" />
              <button
                  onClick={() => onRevertImage(character.name)}
                  className="p-1.5 bg-slate-700/50 rounded-full hover:bg-yellow-600 transition-colors"
                  aria-label="Reverter para esta versão"
              >
                <RevertIcon width={16} height={16} />
              </button>
            </div>
          )}
        </div>
      );
    }

    if (character.isLoading) {
      return (
        <div className="w-full h-full bg-slate-700/50 p-4 aspect-[16/9] flex items-center justify-center">
          <div className="w-full h-full border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-sm text-slate-300">Gerando retrato...</p>
          </div>
        </div>
      );
    }

    if (character.error) {
      return (
        <div className="w-full h-full bg-red-900/30 flex flex-col items-center justify-center text-center p-4 aspect-[16/9]">
          <p className="text-red-400 font-semibold">Erro</p>
          <p className="text-xs text-red-300 mt-1 max-w-xs">{character.error}</p>
          <button
              onClick={() => onGenerateImage(character.name)}
              className="mt-3 px-3 py-1 text-xs font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    
    return (
      <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center text-center p-4 aspect-[16/9] relative">
         <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
        />
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => onGenerateImage(character.name)}
            className="flex items-center justify-center gap-2 w-32 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-lg shadow-md hover:bg-cyan-700 transition-all transform hover:scale-105"
          >
            <SparklesIcon width={16} height={16} />
            Gerar
          </button>
          <span className="text-slate-400 text-sm">ou</span>
          <button
            onClick={handleUploadClick}
            className="flex items-center justify-center gap-2 w-32 px-4 py-2 text-sm font-semibold text-white bg-slate-600 rounded-lg shadow-md hover:bg-slate-500 transition-all transform hover:scale-105"
          >
            <UploadIcon width={16} height={16} />
            Enviar
          </button>
        </div>
      </div>
    );
  };


  return (
    <>
        <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col transition-all duration-300 hover:shadow-cyan-500/10 hover:ring-1 hover:ring-slate-700">
        <div className="relative">
            {renderImageContainer()}
        </div>
        <div className="p-4 flex flex-col flex-grow">
            <h3 className="font-bold text-lg text-cyan-400">{character.name}</h3>
            
            <div className="mt-2 flex-grow space-y-3">
            <div>
                <label className="text-xs font-semibold text-slate-400">Características Físicas</label>
                <textarea
                value={character.physical_characteristics}
                onChange={(e) => onDescriptionChange(character.name, e.target.value)}
                className="text-slate-300 text-sm bg-slate-900/70 border border-slate-700 rounded-md p-2 w-full focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                rows={3}
                disabled={character.isLoading || character.isIsolating || character.isAnalyzingText}
                />
            </div>
            <div>
                <label className="text-xs font-semibold text-slate-400">Prompt da Imagem</label>
                <textarea
                value={character.image_prompt}
                onChange={(e) => onPromptChange(character.name, e.target.value)}
                className="text-slate-300 text-sm bg-slate-900/70 border border-slate-700 rounded-md p-2 w-full focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                rows={4}
                disabled={character.isLoading || character.isIsolating || character.isAnalyzingText}
                />
            </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-700">
            <h4 className="text-xs font-semibold text-slate-400 mb-2">Aparece nas cenas:</h4>
            {scenesWithCharacter.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                    {scenesWithCharacter.map(s => (
                        <span key={s.id} className="bg-slate-700 text-slate-300 text-xs font-mono px-1.5 py-0.5 rounded">
                            {s.scene_id}-{s.sub_id}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-slate-500">Não encontrado em nenhuma cena.</p>
            )}
            </div>
        </div>
        </div>

        {character.imageUrl && (
            <ImageEditModal
                isOpen={isEditModalOpen}
                imageUrl={character.imageUrl}
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

export default React.memo(CharacterCard);