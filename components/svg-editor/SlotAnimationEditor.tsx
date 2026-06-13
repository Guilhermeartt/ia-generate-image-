import React from 'react';
import type {
  VideoKenBurnsDirection,
  VideoLetteringEnterAnimation,
  VideoLetteringExitAnimation,
} from '../../types';
import type { SlotAnimation } from './slotAnimation';

interface SlotAnimationEditorProps {
  animation: SlotAnimation | undefined;
  onChange: (animation: SlotAnimation | undefined) => void;
  allowKenBurns?: boolean;
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

const KEN_BURNS_OPTIONS: { value: VideoKenBurnsDirection; label: string }[] = [
  { value: 'none', label: 'Desativado' },
  { value: 'zoom-in', label: 'Aproximar' },
  { value: 'zoom-out', label: 'Afastar' },
  { value: 'pan-left', label: 'Mover para esquerda' },
  { value: 'pan-right', label: 'Mover para direita' },
  { value: 'pan-up', label: 'Mover para cima' },
  { value: 'pan-down', label: 'Mover para baixo' },
];

const numberOrUndefined = (raw: string): number | undefined => {
  if (raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

const SlotAnimationEditor: React.FC<SlotAnimationEditorProps> = ({
  animation,
  onChange,
  allowKenBurns = false,
}) => {
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

          {allowKenBurns && (
            <div className="svg-editor-ken-burns">
              <strong>Ken Burns</strong>
              <label className="svg-editor-inline-field">
                <span>Movimento</span>
                <select
                  aria-label="Movimento Ken Burns"
                  value={animation.kenBurns?.direction ?? 'none'}
                  onChange={(event) => {
                    const direction = event.target.value as VideoKenBurnsDirection;
                    patch({
                      kenBurns: direction === 'none'
                        ? undefined
                        : {
                            direction,
                            intensity: animation.kenBurns?.intensity ?? 0.12,
                          },
                    });
                  }}
                >
                  {KEN_BURNS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {animation.kenBurns && animation.kenBurns.direction !== 'none' && (
                <div className="svg-editor-transform-grid">
                  <label>
                    <span>Intensidade</span>
                    <input
                      aria-label="Intensidade Ken Burns"
                      type="number"
                      min="0.01"
                      max="0.4"
                      step="0.01"
                      value={animation.kenBurns.intensity}
                      onChange={(event) => patch({
                        kenBurns: {
                          ...animation.kenBurns!,
                          intensity: Math.max(0.01, Math.min(0.4, Number(event.target.value) || 0.01)),
                        },
                      })}
                    />
                  </label>
                  <label>
                    <span>Duração (s)</span>
                    <input
                      aria-label="Duração Ken Burns"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={animation.kenBurnsDurationSeconds ?? 5}
                      onChange={(event) => patch({
                        kenBurnsDurationSeconds: numberOrUndefined(event.target.value),
                      })}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SlotAnimationEditor;
