import React, { useMemo, useState } from 'react';
import type { Scene } from '../../types';
import type { TemplateSlot } from '../svg-editor/types';
import { resolveSlotContents } from '../svg-editor/templateBinding';
import { suggestTemplateBinding } from '../../services/geminiService';

interface SceneTemplateOverridesProps {
  scene: Scene;
  slots: TemplateSlot[];
  disabled?: boolean;
  onChange: (slotId: string, override: { text?: string; imageHref?: string } | undefined) => void;
}

/**
 * Edita o texto dos slots SÓ para esta cena (sobrescreve o binding automático).
 * Campo vazio = volta ao valor automático. Não renderiza se o modelo não tiver
 * slots de texto.
 */
const SceneTemplateOverrides: React.FC<SceneTemplateOverridesProps> = ({
  scene,
  slots,
  disabled,
  onChange,
}) => {
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textSlots = slots.filter((slot) => slot.type === 'text');

  // Valores automáticos (sem overrides) — usados como placeholder.
  const defaults = useMemo(() => {
    const map: Record<string, string> = {};
    for (const content of resolveSlotContents(slots, scene, {})) {
      if (content.type === 'text') map[content.id] = content.value;
    }
    return map;
  }, [slots, scene]);

  if (textSlots.length === 0) return null;

  const handleSuggest = async () => {
    setSuggesting(true);
    setError(null);
    try {
      const bindings = await suggestTemplateBinding(
        textSlots.map((slot) => ({ id: slot.id, name: slot.name, type: slot.type })),
        {
          lettering: scene.videoLettering?.text || scene.lettering_notes?.join(' · ') || '',
          description: scene.original_description || scene.tagged_description || '',
          location: scene.original_location || '',
        },
      );
      for (const [slotId, text] of Object.entries(bindings)) {
        if (text) onChange(slotId, { text });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao sugerir textos.');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div
      className="sc-template-overrides"
      style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {textSlots.map((slot) => (
        <label
          key={slot.id}
          style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}
        >
          <span style={{ color: 'var(--text-4)', fontWeight: 500 }}>{slot.name}</span>
          <input
            type="text"
            disabled={disabled}
            value={scene.templateOverrides?.[slot.id]?.text ?? ''}
            placeholder={defaults[slot.id] ?? slot.name}
            onChange={(event) =>
              onChange(slot.id, event.target.value ? { text: event.target.value } : undefined)
            }
            style={{ fontSize: 11 }}
          />
        </label>
      ))}

      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled || suggesting}
        onClick={() => void handleSuggest()}
        style={{ fontSize: 11, alignSelf: 'flex-start' }}
      >
        {suggesting ? 'Sugerindo…' : 'Sugerir textos (IA)'}
      </button>
      {error && (
        <span style={{ fontSize: 10, color: 'var(--amber, #d97706)' }}>{error}</span>
      )}
    </div>
  );
};

export default SceneTemplateOverrides;
