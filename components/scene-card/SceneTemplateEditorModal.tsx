import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Scene,
  SceneTemplateElement,
  SceneTemplateElementType,
  SceneTemplateSlotOverride,
} from '../../types';
import type { TemplateSlot } from '../svg-editor/types';
import { parseViewBox } from '../svg-editor/svgDocument';
import { buildSceneSlotStyles, resolveSlotContents } from '../svg-editor/templateBinding';
import TemplateRenderer from '../svg-editor/TemplateRenderer';
import SlotAnimationEditor from '../svg-editor/SlotAnimationEditor';

interface SceneTemplateEditorModalProps {
  scene: Scene;
  markup: string;
  slots: TemplateSlot[];
  onClose: () => void;
  onChange: (slotId: string, override: SceneTemplateSlotOverride | undefined) => void;
  onElementsChange: (elements: SceneTemplateElement[]) => void;
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

const createId = (): string =>
  `scene-el-${typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

const createElement = (
  type: SceneTemplateElementType,
  width: number,
  height: number,
  index: number,
): SceneTemplateElement => {
  const common = {
    id: createId(),
    type,
    name: `Novo ${type === 'text' ? 'texto' : type === 'image' ? 'imagem' : type === 'icon' ? 'ícone' : 'grafismo'}`,
    x: width * 0.12 + index * 12,
    y: height * 0.12 + index * 12,
    width: type === 'icon' ? width * 0.08 : width * 0.34,
    height: type === 'text' ? height * 0.09 : type === 'icon' ? width * 0.08 : height * 0.2,
  };
  if (type === 'text') {
    return { ...common, text: 'Novo texto', fill: '#ffffff', fontSize: Math.round(height * 0.055), fontWeight: 700 };
  }
  if (type === 'image') {
    return { ...common, imageFit: 'cover', borderRadius: 18 };
  }
  if (type === 'icon') {
    return { ...common, iconSvg: ICON_PRESETS.estrela, fill: '#ffffff' };
  }
  return { ...common, shape: 'rectangle', fill: '#7f77dd', borderRadius: 16 };
};

const presetElements = (
  preset: 'title' | 'lower-third' | 'badge' | 'image-card',
  width: number,
  height: number,
  imageHref?: string,
): SceneTemplateElement[] => {
  if (preset === 'title') {
    return [
      {
        id: createId(), type: 'shape', name: 'Fundo do título',
        x: width * 0.08, y: height * 0.34, width: width * 0.84, height: height * 0.3,
        shape: 'rectangle', fill: '#111827', opacity: 0.86, borderRadius: 28,
      },
      {
        id: createId(), type: 'text', name: 'Título principal',
        x: width * 0.13, y: height * 0.4, width: width * 0.74, height: height * 0.11,
        text: 'TÍTULO DA CENA', fill: '#ffffff', fontSize: Math.round(height * 0.075),
        fontWeight: 800, textAlign: 'middle',
      },
      {
        id: createId(), type: 'text', name: 'Subtítulo',
        x: width * 0.2, y: height * 0.52, width: width * 0.6, height: height * 0.06,
        text: 'Subtítulo ou contexto', fill: '#c7d2fe', fontSize: Math.round(height * 0.032),
        fontWeight: 500, textAlign: 'middle',
      },
    ];
  }
  if (preset === 'lower-third') {
    return [
      {
        id: createId(), type: 'shape', name: 'Barra inferior',
        x: width * 0.06, y: height * 0.72, width: width * 0.58, height: height * 0.18,
        shape: 'rectangle', fill: '#111827', opacity: 0.9, borderRadius: 18,
      },
      {
        id: createId(), type: 'shape', name: 'Destaque',
        x: width * 0.06, y: height * 0.72, width: width * 0.012, height: height * 0.18,
        shape: 'pill', fill: '#7f77dd',
      },
      {
        id: createId(), type: 'text', name: 'Nome',
        x: width * 0.09, y: height * 0.745, width: width * 0.5, height: height * 0.07,
        text: 'NOME OU TÍTULO', fill: '#ffffff', fontSize: Math.round(height * 0.042), fontWeight: 800,
      },
      {
        id: createId(), type: 'text', name: 'Descrição',
        x: width * 0.09, y: height * 0.815, width: width * 0.5, height: height * 0.045,
        text: 'Descrição complementar', fill: '#cbd5e1', fontSize: Math.round(height * 0.026), fontWeight: 500,
      },
    ];
  }
  if (preset === 'badge') {
    return [
      {
        id: createId(), type: 'shape', name: 'Fundo do selo',
        x: width * 0.72, y: height * 0.08, width: width * 0.22, height: height * 0.09,
        shape: 'pill', fill: '#7f77dd',
      },
      {
        id: createId(), type: 'icon', name: 'Ícone do selo',
        x: width * 0.74, y: height * 0.095, width: height * 0.055, height: height * 0.055,
        iconSvg: ICON_PRESETS.estrela, fill: '#ffffff',
      },
      {
        id: createId(), type: 'text', name: 'Texto do selo',
        x: width * 0.79, y: height * 0.095, width: width * 0.13, height: height * 0.055,
        text: 'DESTAQUE', fill: '#ffffff', fontSize: Math.round(height * 0.025), fontWeight: 800,
      },
    ];
  }
  return [
    {
      id: createId(), type: 'shape', name: 'Fundo do card',
      x: width * 0.6, y: height * 0.52, width: width * 0.33, height: height * 0.4,
      shape: 'rectangle', fill: '#ffffff', opacity: 0.96, borderRadius: 22,
    },
    {
      id: createId(), type: 'image', name: 'Imagem do card',
      x: width * 0.615, y: height * 0.54, width: width * 0.3, height: height * 0.25,
      imageHref, imageFit: 'cover', borderRadius: 14,
    },
    {
      id: createId(), type: 'text', name: 'Legenda do card',
      x: width * 0.625, y: height * 0.81, width: width * 0.28, height: height * 0.07,
      text: 'Legenda da imagem', fill: '#111827', fontSize: Math.round(height * 0.03), fontWeight: 700,
    },
  ];
};

const SceneTemplateEditorModal: React.FC<SceneTemplateEditorModalProps> = ({
  scene,
  markup,
  slots,
  onClose,
  onChange,
  onElementsChange,
}) => {
  const dimensions = parseViewBox(markup) ?? { width: 1280, height: 720 };
  const elements = scene.templateElements ?? [];
  const [selectedKey, setSelectedKey] = useState(
    slots[0] ? `slot:${slots[0].id}` : elements[0] ? `element:${elements[0].id}` : '',
  );
  const dragRef = useRef<{
    key: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const selectedSlot = selectedKey.startsWith('slot:')
    ? slots.find((slot) => slot.id === selectedKey.slice(5))
    : undefined;
  const selectedElement = selectedKey.startsWith('element:')
    ? elements.find((element) => element.id === selectedKey.slice(8))
    : undefined;
  const override = selectedSlot ? scene.templateOverrides?.[selectedSlot.id] ?? {} : {};

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

  const patchSlot = (changes: Partial<SceneTemplateSlotOverride>) => {
    if (selectedSlot) onChange(selectedSlot.id, { ...override, ...changes });
  };
  const patchElement = (changes: Partial<SceneTemplateElement>) => {
    if (!selectedElement) return;
    onElementsChange(elements.map((element) => (
      element.id === selectedElement.id ? { ...element, ...changes } : element
    )));
  };
  const addElements = (next: SceneTemplateElement[]) => {
    onElementsChange([...elements, ...next]);
    const last = next[next.length - 1];
    if (last) setSelectedKey(`element:${last.id}`);
  };
  const addElement = (type: SceneTemplateElementType) => {
    addElements([createElement(type, dimensions.width, dimensions.height, elements.length)]);
  };
  const removeElement = () => {
    if (!selectedElement) return;
    onElementsChange(elements.filter((element) => element.id !== selectedElement.id));
    setSelectedKey(slots[0] ? `slot:${slots[0].id}` : '');
  };
  const duplicateElementById = (elementId: string) => {
    const source = elements.find((element) => element.id === elementId);
    if (!source) return;
    const copy = {
      ...source,
      id: createId(),
      name: `${source.name} cópia`,
      x: source.x + 18,
      y: source.y + 18,
    };
    addElements([copy]);
  };
  const duplicateElement = () => {
    if (selectedElement) duplicateElementById(selectedElement.id);
  };
  const duplicateSlot = () => {
    if (!selectedSlot) return;
    const content = contents.find((item) => item.id === selectedSlot.id);
    const defaultWidth = dimensions.width * (selectedSlot.type === 'icon' ? 0.08 : 0.34);
    const defaultHeight = dimensions.height * (selectedSlot.type === 'text' ? 0.09 : 0.2);
    const width = selectedSlot.bounds.width || defaultWidth;
    const height = selectedSlot.bounds.height || defaultHeight;
    const base = {
      id: createId(),
      type: selectedSlot.type,
      name: `${selectedSlot.name} cópia`,
      x: selectedSlot.bounds.x + 18,
      y: selectedSlot.bounds.y + 18,
      width,
      height,
      fill: override.fill,
      fontFamily: override.fontFamily,
      fontSize: override.fontSize,
      fontWeight: override.fontWeight,
      opacity: override.opacity,
      animation: override.animation ?? selectedSlot.animation,
    } satisfies SceneTemplateElement;
    const copy: SceneTemplateElement = content?.type === 'text'
      ? { ...base, type: 'text', text: content.value }
      : content?.type === 'image'
        ? { ...base, type: 'image', imageHref: content.href, imageFit: content.fit }
        : {
            ...base,
            type: 'icon',
            iconSvg: content?.type === 'icon' ? content.svg : override.iconSvg ?? ICON_PRESETS.estrela,
          };
    addElements([copy]);
  };
  const moveElement = (
    elementId: string,
    direction: 'forward' | 'backward' | 'front' | 'back',
  ) => {
    const index = elements.findIndex((element) => element.id === elementId);
    if (index < 0) return;
    const next = [...elements];
    const [element] = next.splice(index, 1);
    const target = direction === 'front'
      ? next.length
      : direction === 'back'
        ? 0
        : direction === 'forward'
          ? Math.min(next.length, index + 1)
          : Math.max(0, index - 1);
    next.splice(target, 0, element);
    onElementsChange(next);
  };
  const toggleElementVisibility = (elementId: string) => {
    onElementsChange(elements.map((element) => (
      element.id === elementId ? { ...element, hidden: !element.hidden } : element
    )));
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

  const selectedType = selectedSlot?.type ?? selectedElement?.type;
  const value = selectedElement ?? override;
  const patch = selectedElement ? patchElement : patchSlot;
  const total = slots.length + elements.length;

  const handlePreviewPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as Element;
    const rendered =
      target.closest<SVGElement>('[data-scene-element-id]')
      ?? target.closest<SVGElement>('[data-rendered-slot-id], [data-slot]');
    if (!rendered) return;
    const elementId = rendered.getAttribute('data-scene-element-id');
    const slotId = rendered.getAttribute('data-rendered-slot-id') || rendered.id;
    const key = elementId ? `element:${elementId}` : slotId ? `slot:${slotId}` : '';
    if (!key) return;

    if (elementId) {
      const element = elements.find((item) => item.id === elementId);
      if (!element) return;
      dragRef.current = {
        key,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: element.x,
        startY: element.y,
      };
    } else {
      const current = scene.templateOverrides?.[slotId] ?? {};
      dragRef.current = {
        key,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: current.translateX ?? 0,
        startY: current.translateY ?? 0,
      };
    }
    setSelectedKey(key);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePreviewPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const svg = event.currentTarget.querySelector('svg');
    const rect = svg?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    const dx = ((event.clientX - drag.startClientX) / rect.width) * dimensions.width;
    const dy = ((event.clientY - drag.startClientY) / rect.height) * dimensions.height;

    if (drag.key.startsWith('element:')) {
      const id = drag.key.slice(8);
      onElementsChange(elements.map((element) => (
        element.id === id
          ? { ...element, x: Math.round(drag.startX + dx), y: Math.round(drag.startY + dy) }
          : element
      )));
    } else {
      const id = drag.key.slice(5);
      const current = scene.templateOverrides?.[id] ?? {};
      onChange(id, {
        ...current,
        translateX: Math.round(drag.startX + dx),
        translateY: Math.round(drag.startY + dy),
      });
    }
  };

  const handlePreviewPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
            <span>{total} elemento{total === 1 ? '' : 's'} · alterações exclusivas desta cena</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="scene-template-editor-library">
          <div>
            <strong>Adicionar</strong>
            <button type="button" onClick={() => addElement('text')}>Texto</button>
            <button type="button" onClick={() => addElement('image')}>Imagem</button>
            <button type="button" onClick={() => addElement('icon')}>Ícone</button>
            <button type="button" onClick={() => addElement('shape')}>Forma</button>
          </div>
          <div>
            <strong>Blocos prontos</strong>
            <button type="button" onClick={() => addElements(presetElements('title', dimensions.width, dimensions.height))}>Título central</button>
            <button type="button" onClick={() => addElements(presetElements('lower-third', dimensions.width, dimensions.height))}>Lower third</button>
            <button type="button" onClick={() => addElements(presetElements('badge', dimensions.width, dimensions.height))}>Selo</button>
            <button type="button" onClick={() => addElements(presetElements('image-card', dimensions.width, dimensions.height, scene.imageUrl))}>Card de imagem</button>
          </div>
        </div>

        <div className="scene-template-editor-body">
          <aside className="scene-template-slot-list">
            {slots.length > 0 && <p className="scene-template-list-label">Do modelo</p>}
            {slots.map((slot, index) => (
              <button
                key={slot.id}
                type="button"
                aria-label={`${index + 1}. ${slot.name} (${slot.type})`}
                className={selectedKey === `slot:${slot.id}` ? 'selected' : ''}
                onClick={() => setSelectedKey(`slot:${slot.id}`)}
              >
                <span>{index + 1}. {slot.name}</span>
                <small>{slot.type}</small>
              </button>
            ))}
            {elements.length > 0 && <p className="scene-template-list-label">Da cena</p>}
            {[...elements].reverse().map((element, reversedIndex) => {
              const index = elements.length - 1 - reversedIndex;
              return (
              <div
                key={element.id}
                className={`scene-template-layer-row${selectedKey === `element:${element.id}` ? ' selected' : ''}`}
              >
                <button
                  type="button"
                  className="scene-template-layer-main"
                  aria-label={`${element.name} (${element.type})`}
                  onClick={() => setSelectedKey(`element:${element.id}`)}
                >
                  <span>{element.name}</span>
                  <small>{element.type} · camada {index + 1}</small>
                </button>
                <div className="scene-template-layer-actions">
                  <button type="button" title={element.hidden ? 'Mostrar' : 'Ocultar'} aria-label={`${element.hidden ? 'Mostrar' : 'Ocultar'} ${element.name}`} onClick={() => toggleElementVisibility(element.id)}>
                    {element.hidden ? '○' : '●'}
                  </button>
                  <button type="button" title="Duplicar" aria-label={`Duplicar ${element.name}`} onClick={() => duplicateElementById(element.id)}>⧉</button>
                  <button type="button" title="Trazer para frente" aria-label={`Trazer ${element.name} para frente`} disabled={index === elements.length - 1} onClick={() => moveElement(element.id, 'forward')}>↑</button>
                  <button type="button" title="Enviar para trás" aria-label={`Enviar ${element.name} para trás`} disabled={index === 0} onClick={() => moveElement(element.id, 'backward')}>↓</button>
                </div>
              </div>
            )})}
          </aside>

          <main
            className="scene-template-preview"
            onPointerDown={handlePreviewPointerDown}
            onPointerMove={handlePreviewPointerMove}
            onPointerUp={handlePreviewPointerUp}
            onPointerCancel={handlePreviewPointerUp}
          >
            <TemplateRenderer
              markup={markup}
              contents={contents}
              options={{
                styleById,
                additionalElements: elements,
              }}
              className="scene-template-preview-document"
            />
          </main>

          <aside className="scene-template-properties">
            {(selectedSlot || selectedElement) ? (
              <>
                <div className="scene-template-properties-title">
                  <div>
                    <strong>{selectedSlot?.name ?? selectedElement?.name}</strong>
                    <span>{selectedType} · {selectedSlot?.id ?? selectedElement?.id}</span>
                  </div>
                  {selectedSlot ? (
                    <div className="scene-template-element-actions">
                      <button type="button" aria-label={`Duplicar ${selectedSlot.name}`} onClick={duplicateSlot}>Duplicar</button>
                      <button type="button" onClick={() => onChange(selectedSlot.id, undefined)}>Restaurar</button>
                    </div>
                  ) : (
                    <div className="scene-template-element-actions">
                      <button type="button" onClick={() => moveElement(selectedElement!.id, 'front')}>Topo</button>
                      <button type="button" onClick={() => moveElement(selectedElement!.id, 'back')}>Fundo</button>
                      <button type="button" onClick={duplicateElement}>Duplicar</button>
                      <button type="button" onClick={removeElement}>Excluir</button>
                    </div>
                  )}
                </div>

                {selectedElement && (
                  <label>
                    <span>Nome da camada</span>
                    <input className="field" value={selectedElement.name} onChange={(event) => patchElement({ name: event.target.value })} />
                  </label>
                )}

                {selectedType === 'text' && (
                  <label>
                    <span>Texto</span>
                    <textarea
                      className="field"
                      rows={4}
                      value={value.text ?? ''}
                      placeholder={selectedSlot ? 'Conteúdo automático da cena' : 'Digite o texto'}
                      onChange={(event) => patch({ text: event.target.value || undefined })}
                    />
                  </label>
                )}

                {selectedType === 'image' && (
                  <>
                    <label>
                      <span>Imagem</span>
                      <select
                        className="field"
                        value={value.imageHref ?? ''}
                        onChange={(event) => patch({ imageHref: event.target.value || undefined })}
                      >
                        <option value="">{selectedSlot ? 'Automática pela ordem' : 'Sem imagem'}</option>
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
                        value={value.imageFit ?? 'cover'}
                        onChange={(event) => patch({ imageFit: event.target.value as 'cover' | 'contain' })}
                      >
                        <option value="cover">Preencher e cortar</option>
                        <option value="contain">Mostrar inteira</option>
                      </select>
                    </label>
                    {selectedElement && (
                      <>
                        <label>
                          <span>Máscara rápida</span>
                          <select
                            className="field"
                            value={selectedElement.imageMask ?? 'rectangle'}
                            onChange={(event) => patchElement({
                              imageMask: event.target.value as SceneTemplateElement['imageMask'],
                              maskElementId: undefined,
                            })}
                          >
                            <option value="rectangle">Retângulo</option>
                            <option value="rounded">Retângulo arredondado</option>
                            <option value="circle">Círculo</option>
                            <option value="ellipse">Elipse</option>
                            <option value="triangle">Triângulo</option>
                            <option value="star">Estrela</option>
                            <option value="hexagon">Hexágono</option>
                          </select>
                        </label>
                        <label>
                          <span>Usar shape da cena como máscara</span>
                          <select
                            className="field"
                            value={selectedElement.maskElementId ?? ''}
                            onChange={(event) => {
                              const maskElementId = event.target.value || undefined;
                              const mask = elements.find((element) => element.id === maskElementId);
                              if (mask?.type === 'shape') {
                                onElementsChange(elements.map((element) => {
                                  if (element.id === selectedElement.id) {
                                    return {
                                      ...element,
                                      maskElementId,
                                      x: mask.x,
                                      y: mask.y,
                                      width: mask.width,
                                      height: mask.height,
                                      rotation: 0,
                                    };
                                  }
                                  return element.id === mask.id ? { ...element, hidden: true } : element;
                                }));
                              } else {
                                patchElement({ maskElementId });
                              }
                            }}
                          >
                            <option value="">Nenhum shape vinculado</option>
                            {elements
                              .filter((element) => element.type === 'shape' && element.shape !== 'line')
                              .map((element) => (
                                <option key={element.id} value={element.id}>{element.name}</option>
                              ))}
                          </select>
                        </label>
                      </>
                    )}
                  </>
                )}

                {selectedType === 'icon' && (
                  <>
                    <div className="scene-template-icon-presets">
                      {Object.entries(ICON_PRESETS).map(([name, svg]) => (
                        <button key={name} type="button" onClick={() => patch({ iconSvg: svg })}>{name}</button>
                      ))}
                    </div>
                    <label>
                      <span>SVG do ícone</span>
                      <textarea
                        className="field"
                        rows={5}
                        value={value.iconSvg ?? ''}
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

                {selectedElement?.type === 'shape' && (
                  <label>
                    <span>Tipo de forma</span>
                    <select
                      className="field"
                      value={selectedElement.shape ?? 'rectangle'}
                      onChange={(event) => patchElement({ shape: event.target.value as SceneTemplateElement['shape'] })}
                    >
                      <option value="rectangle">Retângulo</option>
                      <option value="pill">Cápsula</option>
                      <option value="circle">Círculo / elipse</option>
                      <option value="line">Linha</option>
                    </select>
                  </label>
                )}

                <div className="scene-template-section">
                  <strong>Posição e tamanho</strong>
                  <div className="scene-template-grid">
                    {selectedElement ? (
                      <>
                        <label><span>X</span><input type="number" step="1" value={selectedElement.x} onChange={(event) => patchElement({ x: numberValue(event.target.value) ?? 0 })} /></label>
                        <label><span>Y</span><input type="number" step="1" value={selectedElement.y} onChange={(event) => patchElement({ y: numberValue(event.target.value) ?? 0 })} /></label>
                        <label><span>Largura</span><input type="number" min="1" step="1" value={selectedElement.width} onChange={(event) => patchElement({ width: Math.max(1, numberValue(event.target.value) ?? 1) })} /></label>
                        <label><span>Altura</span><input type="number" min="1" step="1" value={selectedElement.height} onChange={(event) => patchElement({ height: Math.max(1, numberValue(event.target.value) ?? 1) })} /></label>
                        <label><span>Rotação</span><input type="number" step="1" value={selectedElement.rotation ?? 0} onChange={(event) => patchElement({ rotation: numberValue(event.target.value) })} /></label>
                      </>
                    ) : (
                      <>
                        <label><span>X</span><input type="number" step="1" value={override.translateX ?? 0} onChange={(event) => patchSlot({ translateX: numberValue(event.target.value) })} /></label>
                        <label><span>Y</span><input type="number" step="1" value={override.translateY ?? 0} onChange={(event) => patchSlot({ translateY: numberValue(event.target.value) })} /></label>
                        <label><span>Escala</span><input type="number" min="0.01" step="0.05" value={override.scale ?? 1} onChange={(event) => patchSlot({ scale: numberValue(event.target.value) })} /></label>
                        <label><span>Rotação</span><input type="number" step="1" value={override.rotation ?? 0} onChange={(event) => patchSlot({ rotation: numberValue(event.target.value) })} /></label>
                      </>
                    )}
                  </div>
                </div>

                <div className="scene-template-section">
                  <strong>Aparência</strong>
                  <div className="scene-template-grid">
                    <label><span>Opacidade</span><input type="number" min="0" max="1" step="0.05" value={value.opacity ?? 1} onChange={(event) => patch({ opacity: numberValue(event.target.value) })} /></label>
                    {selectedType !== 'image' && (
                      <label><span>Cor</span><input type="color" value={value.fill ?? '#ffffff'} onChange={(event) => patch({ fill: event.target.value })} /></label>
                    )}
                    {selectedElement?.type === 'shape' && (
                      <>
                        <label><span>Contorno</span><input type="color" value={selectedElement.stroke ?? '#ffffff'} onChange={(event) => patchElement({ stroke: event.target.value })} /></label>
                        <label><span>Espessura</span><input type="number" min="0" step="1" value={selectedElement.strokeWidth ?? 0} onChange={(event) => patchElement({ strokeWidth: numberValue(event.target.value) })} /></label>
                        <label><span>Arredondamento</span><input type="number" min="0" step="1" value={selectedElement.borderRadius ?? 0} onChange={(event) => patchElement({ borderRadius: numberValue(event.target.value) })} /></label>
                      </>
                    )}
                    {selectedType === 'text' && (
                      <>
                        <label><span>Tamanho</span><input type="number" min="1" value={value.fontSize ?? ''} placeholder="modelo" onChange={(event) => patch({ fontSize: numberValue(event.target.value) })} /></label>
                        <label><span>Peso</span><input type="number" min="100" max="900" step="100" value={value.fontWeight ?? ''} placeholder="modelo" onChange={(event) => patch({ fontWeight: numberValue(event.target.value) })} /></label>
                        {selectedElement && (
                          <label>
                            <span>Alinhamento</span>
                            <select className="field" value={selectedElement.textAlign ?? 'start'} onChange={(event) => patchElement({ textAlign: event.target.value as SceneTemplateElement['textAlign'] })}>
                              <option value="start">Esquerda</option>
                              <option value="middle">Centro</option>
                              <option value="end">Direita</option>
                            </select>
                          </label>
                        )}
                      </>
                    )}
                  </div>
                  <label className="scene-template-visible">
                    <input type="checkbox" checked={!value.hidden} onChange={(event) => patch({ hidden: !event.target.checked })} />
                    <span>Elemento visível</span>
                  </label>
                </div>

                <div className="scene-template-section">
                  <strong>Animação desta cena</strong>
                  <SlotAnimationEditor
                    animation={
                      value.animation === null
                        ? undefined
                        : value.animation ?? selectedSlot?.animation
                    }
                    onChange={(animation) => patch({ animation: animation ?? null })}
                  />
                </div>
              </>
            ) : (
              <div className="scene-template-selection-empty">
                <strong>Adicione ou selecione um elemento</strong>
                <span>Use os botões acima para inserir textos, imagens, ícones, formas ou blocos prontos.</span>
              </div>
            )}
          </aside>
        </div>

        <footer className="scene-template-editor-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              for (const slot of slots) onChange(slot.id, undefined);
              onElementsChange([]);
              setSelectedKey(slots[0] ? `slot:${slots[0].id}` : '');
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
