import React from 'react';
import type { Scene } from '../../types';
import { modelLabelShort } from '../../utils/imageHelpers';

interface SceneCardCostStripProps {
  scene: Scene;
}

const formatCost = (value: number | undefined) =>
  value === undefined ? '—' : `R$ ${value.toFixed(3).replace('.', ',')}`;

const SceneCardCostStrip: React.FC<SceneCardCostStripProps> = ({ scene }) => {
  // Mostrar mesmo sem imageUrl, desde que haja custo conhecido (versões anteriores
  // que falharam ou registros do servidor).
  const hasCostInfo =
    scene.costBRL !== undefined
    || scene.accumulatedCostBRL !== undefined
    || scene.tokens !== undefined
    || scene.modelUsed !== undefined;
  if (!hasCostInfo) return null;

  return (
    <div className="sc-cost-strip" role="group" aria-label="Custos da cena">
      <div className="sc-cost-cell">
        <p className="sc-cost-label">Atual</p>
        <p className="sc-cost-value is-current">{formatCost(scene.costBRL)}</p>
        <p className="sc-cost-sub is-model">
          {scene.modelUsed ? modelLabelShort(scene.modelUsed) : 'Modelo não registrado'}
        </p>
      </div>
      <div className="sc-cost-cell" title="Custo acumulado desta cena">
        <p className="sc-cost-label">Acumulado</p>
        <p className="sc-cost-value is-accumulated">
          {formatCost(scene.accumulatedCostBRL ?? scene.costBRL ?? 0)}
        </p>
        <p className="sc-cost-sub is-muted">
          {scene.versionCount ?? 1} {(scene.versionCount ?? 1) === 1 ? 'versão' : 'versões'}
        </p>
      </div>
      <div className="sc-cost-cell">
        <p className="sc-cost-label">Tokens</p>
        <p className="sc-cost-value is-tokens">
          {scene.tokens ? scene.tokens.toLocaleString('pt-BR') : '—'}
        </p>
        <p className="sc-cost-sub is-muted">geração atual</p>
      </div>
    </div>
  );
};

export default React.memo(SceneCardCostStrip);
