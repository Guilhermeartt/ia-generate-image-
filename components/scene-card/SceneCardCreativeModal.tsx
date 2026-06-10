import React, { useCallback, useEffect, useRef, useState } from 'react';
import Spinner from '../ui/Spinner';
import { SparklesIcon } from '../icons';
import { CREATIVE_DIRECTION_SUGGESTIONS } from '../sceneCard.constants';

const RECENT_STORAGE_KEY = 'sc.creative-directions.recent.v1';
const MAX_RECENT = 6;

const loadRecent = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveRecent = (recent: string[]) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent)); }
  catch { /* noop */ }
};

interface SceneCardCreativeModalProps {
  sceneLabel: string;
  initialValue: string;
  isBusy: boolean;
  onCancel: () => void;
  onSubmit: (direction: string) => Promise<void> | void;
}

const SceneCardCreativeModal: React.FC<SceneCardCreativeModalProps> = ({
  sceneLabel,
  initialValue,
  isBusy,
  onCancel,
  onSubmit,
}) => {
  const [direction, setDirection] = useState(initialValue);
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const appendSuggestion = useCallback((s: string) => {
    setDirection(prev => {
      const t = prev.trim();
      return t ? `${t}; ${s.toLowerCase()}` : s;
    });
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = direction.trim();
    if (!trimmed || submitting || isBusy) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      const nextRecent = [trimmed, ...recent.filter(r => r.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
      setRecent(nextRecent);
      saveRecent(nextRecent);
    } finally {
      setSubmitting(false);
    }
  }, [direction, submitting, isBusy, onSubmit, recent]);

  const busy = submitting || isBusy;

  return (
    <div
      className="sc-creative-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Refazer direção criativa"
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div className="sc-creative-wrap">
        <div className="sc-creative-head">
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Refazer direção criativa</p>
            <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{sceneLabel}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div className="sc-creative-body">
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--violet-text-h)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Sugestões
            </p>
            <div className="sc-creative-chips">
              {CREATIVE_DIRECTION_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => appendSuggestion(s)}
                  disabled={busy}
                  className="sc-creative-chip"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {recent.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Usadas recentemente
              </p>
              <div className="sc-creative-chips">
                {recent.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDirection(r)}
                    disabled={busy}
                    className="sc-creative-chip is-recent"
                    title={r}
                  >
                    {r.length > 50 ? `${r.slice(0, 47)}…` : r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            disabled={busy}
            rows={5}
            placeholder="Ex: deixe a cena mais cinematográfica, ângulo baixo, luz dramática de fim de tarde, paleta âmbar — mantendo os mesmos personagens e ação."
            className="field"
            style={{ fontSize: 12, resize: 'vertical', width: '100%' }}
            aria-label="Direção criativa"
          />
          <p style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.4 }}>
            A IA refaz o prompt mantendo o conteúdo da cena. Cmd/Ctrl+Enter para enviar.
          </p>
        </div>

        <div className="sc-creative-foot">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '5px 12px' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !direction.trim()}
            className="btn btn-primary"
            style={{ fontSize: 11, padding: '5px 14px', background: '#7C3AED', borderColor: '#7C3AED' }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handleSubmit();
            }}
          >
            {busy ? <Spinner size={12} /> : <SparklesIcon width={13} height={13} />}
            {busy ? 'Recriando…' : 'Recriar prompt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SceneCardCreativeModal;
