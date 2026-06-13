import React, { useEffect, useMemo, useState } from 'react';
import type { Scene, SceneTemplateSlotOverride } from '../../types';
import type { TemplateSlot } from '../svg-editor/types';
import { buildSceneSlotStyles, resolveSlotContents } from '../svg-editor/templateBinding';
import TemplateRenderer from '../svg-editor/TemplateRenderer';
import SlotAnimationEditor from '../svg-editor/SlotAnimationEditor';

interface SceneTemplateEditorModalProps {
  scene: Scene;
  markup: string;
  slots: TemplateSlot[];
  onClose: () => void;
  onChange: (slotId: string, override: SceneTemplateSlotOverride | undefined) => void;
}

const ICON_PRESETS = {
  estrela:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.8 1.2 6.9-6.2-3.3L5.8 21 7 14.1l-5-4.8 6.9-1Z" fill="currentColor"/></svg>',
  coração:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill="currentColor"/></svg>',
  seta:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m13 5 7 7-7 7v-4H4V9h9Z" fill="currentColor"/></svg>',
} as const;

const numberValue = (raw: string): number | undefined => {
  if (!raw.trim()) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

const SceneTemplateEditorModal: React.FC<SceneTemplateEditorModalProps> = ({
  scene,
  markup,
  slots,
  onClose,
  onChange,
}) => {
  const [selectedId, setSelectedId] = useState(slots[0]?.id ?? '');
  const selected = slots.find((slot) => slot.id === selectedId) ?? slots[0];
  const override = selected ? scene.templateOverrides?.[selected.id] ?? {} : {};

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const contents = useMemo(
    () => resolveSlotContents(slots, scene, scene.templateOverrides),
    [slots, scene],
  );
  const styleById = useMemo(
    () => buildSceneSlotStyles(slots, scene.templateOverrides),
    [slots, scene.templateOverrides],
  );

  const patch = (changes: Partial<SceneTemplateSlotOverride>) => {
    if (!selected) return;
    onChange(selected.id, { ...override, ...changes });
  };

  const imageOptions = useMemo(
    () => [
      scene.imageUrl ? { label: 'Imagem principal', value: scene.imageUrl } : null,
      ...(scene.splitImages ?? []).map((image, index) => ({
        label: `Imagem dividida ${index + 1}`,
        value: image.imageUrl,
      })),
      scene.endFrameUrl ? { label: 'Frame final', value: scene.endFrameUrl } : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item?.value)),
    [scene.imageUrl, scene.splitImages, scene.endFrameUrl],
  );

  const readFile = (file: File, callback: (value: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => callback(String(reader.result ?? ''));
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) reader.readAsText(file);
    else reader.readAsDataURL(file);
  };

  return (
    <div
      className="scene-template-editor-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Editar composição da cena"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="scene-template-editor">
        <header className="scene-template-editor-head">
          <div>
            <strong>Editar composição da cena</strong>
            <span>
              {slots.length} elemento{slots.length === 1 ? '' : 's'} · alterações exclusivas desta cena
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="scene-template-editor-body">
          <aside className="scene-template-slot-list">
            {slots.map((slot, index) => (
              <button
                key={slot.id}
                type="button"
                aria-label={`${index + 1}. ${slot.name} (${slot.type})`}
                className={slot.id === selected?.id ? 'selected' : ''}
                onClick={() => setSelectedId(slot.id)}
              >
                <span>{index + 1}. {slot.name}</span>
                <small>{slot.type}</small>
              </button>
            ))}
          </aside>

          <main className="scene-template-preview">
            <TemplateRenderer
              markup={markup}
              contents={contents}
              options={{ styleById }}
              className="scene-template-preview-document"
            />
          </main>

          <aside className="scene-template-properties">
            {selected ? (
              <>
                <div className="scene-template-properties-title">
                  <div>
                    <strong>{selected.name}</strong>
                    <span>{selected.type} · {selected.id}</span>
                  </div>
                  <button type="button" onClick={() => onChange(selected.id, undefined)}>
                    Restaurar
                  </button>
                </div>

                {selected.type === 'text' && (
                  <label>
                    <span>Texto</span>
                    <textarea
                      className="field"
                      rows={4}
                      value={override.text ?? ''}
                      placeholder="Conteúdo automático da cena"
                      onChange={(event) => patch({ text: event.target.value || undefined })}
                    />
                  </label>
                )}

                {selected.type === 'image' && (
                  <>
                    <label>
                      <span>Imagem</span>
                      <select
                        className="field"
                        value={override.imageHref ?? ''}
                        onChange={(event) => patch({ imageHref: event.target.value || undefined })}
                      >
                        <option value="">Automática pela ordem</option>
                        {imageOptions.map((item) => (
                          <option key={item.label} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="scene-template-file">
                      <span>Enviar outra imagem</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) readFile(file, (imageHref) => patch({ imageHref }));
                        }}
                      />
                    </label>
                    <label>
                      <span>Encaixe</span>
                      <select
                        className="field"
                        value={override.imageFit ?? 'cover'}
                        onChange={(event) => patch({ imageFit: event.target.value as 'cover' | 'contain' })}
                      >
                        <option value="cover">Preencher e cortar</option>
                        <option value="contain">Mostrar inteira</option>
                      </select>
                    </label>
                  </>
                )}

                {selected.type === 'icon' && (
                  <>
                    <div className="scene-template-icon-presets">
                      {Object.entries(ICON_PRESETS).map(([name, svg]) => (
                        <button key={name} type="button" onClick={() => patch({ iconSvg: svg })}>
                          {name}
                        </button>
                      ))}
                    </div>
                    <label>
                      <span>SVG do ícone</span>
                      <textarea
                        className="field"
                        rows={5}
                        value={override.iconSvg ?? ''}
                        placeholder="<svg viewBox=&quot;0 0 24 24&quot;>…</svg>"
                        onChange={(event) => patch({ iconSvg: event.target.value || undefined })}
                      />
                    </label>
                    <label className="scene-template-file">
                      <span>Enviar arquivo SVG</span>
                      <input
                        type="file"
                        accept="image/svg+xml,.svg"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) readFile(file, (iconSvg) => patch({ iconSvg }));
                        }}
                      />
                    </label>
                  </>
                )}

                <div className="scene-template-section">
                  <strong>Posição e tamanho</strong>
                  <div className="scene-template-grid">
                    <label><span>X</span><input type="number" step="1" value={override.translateX ?? 0} onChange={(event) => patch({ translateX: numberValue(event.target.value) })} /></label>
                    <label><span>Y</span><input type="number" step="1" value={override.translateY ?? 0} onChange={(event) => patch({ translateY: numberValue(event.target.value) })} /></label>
                    <label><span>Escala</span><input type="number" min="0.01" step="0.05" value={override.scale ?? 1} onChange={(event) => patch({ scale: numberValue(event.target.value) })} /></label>
                    <label><span>Rotação</span><input type="number" step="1" value={override.rotation ?? 0} onChange={(event) => patch({ rotation: numberValue(event.target.value) })} /></label>
                  </div>
                </div>

                <div className="scene-template-section">
                  <strong>Aparência</strong>
                  <div className="scene-template-grid">
                    <label><span>Opacidade</span><input type="number" min="0" max="1" step="0.05" value={override.opacity ?? 1} onChange={(event) => patch({ opacity: numberValue(event.target.value) })} /></label>
                    {selected.type !== 'image' && (
                      <label><span>Cor</span><input type="color" value={override.fill ?? '#ffffff'} onChange={(event) => patch({ fill: event.target.value })} /></label>
                    )}
                    {selected.type === 'text' && (
                      <>
                        <label><span>Tamanho</span><input type="number" min="1" value={override.fontSize ?? ''} placeholder="modelo" onChange={(event) => patch({ fontSize: numberValue(event.target.value) })} /></label>
                        <label><span>Peso</span><input type="number" min="100" max="900" step="100" value={override.fontWeight ?? ''} placeholder="modelo" onChange={(event) => patch({ fontWeight: numberValue(event.target.value) })} /></label>
                      </>
                    )}
                  </div>
                  <label className="scene-template-visible">
                    <input type="checkbox" checked={!override.hidden} onChange={(event) => patch({ hidden: !event.target.checked })} />
                    <span>Elemento visível</span>
                  </label>
                </div>

                <div className="scene-template-section">
                  <strong>Animação desta cena</strong>
                  <SlotAnimationEditor
                    animation={override.animation === null ? undefined : override.animation ?? selected.animation}
                    onChange={(animation) => patch({ animation: animation ?? null })}
                  />
                </div>
              </>
            ) : (
              <p>Nenhum elemento disponível.</p>
            )}
          </aside>
        </div>

        <footer className="scene-template-editor-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              for (const slot of slots) onChange(slot.id, undefined);
            }}
          >
            Restaurar cena
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Concluir edição</button>
        </footer>
      </div>
    </div>
  );
};

export default SceneTemplateEditorModal;
