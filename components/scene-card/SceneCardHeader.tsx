import React from 'react';
import type { Scene } from '../../types';

interface SceneCardHeaderProps {
  scene: Scene;
}

const SceneCardHeader: React.FC<SceneCardHeaderProps> = ({ scene }) => {
  const busyKind =
    scene.error ? 'error'
    : scene.isAnalyzingText ? 'violet'
    : scene.isLoading || scene.isUpdatingPrompt || scene.isSplitting || scene.isRefining ? 'busy'
    : null;
  const badgeClass = `sc-id-badge${busyKind === 'busy' ? ' is-busy' : ''}${busyKind === 'violet' ? ' is-busy-violet' : ''}${busyKind === 'error' ? ' is-error' : ''}`;

  return (
    <div className="sc-header">
      <p className="sc-header-title" title={scene.original_location}>
        {scene.original_location}
      </p>
      <span className={badgeClass} aria-label={`Cena ${scene.scene_id}, subcena ${scene.sub_id}, ordem ${scene.order}${busyKind ? ', processando' : ''}`}>
        {busyKind && <span className="sc-id-badge-dot" aria-hidden="true" />}
        C:{scene.scene_id} · S:{scene.sub_id} · O:{scene.order}
      </span>
    </div>
  );
};

export default React.memo(SceneCardHeader);
