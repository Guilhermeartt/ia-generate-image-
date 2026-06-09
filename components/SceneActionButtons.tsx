import React, { useState } from 'react';
import type { Scene } from '../types';
import { CropIcon, EditIcon, ReloadIcon, SparklesIcon } from './icons';
import Spinner from './ui/Spinner';
import { REMOVE_VISUAL_OPTIONS, REMOVE_ALL_VISUAL_PROMPT } from './sceneCard.constants';

interface SceneActionButtonsProps {
  scene: Scene;
  isBusy: boolean;
  referenceSceneData: { isValid: boolean; isImageMissing: boolean };
  onOpenRefPanel: () => void;
  onEditRegion: () => void;
  onVisualize: () => void;
  onRemoveVisualElements: (instruction: string) => void;
  onOpenSplit: () => void;
  /** Quando presente E a cena tem end_frame_prompt, exibe o botão de frame final. */
  onGenerateEndFrame?: () => void;
}

/**
 * Barra de ações da cena: gerar/regerar, editar região, rápido, remover
 * elementos (menu), dividir e frame final. Os handlers que tocam estado
 * compartilhado (reference panel, edição, split modal) ficam no SceneCard e
 * são recebidos como callbacks; apenas o menu "Remover" tem estado próprio.
 */
const SceneActionButtons: React.FC<SceneActionButtonsProps> = ({
  scene,
  isBusy,
  referenceSceneData,
  onOpenRefPanel,
  onEditRegion,
  onVisualize,
  onRemoveVisualElements,
  onOpenSplit,
  onGenerateEndFrame,
}) => {
  const [isRemoveMenuOpen, setIsRemoveMenuOpen] = useState(false);
  const disabled = isBusy || scene.isUpdatingPrompt;
  const cannotGenerate = !scene.image_prompt.trim() || !referenceSceneData.isValid || referenceSceneData.isImageMissing;
  const generationBlockReason = !scene.image_prompt.trim()
    ? 'Preencha o prompt da imagem antes de gerar.'
    : !referenceSceneData.isValid
      ? 'Corrija a ordem da cena de continuidade antes de gerar.'
      : referenceSceneData.isImageMissing
        ? 'Gere primeiro a imagem da cena usada como referência.'
        : undefined;

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
      {scene.imageUrl ? (
        <>
          <button
            onClick={onOpenRefPanel}
            disabled={disabled || cannotGenerate}
            className="btn btn-primary"
            style={{ fontSize: 12 }}
            title={generationBlockReason ?? 'Regerar usando recorte, outra cena ou referências extras'}
          >
            <CropIcon width={13} height={13} />
            Gerar Novamente
          </button>
          <button
            onClick={onEditRegion}
            disabled={disabled}
            className="btn btn-ghost"
            style={{ fontSize: 12, color: '#818CF8', borderColor: 'rgba(129,140,248,0.35)' }}
            title="Selecionar uma região e editar apenas ela"
          >
            <EditIcon width={13} height={13} />
            Editar Região
          </button>
          <button
            onClick={onVisualize}
            disabled={disabled || cannotGenerate}
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            title={generationBlockReason ?? 'Regerar sem modal de referência'}
          >
            <ReloadIcon width={13} height={13} />
            Rápido
          </button>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsRemoveMenuOpen((open) => !open)}
              disabled={disabled}
              aria-expanded={isRemoveMenuOpen}
              aria-haspopup="menu"
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
              <div
                role="menu"
                aria-label="Opções para remover elementos da imagem"
                style={{
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
                }}
              >
                <div style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-1)' }}>Remover da imagem</p>
                  <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.45, marginTop: 2 }}>
                    Edita a imagem atual preservando a cena.
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsRemoveMenuOpen(false);
                    onRemoveVisualElements(REMOVE_ALL_VISUAL_PROMPT);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 10px',
                    textAlign: 'left',
                    background: 'var(--indigo-s)',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    color: '#A5B4FC',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  Remover todos os elementos proibidos
                </button>
                {REMOVE_VISUAL_OPTIONS.map((option) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={option.id}
                    onClick={() => {
                      setIsRemoveMenuOpen(false);
                      onRemoveVisualElements(option.prompt);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      color: 'var(--text-2)',
                      fontSize: 12,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        !scene.isLoading && (
          <button
            onClick={onVisualize}
            disabled={cannotGenerate}
            className="btn btn-primary"
            style={{ fontSize: 12 }}
            title={generationBlockReason ?? 'Gerar a visualização da cena'}
          >
            <SparklesIcon width={13} height={13} />
            Gerar Visualização
          </button>
        )
      )}

      {/* Dividir */}
      <button
        onClick={onOpenSplit}
        disabled={disabled || scene.isSplitting}
        className="btn btn-ghost"
        style={{ fontSize: 12, marginLeft: scene.imageUrl ? 0 : 'auto' }}
        title="Dividir em múltiplos planos"
      >
        {scene.isSplitting ? (
          <Spinner size={12} />
        ) : (
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="9" height="18" rx="1" />
            <rect x="13" y="3" width="9" height="18" rx="1" />
          </svg>
        )}
        {scene.isSplitting ? 'Dividindo…' : 'Dividir'}
      </button>

      {/* Frame final para vídeo */}
      {onGenerateEndFrame && scene.end_frame_prompt && (
        <button
          onClick={onGenerateEndFrame}
          disabled={disabled || scene.endFrameIsLoading}
          className="btn btn-ghost"
          style={{ fontSize: 12, color: '#34D399', borderColor: 'rgba(52,211,153,0.30)' }}
          title="Gerar frame final para uso em ferramentas de vídeo (Runway, Kling, Pika)"
        >
          {scene.endFrameIsLoading ? (
            <Spinner size={12} />
          ) : (
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
          {scene.endFrameIsLoading ? 'Gerando…' : scene.endFrameUrl ? 'Reger frame final' : 'Frame final'}
        </button>
      )}
    </div>
  );
};

export default SceneActionButtons;
