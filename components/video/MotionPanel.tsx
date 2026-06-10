import React from 'react';
import type {
  SceneVideoClipOverride,
  VideoClipTransition,
  VideoKenBurnsConfig,
  VideoKenBurnsDirection,
  VideoTransitionEasing,
} from '@/types';
import type { StoryboardVideoScene } from './StoryboardComposition';
import { RangeField } from './VideoStudioControls';
import { KEN_BURNS_OPTIONS, TRANSITION_EASING_OPTIONS, TRANSITION_OPTIONS } from './videoStudioConstants';

export interface MotionDefaults {
  secondsPerClip: number;
  transition: VideoClipTransition;
  transitionSeconds: number;
  transitionEasing: VideoTransitionEasing;
  kenBurns: VideoKenBurnsConfig;
}

interface MotionPanelProps {
  clip: StoryboardVideoScene;
  displayDuration: number;
  displayTransition: VideoClipTransition;
  displayTransitionSeconds: number;
  displayTransitionEasing: VideoTransitionEasing;
  displayKenBurns: VideoKenBurnsConfig;
  defaults: MotionDefaults;
  hasOverride: boolean;
  onOverridePatchPreview: (patch: Partial<SceneVideoClipOverride>) => void;
  onOverridePatchCommit: (patch: Partial<SceneVideoClipOverride>, label: string) => void;
  onDefaultsCommit: (next: Partial<MotionDefaults>, label: string) => void;
  onDefaultsPreview: (next: Partial<MotionDefaults>) => void;
  onClearOverride: () => void;
  panelId: string;
  tabId: string;
}

const MotionPanel: React.FC<MotionPanelProps> = ({
  clip,
  displayDuration,
  displayTransition,
  displayTransitionSeconds,
  displayTransitionEasing,
  displayKenBurns,
  defaults,
  hasOverride,
  onOverridePatchPreview,
  onOverridePatchCommit,
  onDefaultsCommit,
  onDefaultsPreview,
  onClearOverride,
  panelId,
  tabId,
}) => {
  const handleClearOverride = () => {
    if (typeof window === 'undefined' || window.confirm('Resetar duração, transição e Ken Burns deste plano?')) {
      onClearOverride();
    }
  };

  return (
    <div className="vs-tab-panel" role="tabpanel" id={panelId} aria-labelledby={tabId}>
      <p className="vs-section-title">Duração deste plano</p>
      <RangeField
        id="video-clip-duration"
        label="Duração"
        min={0.5}
        max={12}
        step={0.5}
        value={displayDuration}
        onChange={(value) => onOverridePatchPreview({ durationSeconds: value })}
        onCommit={(value) => onOverridePatchCommit({ durationSeconds: value }, 'Duração do plano')}
        format={(value) => `${value.toFixed(1)}s`}
      />
      <p className="vs-hint">Padrão global: {defaults.secondsPerClip.toFixed(1)}s</p>

      <p className="vs-section-title">Transição de entrada</p>
      <div className="vs-row-2">
        <div>
          <label className="panel-field-label" htmlFor="video-clip-transition">Tipo</label>
          <select
            id="video-clip-transition"
            className="field"
            value={displayTransition}
            onChange={(event) => onOverridePatchCommit(
              { transitionIn: event.target.value as VideoClipTransition },
              'Transição',
            )}
          >
            {TRANSITION_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <RangeField
            id="video-clip-transition-duration"
            label="Duração"
            min={0}
            max={2}
            step={0.05}
            value={displayTransitionSeconds}
            onChange={(value) => onOverridePatchPreview({ transitionDurationSeconds: value })}
            onCommit={(value) => onOverridePatchCommit(
              { transitionDurationSeconds: value },
              'Duração da transição',
            )}
            format={(value) => `${value.toFixed(2)}s`}
          />
        </div>
      </div>
      <label className="panel-field-label" htmlFor="video-clip-transition-easing">Easing (entrada/saída)</label>
      <select
        id="video-clip-transition-easing"
        className="field"
        value={displayTransitionEasing}
        onChange={(event) => onOverridePatchCommit(
          { transitionEasing: event.target.value as VideoTransitionEasing },
          'Easing da transição',
        )}
      >
        {TRANSITION_EASING_OPTIONS.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>

      <p className="vs-section-title">Ken Burns (pan + zoom)</p>
      <div className="vs-row-2">
        <div>
          <label className="panel-field-label" htmlFor="video-clip-kb-direction">Direção</label>
          <select
            id="video-clip-kb-direction"
            className="field"
            value={displayKenBurns.direction}
            onChange={(event) => onOverridePatchCommit(
              {
                kenBurns: {
                  direction: event.target.value as VideoKenBurnsDirection,
                  intensity: displayKenBurns.intensity,
                },
              },
              'Direção Ken Burns',
            )}
          >
            {KEN_BURNS_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
        <RangeField
          id="video-clip-kb-intensity"
          label="Intensidade"
          min={0}
          max={0.4}
          step={0.01}
          value={displayKenBurns.intensity}
          onChange={(value) => onOverridePatchPreview({
            kenBurns: { direction: displayKenBurns.direction, intensity: value },
          })}
          onCommit={(value) => onOverridePatchCommit(
            { kenBurns: { direction: displayKenBurns.direction, intensity: value } },
            'Intensidade Ken Burns',
          )}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </div>

      <p className="vs-section-title">Padrões globais</p>
      <div className="vs-row-2">
        <div>
          <label htmlFor="vs-default-clip-duration" className="panel-field-label">Padrão por clipe</label>
          <select
            id="vs-default-clip-duration"
            className="field"
            value={defaults.secondsPerClip}
            onChange={(event) => onDefaultsCommit({ secondsPerClip: Number(event.target.value) }, 'Duração padrão')}
          >
            {[2, 3, 4, 5, 6, 8].map(seconds => (
              <option key={seconds} value={seconds}>{seconds} s</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vs-default-transition" className="panel-field-label">Transição padrão</label>
          <select
            id="vs-default-transition"
            className="field"
            value={defaults.transition}
            onChange={(event) => onDefaultsCommit(
              { transition: event.target.value as VideoClipTransition },
              'Transição padrão',
            )}
          >
            {TRANSITION_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="vs-row-2">
        <div>
          <RangeField
            id="vs-default-transition-seconds"
            label="Duração da transição padrão"
            min={0}
            max={2}
            step={0.05}
            value={defaults.transitionSeconds}
            onChange={(value) => onDefaultsPreview({ transitionSeconds: value })}
            onCommit={(value) => onDefaultsCommit({ transitionSeconds: value }, 'Duração transição padrão')}
            format={(value) => `${value.toFixed(2)}s`}
          />
        </div>
        <div>
          <label className="panel-field-label" htmlFor="vs-default-transition-easing">Easing padrão</label>
          <select
            id="vs-default-transition-easing"
            className="field"
            value={defaults.transitionEasing}
            onChange={(event) => onDefaultsCommit(
              { transitionEasing: event.target.value as VideoTransitionEasing },
              'Easing padrão',
            )}
          >
            {TRANSITION_EASING_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="vs-row-2">
        <div>
          <label className="panel-field-label" htmlFor="vs-default-kb-direction">Ken Burns padrão</label>
          <select
            id="vs-default-kb-direction"
            className="field"
            value={defaults.kenBurns.direction}
            onChange={(event) => onDefaultsCommit({
              kenBurns: {
                direction: event.target.value as VideoKenBurnsDirection,
                intensity: defaults.kenBurns.intensity,
              },
            }, 'Ken Burns padrão')}
          >
            {KEN_BURNS_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
        <RangeField
          id="vs-default-kb-intensity"
          label="Intensidade padrão"
          min={0}
          max={0.4}
          step={0.01}
          value={defaults.kenBurns.intensity}
          onChange={(intensity) => onDefaultsPreview({
            kenBurns: { direction: defaults.kenBurns.direction, intensity },
          })}
          onCommit={(intensity) => onDefaultsCommit(
            { kenBurns: { direction: defaults.kenBurns.direction, intensity } },
            'Intensidade Ken Burns padrão',
          )}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </div>

      {hasOverride && (
        <button
          type="button"
          className="btn btn-ghost vs-restore"
          onClick={handleClearOverride}
          aria-label={`Resetar overrides do ${clip.title}`}
        >
          Resetar overrides deste plano
        </button>
      )}
    </div>
  );
};

export default MotionPanel;
