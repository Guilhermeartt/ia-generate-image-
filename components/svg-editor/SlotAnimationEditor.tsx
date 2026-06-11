import React from 'react';
import type { VideoLetteringEnterAnimation, VideoLetteringExitAnimation } from '../../types';
import type { SlotAnimation } from './slotAnimation';

interface SlotAnimationEditorProps {
  animation: SlotAnimation | undefined;
  onChange: (animation: SlotAnimation | undefined) => void;
}

const ENTER_OPTIONS: { value: VideoLetteringEnterAnimation; label: string }[] = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-up', label: 'Sobe' },
  { value: 'slide-left', label: 'Pela esquerda' },
  { value: 'rise', label: 'Emerge' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'pop', label: 'Pop' },
  { value: 'bounce', label: 'Quicar' },
  { value: 'blur-in', label: 'Desfoque' },
  { value: 'glitch', label: 'Glitch' },
];

const EXIT_OPTIONS: { value: VideoLetteringExitAnimation; label: string }[] = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-down', label: 'Desce' },
  { value: 'slide-right', label: 'Pela direita' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'pop-out', label: 'Pop out' },
  { value: 'blur-out', label: 'Desfoque' },
  { value: 'swipe-out', label: 'Varredura' },
  { value: 'dissolve', label: 'Dissolver' },
];

const DEFAULT_ANIMATION: SlotAnimation = {
  enter: 'fade',
  exit: 'fade',
  enterDurationSeconds: 0.5,
  exitDurationSeconds: 0.5,
};

const numberOrUndefined = (raw: string): number | undefined => {
  if (raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

const SlotAnimationEditor: React.FC<SlotAnimationEditorProps> = ({ animation, onChange }) => {
  const patch = (changes: Partial<SlotAnimation>) =>
    onChange({ ...(animation ?? DEFAULT_ANIMATION), ...changes });

  return (
    <div className="svg-editor-slot-animation">
      <label className="svg-editor-inline-field">
        <span>Animar</span>
        <input
          type="checkbox"
          checked={!!animation}
          onChange={(event) => onChange(event.target.checked ? DEFAULT_ANIMATION : undefined)}
        />
      </label>

      {animation && (
        <>
          <label className="svg-editor-inline-field">
            <span>Entrada</span>
            <select
              value={animation.enter}
              onChange={(event) =>
                patch({ enter: event.target.value as VideoLetteringEnterAnimation })
              }
            >
              {ENTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="svg-editor-inline-field">
            <span>Saída</span>
            <select
              value={animation.exit}
              onChange={(event) =>
                patch({ exit: event.target.value as VideoLetteringExitAnimation })
              }
            >
              {EXIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="svg-editor-transform-grid">
            <label>
              <span>Início (s)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={animation.startSeconds ?? 0}
                onChange={(event) => patch({ startSeconds: numberOrUndefined(event.target.value) })}
              />
            </label>
            <label>
              <span>Fim (s)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={animation.endSeconds ?? ''}
                placeholder="—"
                onChange={(event) => patch({ endSeconds: numberOrUndefined(event.target.value) })}
              />
            </label>
            <label>
              <span>Dur. entrada</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={animation.enterDurationSeconds ?? 0.5}
                onChange={(event) =>
                  patch({ enterDurationSeconds: numberOrUndefined(event.target.value) })
                }
              />
            </label>
            <label>
              <span>Dur. saída</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={animation.exitDurationSeconds ?? 0.5}
                onChange={(event) =>
                  patch({ exitDurationSeconds: numberOrUndefined(event.target.value) })
                }
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
};

export default SlotAnimationEditor;
