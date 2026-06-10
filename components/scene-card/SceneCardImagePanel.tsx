import React from 'react';
import type { Scene } from '../../types';
import { aspectRatioLabel, modelLabelShort } from '../../utils/imageHelpers';
import ImageLoader from '../ImageLoader';
import Spinner from '../ui/Spinner';
import ImgBtn from '../ui/ImgBtn';
import {
  DownloadIcon,
  EditIcon,
  RevertIcon,
  SparklesIcon,
  TextAnalysisIcon,
} from '../icons';
import { classifyError } from './classifyError';

interface ReferenceData {
  isValid: boolean;
  isImageMissing: boolean;
  identifier: string | number;
  referenceScene?: Scene;
}

interface SceneCardImagePanelProps {
  scene: Scene;
  referenceData: ReferenceData;
  isBusy: boolean;
  busyMessage: string;
  isRefTooltipOpen: boolean;
  onPreview: (url: string) => void;
  onAnalyzeText: () => void;
  onDownload: () => void;
  onEditImage: () => void;
  onCompareVersions: () => void;
  onRevertImage: () => void;
  onVisualize: () => void;
  onToggleRefTooltip: () => void;
  onCloseRefTooltip: () => void;
}

const SceneCardImagePanel: React.FC<SceneCardImagePanelProps> = ({
  scene,
  referenceData,
  isBusy,
  busyMessage,
  isRefTooltipOpen,
  onPreview,
  onAnalyzeText,
  onDownload,
  onEditImage,
  onCompareVersions,
  onRevertImage,
  onVisualize,
  onToggleRefTooltip,
  onCloseRefTooltip,
}) => {
  if (scene.imageUrl) {
    return (
      <div className="sc-img-frame">
        <button
          type="button"
          onClick={() => onPreview(scene.imageUrl!)}
          className="sc-img-button"
          aria-label={`Ampliar imagem da cena ${scene.original_location}`}
        >
          <img src={scene.imageUrl} alt={`Visualização de ${scene.original_location}`} />
        </button>

        {isBusy && <ImageLoader message={busyMessage} />}

        <div className="img-overlay" />

        <div className="sc-img-status">
          <span className="sc-img-status-dot" aria-hidden="true" />
          {(scene.costBRL !== undefined || scene.modelUsed) && (
            <span className="sc-img-cost-pill">
              {scene.modelUsed && (
                <span className="sc-img-cost-pill-model">{modelLabelShort(scene.modelUsed)}</span>
              )}
              {scene.costBRL !== undefined && (
                <>
                  {scene.modelUsed && <span className="sc-img-cost-pill-sep">·</span>}
                  <span className="sc-img-cost-pill-cost">
                    R${scene.costBRL.toFixed(3).replace('.', ',')}
                  </span>
                </>
              )}
            </span>
          )}
        </div>

        <div className="sc-img-actions" role="toolbar" aria-label="Ações da imagem">
          <ImgBtn onClick={onAnalyzeText} disabled={isBusy} title="Analisar texto" aria-label="Analisar texto da cena" color="rgba(139,92,246,0.8)">
            <TextAnalysisIcon width={13} height={13} />
          </ImgBtn>
          <ImgBtn onClick={onDownload} disabled={isBusy} title="Baixar imagem" aria-label="Baixar imagem" color="rgba(16,185,129,0.8)">
            <DownloadIcon width={13} height={13} />
          </ImgBtn>
          <ImgBtn onClick={onEditImage} disabled={isBusy} title="Editar imagem" aria-label="Editar imagem" color="rgba(99,102,241,0.8)">
            <EditIcon width={13} height={13} />
          </ImgBtn>
          {scene.previousImageUrl && (
            <ImgBtn onClick={onCompareVersions} disabled={isBusy} title="Comparar versões" aria-label="Comparar com versão anterior" color="rgba(245,158,11,0.8)">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="8" height="14" rx="1" />
                <rect x="13" y="5" width="8" height="14" rx="1" />
              </svg>
            </ImgBtn>
          )}
        </div>

        {scene.previousImageUrl && (
          <div className="sc-img-revert">
            <img
              src={scene.previousImageUrl}
              alt="Versão anterior em miniatura"
              style={{ width: 32, height: 24, objectFit: 'cover', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              type="button"
              onClick={onRevertImage}
              aria-label="Reverter para versão anterior"
              title="Reverter"
              style={{
                padding: 5, borderRadius: 5,
                background: 'rgba(255,255,255,0.08)',
                border: 'none', cursor: 'pointer', color: '#fff',
                display: 'flex',
              }}
            >
              <RevertIcon width={12} height={12} />
            </button>
          </div>
        )}

        {scene.imageWidth && scene.imageHeight && (
          <div className="sc-img-dim-badge" aria-hidden="true">
            {scene.imageWidth}×{scene.imageHeight}
            <span style={{ marginLeft: 5, color: 'rgba(255,255,255,0.25)' }}>
              {aspectRatioLabel(scene.imageWidth, scene.imageHeight)}
            </span>
          </div>
        )}

        {scene.isContinuation && referenceData.referenceScene?.imageUrl && (
          <div
            className={`sc-img-ref-badge${isRefTooltipOpen ? ' is-open' : ''}`}
            onMouseLeave={onCloseRefTooltip}
          >
            <div className="sc-ref-tooltip" role="tooltip">
              <p className="sc-ref-tooltip-label">Referência usada</p>
              <img
                src={referenceData.referenceScene.imageUrl}
                alt={`Referência: cena ${referenceData.identifier}`}
              />
              <p className="sc-ref-tooltip-meta">Cena {referenceData.identifier}</p>
            </div>
            <button
              type="button"
              className="sc-img-ref-pill"
              onClick={onToggleRefTooltip}
              aria-expanded={isRefTooltipOpen}
              aria-label={`Referência: cena ${referenceData.identifier}`}
            >
              ref
            </button>
          </div>
        )}
      </div>
    );
  }

  if (scene.isLoading) {
    return (
      <div className="sc-img-loading-state">
        <div className="sc-shimmer" aria-hidden="true" />
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.05 }} preserveAspectRatio="none" aria-hidden="true">
          <line x1="33%" y1="0" x2="33%" y2="100%" stroke="white" strokeWidth="1" />
          <line x1="66%" y1="0" x2="66%" y2="100%" stroke="white" strokeWidth="1" />
          <line x1="0" y1="33%" x2="100%" y2="33%" stroke="white" strokeWidth="1" />
          <line x1="0" y1="66%" x2="100%" y2="66%" stroke="white" strokeWidth="1" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--indigo-s)', border: '1px solid var(--indigo-b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    const err = classifyError(scene.error);
    return (
      <div className="sc-img-error-state" role="alert">
        <p className="sc-img-error-title">{err.kind === 'no-credits' ? 'Sem créditos' : err.kind === 'rate-limit' ? 'Limite atingido' : err.kind === 'prompt-rejected' ? 'Prompt rejeitado' : err.kind === 'auth' ? 'Erro de autenticação' : err.kind === 'network' ? 'Erro de conexão' : 'Erro ao gerar'}</p>
        <p className="sc-img-error-body">{err.message}</p>
        {err.hint && <p className="sc-img-error-body" style={{ fontSize: 10, opacity: 0.7 }}>{err.hint}</p>}
        <button
          type="button"
          onClick={onVisualize}
          className="btn btn-primary sc-err-cta"
          disabled={!err.retryable}
        >
          {err.ctaLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="sc-img-empty">
      <div className="sc-empty-icon" aria-hidden="true">
        <SparklesIcon width={22} height={22} style={{ color: 'var(--indigo-text)' }} />
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Visualizar cena</p>
        <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5 }}>
          {!scene.image_prompt.trim()
            ? 'Preencha o prompt abaixo antes de gerar a imagem.'
            : 'Gere uma imagem de IA para esta cena do roteiro'}
        </p>
      </div>
      <button
        type="button"
        onClick={onVisualize}
        disabled={!scene.image_prompt.trim() || !referenceData.isValid || referenceData.isImageMissing}
        className="btn btn-primary"
        style={{ fontSize: 12 }}
        title={
          !scene.image_prompt.trim()
            ? 'Preencha o prompt da imagem antes de gerar.'
            : !referenceData.isValid
              ? 'Corrija a ordem da cena de continuidade antes de gerar.'
              : referenceData.isImageMissing
                ? 'Gere primeiro a imagem da cena usada como referência.'
                : 'Gerar a visualização da cena'
        }
      >
        <SparklesIcon width={13} height={13} />
        Gerar Visualização
      </button>
      {referenceData.isImageMissing && (
        <p style={{ fontSize: 11, color: 'var(--amber)', lineHeight: 1.5 }}>
          A cena de referência ({referenceData.identifier}) precisa ser gerada primeiro.
        </p>
      )}
    </div>
  );
};

export default React.memo(SceneCardImagePanel);
