import React from 'react';
import type { Scene } from '../types';

interface SceneContinuationProps {
  scene: Scene;
  sceneIndex: number;
  isBusy: boolean;
  /** Subconjunto de referenceSceneData usado nesta seção. */
  referenceSceneData: { isValid: boolean; isImageMissing: boolean; identifier: string };
  onContinuationChange: (id: number, isChecked: boolean) => void;
  onContinuationReferenceChange: (id: number, refId: string) => void;
}

/**
 * Controle de "Continuação da cena anterior": checkbox + campo de ordem de
 * referência, com avisos quando a cena referenciada é inválida ou sem imagem.
 * Extraído do SceneCard (apresentacional).
 */
const SceneContinuation: React.FC<SceneContinuationProps> = ({
  scene,
  sceneIndex,
  isBusy,
  referenceSceneData,
  onContinuationChange,
  onContinuationReferenceChange,
}) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--text-3)',
          cursor: sceneIndex === 0 && !scene.isContinuation ? 'not-allowed' : 'pointer',
          opacity: (sceneIndex === 0 && !scene.isContinuation) || isBusy ? 0.5 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={!!scene.isContinuation}
          onChange={(e) => onContinuationChange(scene.id, e.target.checked)}
          disabled={(sceneIndex === 0 && !scene.isContinuation) || isBusy}
          style={{ width: 13, height: 13, accentColor: 'var(--indigo)', cursor: 'pointer' }}
        />
        Continuação da cena anterior
      </label>
      <span
        style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--mono)', flexShrink: 0 }}
        title="Use [ref:Ordem] na coluna context do CSV"
      >
        [ref:Ordem]
      </span>
    </div>

    {scene.isContinuation && (
      <div style={{ marginTop: 6, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor={`scene-${scene.id}-continuation-reference`} className="label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
            Ordem de referência:
          </label>
          <input
            id={`scene-${scene.id}-continuation-reference`}
            type="number"
            value={scene.continuationReferenceId ?? ''}
            onChange={(e) => onContinuationReferenceChange(scene.id, e.target.value)}
            placeholder="Padrão: anterior"
            disabled={isBusy}
            min="1"
            aria-invalid={!referenceSceneData.isValid}
            aria-describedby={
              !referenceSceneData.isValid
                ? `scene-${scene.id}-continuation-error`
                : referenceSceneData.isImageMissing
                  ? `scene-${scene.id}-continuation-warning`
                  : undefined
            }
            className="field"
            style={{
              width: 120,
              fontSize: 12,
              borderColor: !referenceSceneData.isValid ? 'rgba(248,113,113,0.5)' : undefined,
            }}
          />
        </div>
        {!referenceSceneData.isValid && (
          <p id={`scene-${scene.id}-continuation-error`} role="alert" style={{ fontSize: 11, color: 'var(--red)' }}>
            Cena de referência inválida, não encontrada ou igual à cena atual.
          </p>
        )}
        {referenceSceneData.isImageMissing && (
          <p id={`scene-${scene.id}-continuation-warning`} style={{ fontSize: 11, color: 'var(--amber)' }}>
            A imagem da cena ({referenceSceneData.identifier}) precisa ser gerada primeiro.
          </p>
        )}
      </div>
    )}
  </div>
);

export default SceneContinuation;
