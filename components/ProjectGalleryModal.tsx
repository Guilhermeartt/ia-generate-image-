import React, { useState } from 'react';
import type { Character, Scene } from '../types';
import { XIcon, SparklesIcon, RevertIcon } from './icons';

export interface ProjectImageItem {
  id: string;
  label: string;
  sublabel: string;
  imageUrl: string;
  mimeType: string;
  hasPrevious: boolean;
  previousImageUrl?: string;
  previousMimeType?: string;
  itemType: 'character' | 'scene';
  itemKey: string | number; // character name or scene id
}

interface ProjectGalleryModalProps {
  isOpen: boolean;
  characters: Character[];
  scenes: Scene[];
  onClose: () => void;
  onApplyEdit: (
    item: ProjectImageItem,
    sourceUrl: string,
    sourceMimeType: string,
    prompt: string
  ) => Promise<void>;
  isEditing: boolean;
}

const buildImageList = (characters: Character[], scenes: Scene[]): ProjectImageItem[] => {
  const items: ProjectImageItem[] = [];

  characters.forEach(c => {
    if (c.imageUrl && c.imageMimeType) {
      items.push({
        id: `char-${c.name}`,
        label: c.name,
        sublabel: 'Personagem',
        imageUrl: c.imageUrl,
        mimeType: c.imageMimeType,
        hasPrevious: !!(c.previousImageUrl && c.previousImageMimeType),
        previousImageUrl: c.previousImageUrl,
        previousMimeType: c.previousImageMimeType,
        itemType: 'character',
        itemKey: c.name,
      });
    }
  });

  scenes.forEach(s => {
    if (s.imageUrl && s.imageMimeType) {
      items.push({
        id: `scene-${s.id}`,
        label: `Cena ${s.scene_id}-${s.sub_id}`,
        sublabel: s.original_location,
        imageUrl: s.imageUrl,
        mimeType: s.imageMimeType,
        hasPrevious: !!(s.previousImageUrl && s.previousImageMimeType),
        previousImageUrl: s.previousImageUrl,
        previousMimeType: s.previousImageMimeType,
        itemType: 'scene',
        itemKey: s.id,
      });
    }
  });

  return items;
};

const ProjectGalleryModal: React.FC<ProjectGalleryModalProps> = ({
  isOpen,
  characters,
  scenes,
  onClose,
  onApplyEdit,
  isEditing,
}) => {
  const [selectedItem, setSelectedItem] = useState<ProjectImageItem | null>(null);
  const [showingPrevious, setShowingPrevious] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [filter, setFilter] = useState<'all' | 'characters' | 'scenes'>('all');
  const [editError, setEditError] = useState<string | null>(null);

  if (!isOpen) return null;

  const allItems = buildImageList(characters, scenes);
  const filtered = allItems.filter(item => {
    if (filter === 'characters') return item.itemType === 'character';
    if (filter === 'scenes') return item.itemType === 'scene';
    return true;
  });

  const activeUrl = showingPrevious && selectedItem?.previousImageUrl
    ? selectedItem.previousImageUrl
    : selectedItem?.imageUrl;
  const activeMimeType = showingPrevious && selectedItem?.previousMimeType
    ? selectedItem.previousMimeType
    : selectedItem?.mimeType;

  const handleSelect = (item: ProjectImageItem) => {
    setSelectedItem(item);
    setShowingPrevious(false);
    setPrompt('');
    setEditError(null);
  };

  const handleApply = async () => {
    if (!selectedItem || !activeUrl || !activeMimeType || !prompt.trim()) return;
    setEditError(null);
    try {
      await onApplyEdit(selectedItem, activeUrl, activeMimeType, prompt);
      setPrompt('');
    } catch (e: any) {
      setEditError(e.message || 'Erro ao aplicar edição.');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-6xl max-h-[95vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Galeria do Projeto</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione qualquer imagem do projeto para editar
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isEditing}
            className="p-1.5 text-slate-400 rounded-full hover:bg-slate-700 hover:text-white transition-colors"
          >
            <XIcon />
          </button>
        </header>

        {/* Body */}
        <div className="flex flex-col lg:flex-row flex-grow overflow-hidden min-h-0">

          {/* Left — gallery grid */}
          <div className="lg:w-3/5 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-700 overflow-hidden">
            {/* Filter tabs */}
            <div className="flex gap-1 px-4 pt-3 pb-2 flex-shrink-0">
              {(['all', 'characters', 'scenes'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    filter === f
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {f === 'all' ? `Todas (${allItems.length})` : f === 'characters' ? `Personagens (${allItems.filter(i => i.itemType === 'character').length})` : `Cenas (${allItems.filter(i => i.itemType === 'scene').length})`}
                </button>
              ))}
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
              <div className="flex-grow flex items-center justify-center text-slate-500 text-sm p-8">
                Nenhuma imagem gerada nesta categoria.
              </div>
            ) : (
              <div className="flex-grow overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
                {filtered.map(item => {
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`group relative rounded-lg overflow-hidden border-2 transition-all text-left ${
                        isSelected
                          ? 'border-cyan-400 ring-2 ring-cyan-400/30'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.label}
                        className="w-full aspect-video object-cover"
                      />
                      {/* Label */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                        <p className="text-white text-xs font-semibold truncate">{item.label}</p>
                        <p className="text-slate-300 text-xs truncate">{item.sublabel}</p>
                      </div>
                      {/* Type badge */}
                      <div className="absolute top-1.5 left-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          item.itemType === 'character' ? 'bg-indigo-600/80 text-white' : 'bg-teal-600/80 text-white'
                        }`}>
                          {item.itemType === 'character' ? 'Personagem' : 'Cena'}
                        </span>
                      </div>
                      {/* Previous badge */}
                      {item.hasPrevious && (
                        <div className="absolute top-1.5 right-1.5">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-600/80 text-white font-medium">
                            +anterior
                          </span>
                        </div>
                      )}
                      {/* Selected overlay */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-cyan-400/10 pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right — edit panel */}
          <div className="lg:w-2/5 flex flex-col p-5 gap-4 overflow-y-auto">
            {!selectedItem ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center gap-3 text-slate-500">
                <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Selecione uma imagem na galeria para editar</p>
              </div>
            ) : (
              <>
                {/* Selected image preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Imagem selecionada
                    </p>
                    {selectedItem.hasPrevious && (
                      <button
                        onClick={() => setShowingPrevious(v => !v)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          showingPrevious
                            ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                            : 'border-slate-600 text-slate-400 hover:border-yellow-500 hover:text-yellow-400'
                        }`}
                      >
                        <RevertIcon width={12} height={12} />
                        {showingPrevious ? 'Versão anterior' : 'Ver anterior'}
                      </button>
                    )}
                  </div>

                  <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                    <img
                      src={activeUrl}
                      alt="Selecionada"
                      className="w-full max-h-48 object-contain"
                    />
                    {showingPrevious && (
                      <div className="absolute top-2 left-2 bg-yellow-600/90 text-white text-xs px-2 py-0.5 rounded font-medium">
                        Versão anterior
                      </div>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      selectedItem.itemType === 'character' ? 'bg-indigo-600/20 text-indigo-400' : 'bg-teal-600/20 text-teal-400'
                    }`}>
                      {selectedItem.itemType === 'character' ? 'Personagem' : 'Cena'}
                    </span>
                    <p className="text-sm font-semibold text-white">{selectedItem.label}</p>
                    <p className="text-xs text-slate-400 truncate">{selectedItem.sublabel}</p>
                  </div>
                </div>

                {/* Prompt */}
                <div className="flex flex-col flex-grow min-h-[120px]">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    O que deseja alterar?
                  </label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    disabled={isEditing}
                    rows={5}
                    placeholder="Ex: mude o fundo para um ambiente noturno, adicione chuva, troque a roupa do personagem para uma camisa vermelha..."
                    className="flex-grow w-full bg-slate-900/70 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none disabled:opacity-50"
                  />
                </div>

                {showingPrevious && (
                  <p className="text-xs text-yellow-400 flex items-center gap-1.5 -mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                    A edição será aplicada na versão anterior selecionada
                  </p>
                )}

                {editError && (
                  <div className="p-3 bg-red-900/40 border border-red-700/50 rounded-lg">
                    <p className="text-xs text-red-300">{editError}</p>
                  </div>
                )}

                {/* Apply button */}
                <button
                  onClick={handleApply}
                  disabled={isEditing || !prompt.trim()}
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-2.5 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  {isEditing ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <SparklesIcon width={16} height={16} />
                  )}
                  {isEditing ? 'Aplicando edição...' : 'Aplicar Edição'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectGalleryModal;
