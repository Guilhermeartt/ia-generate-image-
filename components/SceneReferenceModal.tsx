import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ImageRegion, Scene } from '../types';
import { XIcon, SparklesIcon, CropIcon } from './icons';

interface ExtraRef {
  id: string;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
}

interface GenerateParams {
  prompt: string;
  croppedBase64: string | null;
  croppedMimeType: string | null;
  extraReferences?: { base64Data: string; mimeType: string }[];
  blendInstruction?: string;
}

interface SceneReferenceModalProps {
  isOpen: boolean;
  imageUrl: string;
  currentPrompt: string;
  currentSceneId: number;
  scenes: Scene[];
  onClose: () => void;
  onGenerate: (params: GenerateParams) => void;
  isGenerating: boolean;
  error: string | null;
}

const QUICK_PROMPTS = [
  'Close-up no rosto do personagem',
  'Destaque na mão / objeto em foco',
  'Plano aberto mostrando o ambiente',
  'Ângulo baixo (câmera no chão)',
  'Ângulo alto (visão aérea)',
  'Continuar a cena com mesmo estilo',
  'Detalhe expressão facial',
  'Plano americano (meio corpo)',
];

const BLEND_SUGGESTIONS = [
  'Coloque o objeto no cenário mantendo escala realista',
  'Use o estilo e iluminação da referência',
  'Incorpore o produto em destaque na cena',
  'Mescle o ambiente da referência com os personagens',
];

const cropImageToRegion = (
  imageUrl: string,
  region: ImageRegion,
  displayedWidth: number,
  displayedHeight: number
): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scaleX = img.naturalWidth / displayedWidth;
      const scaleY = img.naturalHeight / displayedHeight;
      const cropX = Math.round(region.x * scaleX);
      const cropY = Math.round(region.y * scaleY);
      const cropW = Math.max(1, Math.round(region.width * scaleX));
      const cropH = Math.max(1, Math.round(region.height * scaleY));
      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      const dataUrl = canvas.toDataURL('image/png');
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/png' });
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
};

const SceneReferenceModal: React.FC<SceneReferenceModalProps> = ({
  isOpen,
  imageUrl,
  currentPrompt,
  currentSceneId,
  scenes,
  onClose,
  onGenerate,
  isGenerating,
  error,
}) => {
  const [selection, setSelection] = useState<ImageRegion | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [prompt, setPrompt] = useState(currentPrompt);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [selectedRefScene, setSelectedRefScene] = useState<Scene | null>(null);

  // ── Referências de objetos externos ──
  const [extraRefs, setExtraRefs] = useState<ExtraRef[]>([]);
  const [blendInstruction, setBlendInstruction] = useState('');
  const extraRefInputRef = useRef<HTMLInputElement>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const referencableScenes = scenes.filter(
    s => s.id !== currentSceneId && s.imageUrl && s.imageMimeType
  );

  useEffect(() => {
    if (isOpen) {
      setPrompt(currentPrompt);
      setSelection(null);
      setCroppedPreview(null);
      setIsDrawing(false);
      setSelectedRefScene(null);
      setExtraRefs([]);
      setBlendInstruction('');
    }
  }, [isOpen, currentPrompt]);

  const getCoordinates = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    const imgRect = imageRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - imgRect.left, imgRect.width)),
      y: Math.max(0, Math.min(e.clientY - imgRect.top, imgRect.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedRefScene) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    setStartPoint(coords);
    setIsDrawing(true);
    setSelection({ ...coords, width: 0, height: 0 });
    setCroppedPreview(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    setSelection({
      x: Math.min(startPoint.x, coords.x),
      y: Math.min(startPoint.y, coords.y),
      width: Math.abs(coords.x - startPoint.x),
      height: Math.abs(coords.y - startPoint.y),
    });
  };

  const handleMouseUp = useCallback(async () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (selection && selection.width > 20 && selection.height > 20 && imageRef.current) {
      setIsCropping(true);
      try {
        const imgRect = imageRef.current.getBoundingClientRect();
        const { base64, mimeType } = await cropImageToRegion(
          imageUrl, selection, imgRect.width, imgRect.height
        );
        setCroppedPreview(`data:${mimeType};base64,${base64}`);
      } catch {
        setCroppedPreview(null);
      } finally {
        setIsCropping(false);
      }
    } else {
      setCroppedPreview(null);
      if (selection && selection.width <= 20) setSelection(null);
    }
  }, [isDrawing, selection, imageUrl]);

  const handleClearSelection = () => {
    setSelection(null);
    setCroppedPreview(null);
  };

  const handleSelectRefScene = (scene: Scene) => {
    setSelectedRefScene(prev => prev?.id === scene.id ? null : scene);
    setSelection(null);
    setCroppedPreview(null);
  };

  const handleClearRefScene = () => setSelectedRefScene(null);

  // ── Upload de referências de objetos ──
  const handleExtraRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []) as File[];
    files
      .filter(f => ['image/png', 'image/jpeg', 'image/webp'].includes(f.type))
      .forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          const dataUrl = ev.target?.result as string;
          const [header, base64Data] = dataUrl.split(',');
          const mimeType = header.match(/:(.*?);/)?.[1] || file.type;
          setExtraRefs(prev => [
            ...prev,
            { id: Date.now().toString() + Math.random(), previewUrl: dataUrl, base64Data, mimeType },
          ]);
        };
        reader.readAsDataURL(file);
      });
    if (e.target) e.target.value = '';
  };

  const removeExtraRef = (id: string) =>
    setExtraRefs(prev => prev.filter(r => r.id !== id));

  const handleGenerate = async () => {
    const builtExtraRefs = extraRefs.length > 0
      ? extraRefs.map(r => ({ base64Data: r.base64Data, mimeType: r.mimeType }))
      : undefined;
    const builtBlend = blendInstruction.trim() || undefined;

    if (selectedRefScene && selectedRefScene.imageUrl && selectedRefScene.imageMimeType) {
      const base64 = selectedRefScene.imageUrl.split(',')[1];
      onGenerate({ prompt, croppedBase64: base64, croppedMimeType: selectedRefScene.imageMimeType, extraReferences: builtExtraRefs, blendInstruction: builtBlend });
      return;
    }

    let croppedBase64: string | null = null;
    let croppedMimeType: string | null = null;
    if (selection && selection.width > 20 && selection.height > 20 && imageRef.current) {
      try {
        const imgRect = imageRef.current.getBoundingClientRect();
        const result = await cropImageToRegion(imageUrl, selection, imgRect.width, imgRect.height);
        croppedBase64 = result.base64;
        croppedMimeType = result.mimeType;
      } catch { /* gera sem região */ }
    }
    onGenerate({ prompt, croppedBase64, croppedMimeType, extraReferences: builtExtraRefs, blendInstruction: builtBlend });
  };

  if (!isOpen) return null;

  const hasValidSelection = !!(selection && selection.width > 20 && selection.height > 20);

  return (
    <div
      className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-5xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Gerar com Referência Visual</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione outra cena, arraste uma região, ou adicione imagens de objetos para mesclar
            </p>
          </div>
          <button onClick={onClose} disabled={isGenerating} className="p-1.5 text-slate-400 rounded-full hover:bg-slate-700 hover:text-white transition-colors">
            <XIcon />
          </button>
        </header>

        {/* Body */}
        <div className="flex flex-col lg:flex-row flex-grow overflow-hidden min-h-0">

          {/* Left – imagem atual com drag-to-select */}
          <div className="lg:w-3/5 flex flex-col bg-slate-900/50">
            <div className="flex-shrink-0 px-4 pt-3 pb-1.5 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <CropIcon width={12} height={12} />
                {selectedRefScene
                  ? 'Seleção por região desativada — usando outra cena'
                  : hasValidSelection
                  ? 'Região selecionada — arraste novamente para refazer'
                  : 'Clique e arraste para selecionar uma região da imagem atual'}
              </span>
              {hasValidSelection && !selectedRefScene && (
                <button onClick={handleClearSelection} className="text-xs text-slate-400 hover:text-red-400 transition-colors">
                  ✕ Limpar
                </button>
              )}
            </div>

            <div
              ref={containerRef}
              className={`flex-grow flex items-center justify-center p-4 select-none ${selectedRefScene ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div className="relative inline-block">
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Imagem atual"
                  className={`max-w-full max-h-[55vh] object-contain block rounded-lg shadow-xl transition-opacity duration-300 ${selectedRefScene ? 'opacity-20' : 'opacity-100'}`}
                  draggable={false}
                />

                {selectedRefScene && selectedRefScene.imageUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                    <img
                      src={selectedRefScene.imageUrl}
                      alt={`Cena ${selectedRefScene.scene_id}-${selectedRefScene.sub_id}`}
                      className="max-h-52 max-w-full rounded-lg shadow-2xl border-2 border-cyan-400 object-contain"
                    />
                    <span className="bg-cyan-600/90 text-white text-xs px-3 py-1.5 rounded-full font-semibold">
                      Cena {selectedRefScene.scene_id}-{selectedRefScene.sub_id} · {selectedRefScene.original_location}
                    </span>
                  </div>
                )}

                {selection && !selectedRefScene && (
                  <div
                    className="absolute border-2 border-cyan-400 pointer-events-none"
                    style={{
                      left: selection.x, top: selection.y,
                      width: Math.max(0, selection.width), height: Math.max(0, selection.height),
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                    }}
                  >
                    {['-translate-x-1/2 -translate-y-1/2 top-0 left-0', '-translate-y-1/2 translate-x-1/2 top-0 right-0', 'translate-y-1/2 -translate-x-1/2 bottom-0 left-0', 'translate-y-1/2 translate-x-1/2 bottom-0 right-0'].map((pos, i) => (
                      <div key={i} className={`absolute w-3 h-3 bg-cyan-400 rounded-sm ${pos}`} />
                    ))}
                    {hasValidSelection && (
                      <div className="absolute -top-6 left-0 bg-cyan-600 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap">
                        {Math.round(selection.width)} × {Math.round(selection.height)} px
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right – controles */}
          <div className="lg:w-2/5 flex flex-col p-5 gap-4 border-t lg:border-t-0 lg:border-l border-slate-700 overflow-y-auto">

            {/* ── Seletor de cena de referência ── */}
            {referencableScenes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Usar outra cena</p>
                  {selectedRefScene && (
                    <button onClick={handleClearRefScene} className="text-xs text-slate-400 hover:text-red-400 transition-colors">✕ Limpar</button>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                  {referencableScenes.map(s => {
                    const isSelected = selectedRefScene?.id === s.id;
                    return (
                      <button key={s.id} onClick={() => handleSelectRefScene(s)} title={`${s.original_location} (Cena ${s.scene_id}-${s.sub_id})`}
                        className={`flex-shrink-0 snap-start w-24 rounded-lg overflow-hidden border-2 transition-all text-left ${isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/30' : 'border-slate-700 hover:border-slate-500'}`}>
                        <img src={s.imageUrl!} alt={`Cena ${s.scene_id}-${s.sub_id}`} className="w-full aspect-video object-cover" />
                        <div className={`px-1.5 py-1 ${isSelected ? 'bg-cyan-600' : 'bg-slate-700'}`}>
                          <p className="text-xs font-semibold text-white">C{s.scene_id}-{s.sub_id}</p>
                          <p className="text-xs text-slate-300 truncate leading-tight">{s.original_location}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedRefScene ? (
                  <p className="text-xs text-cyan-400 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block flex-shrink-0" />
                    Cena {selectedRefScene.scene_id}-{selectedRefScene.sub_id} selecionada como referência
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Ou arraste na imagem à esquerda para selecionar uma região</p>
                )}
                <div className="mt-3 border-t border-slate-700/60" />
              </div>
            )}

            {/* Preview da região recortada */}
            {!selectedRefScene && (croppedPreview || isCropping) && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Região selecionada</p>
                <div className="rounded-lg overflow-hidden border border-cyan-500/40 bg-slate-900 flex items-center justify-center min-h-[72px]">
                  {isCropping
                    ? <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin m-6" />
                    : <img src={croppedPreview!} alt="Região recortada" className="max-w-full max-h-44 object-contain" />
                  }
                </div>
                <p className="text-xs text-cyan-400 mt-1.5">✦ Essa região será enviada como referência visual</p>
              </div>
            )}

            {/* ── Referências de Objetos / Mesclagem ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                  Referências de objetos
                </p>
                <button
                  onClick={() => extraRefInputRef.current?.click()}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
                >
                  + Adicionar
                </button>
              </div>

              <input
                ref={extraRefInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleExtraRefUpload}
                className="hidden"
              />

              {extraRefs.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-2">
                  {extraRefs.map((ref, i) => (
                    <div key={ref.id} className="relative group/ref flex-shrink-0">
                      <img
                        src={ref.previewUrl}
                        alt={`Ref ${i + 1}`}
                        className="w-20 h-14 object-cover rounded-lg border-2 border-amber-500/50"
                      />
                      {/* Número */}
                      <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold z-10">
                        {i + 1}
                      </div>
                      {/* Remover on hover */}
                      <button
                        onClick={() => removeExtraRef(ref.id)}
                        className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center opacity-0 group-hover/ref:opacity-100 transition-opacity text-white text-sm font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {/* Botão adicionar mais */}
                  <button
                    onClick={() => extraRefInputRef.current?.click()}
                    className="w-20 h-14 rounded-lg border-2 border-dashed border-amber-500/30 flex items-center justify-center text-amber-500/60 hover:border-amber-400 hover:text-amber-400 transition-colors text-xl"
                  >
                    +
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => extraRefInputRef.current?.click()}
                  className="border-2 border-dashed border-amber-700/30 rounded-lg p-3 text-center cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors mb-2"
                >
                  <p className="text-xs text-slate-500">
                    <span className="text-amber-400/80">Adicione imagens</span> de objetos, produtos ou estilos para mesclar na cena
                  </p>
                </div>
              )}

              {/* Instrução de mesclagem — só aparece quando há refs */}
              {extraRefs.length > 0 && (
                <div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {BLEND_SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => setBlendInstruction(s)}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          blendInstruction === s
                            ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                            : 'border-slate-600 text-slate-400 hover:border-amber-500/50 hover:text-amber-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={blendInstruction}
                    onChange={e => setBlendInstruction(e.target.value)}
                    disabled={isGenerating}
                    rows={2}
                    placeholder="Como mesclar? Ex: use a cadeira da ref. 1 como elemento central, mantendo a iluminação original..."
                    className="w-full bg-slate-900/70 border border-amber-700/40 rounded-lg p-2.5 text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none disabled:opacity-50"
                  />
                </div>
              )}
              <div className="mt-3 border-t border-slate-700/60" />
            </div>

            {/* Quick prompt chips */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sugestões rápidas</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map(s => (
                  <button key={s} onClick={() => setPrompt(s)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      prompt === s ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10' : 'border-slate-600 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt textarea */}
            <div className="flex flex-col flex-grow min-h-[120px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Prompt de geração</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={isGenerating}
                rows={6}
                placeholder="Descreva o que quer gerar. Ex: close na mão de Mariana mostrando o celular..."
                className="flex-grow w-full bg-slate-900/70 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/40 border border-red-700/50 rounded-lg flex-shrink-0">
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between px-6 py-4 border-t border-slate-700 flex-shrink-0 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <button onClick={onClose} disabled={isGenerating} className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
              Cancelar
            </button>
            {extraRefs.length > 0 && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                {extraRefs.length} referência{extraRefs.length > 1 ? 's' : ''} de objeto
              </span>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="flex items-center gap-2.5 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            {isGenerating
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <SparklesIcon width={16} height={16} />
            }
            {isGenerating
              ? 'Gerando...'
              : selectedRefScene
              ? `Gerar com Cena ${selectedRefScene.scene_id}-${selectedRefScene.sub_id}`
              : extraRefs.length > 0
              ? `Gerar com ${extraRefs.length} ref. de objeto`
              : hasValidSelection
              ? 'Gerar com Região Selecionada'
              : 'Gerar'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SceneReferenceModal;
