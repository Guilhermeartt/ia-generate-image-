import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Scene,
  SceneTemplateAnimation,
  SceneTemplateElement,
  SceneTemplateElementType,
  SceneTemplateSlotOverride,
} from '../../types';
import type { TemplateSlot } from '../svg-editor/types';
import { getSvgElementProperties, parseViewBox } from '../svg-editor/svgDocument';
import { buildSceneSlotStyles, resolveSlotContents } from '../svg-editor/templateBinding';
import { renderTemplate } from '../svg-editor/templateRender';
import {
  previewDurationSeconds,
  slotStyleAtTime,
  type EnterExitStyle,
} from '../svg-editor/slotAnimation';
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

interface SceneEditorSnapshot {
  overrides: Record<string, SceneTemplateSlotOverride>;
  elements: SceneTemplateElement[];
  selectedKey: string;
}

const HISTORY_LIMIT = 10;

const cloneSnapshot = (snapshot: SceneEditorSnapshot): SceneEditorSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as SceneEditorSnapshot;

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
  const elements = useMemo(() => scene.templateElements ?? [], [scene.templateElements]);
  const [selectedKey, setSelectedKey] = useState(
    slots[0] ? `slot:${slots[0].id}` : elements[0] ? `element:${elements[0].id}` : '',
  );
  const [layerQuery, setLayerQuery] = useState('');
  const [canvasZoom, setCanvasZoom] = useState(100);
  const [actionMessage, setActionMessage] = useState('Pronto para editar');
  const [showGuides, setShowGuides] = useState(true);
  const [guideMode, setGuideMode] = useState<'center' | 'thirds' | 'grid'>('thirds');
  const [safeAreaMode, setSafeAreaMode] = useState<'off' | 'action' | 'title' | 'both'>('off');
  const [animationPlaying, setAnimationPlaying] = useState(true);
  const [animationTime, setAnimationTime] = useState(0);
  const animationTimeRef = useRef(0);
  const historyRef = useRef<{ past: SceneEditorSnapshot[]; future: SceneEditorSnapshot[] }>({
    past: [],
    future: [],
  });
  const [historyStatus, setHistoryStatus] = useState({ canUndo: false, canRedo: false });
  const currentSnapshotRef = useRef<SceneEditorSnapshot>({
    overrides: scene.templateOverrides ?? {},
    elements,
    selectedKey,
  });
  useEffect(() => {
    currentSnapshotRef.current = {
      overrides: scene.templateOverrides ?? {},
      elements,
      selectedKey,
    };
  }, [scene.templateOverrides, elements, selectedKey]);
  const dragRef = useRef<{
    key: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    historyRecorded: boolean;
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
  const activeAnimations = useMemo(
    () => [
      ...slots.map((slot) => {
        const animation = scene.templateOverrides?.[slot.id]?.animation;
        return animation === null ? undefined : animation ?? slot.animation;
      }),
      ...elements.map((element) => element.animation ?? undefined),
    ].filter((animation): animation is SceneTemplateAnimation => Boolean(animation)),
    [slots, scene.templateOverrides, elements],
  );
  const animationDuration = useMemo(
    () => previewDurationSeconds(activeAnimations),
    [activeAnimations],
  );
  useEffect(() => {
    if (!animationPlaying || activeAnimations.length === 0) return;
    let frame = 0;
    const startedAt = performance.now() - animationTimeRef.current * 1000;
    const tick = (now: number) => {
      const nextTime = ((now - startedAt) / 1000) % animationDuration;
      animationTimeRef.current = nextTime;
      setAnimationTime(nextTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animationPlaying, activeAnimations.length, animationDuration]);
  const animatedSlotStyles = useMemo(() => {
    const result: Record<string, EnterExitStyle> = {};
    for (const slot of slots) {
      const overrideAnimation = scene.templateOverrides?.[slot.id]?.animation;
      const animation = overrideAnimation === null ? undefined : overrideAnimation ?? slot.animation;
      if (animation) result[slot.id] = slotStyleAtTime(animation, animationTime);
    }
    return result;
  }, [slots, scene.templateOverrides, animationTime]);
  const additionalStyleById = useMemo(() => {
    const result: Record<string, EnterExitStyle> = {};
    for (const element of elements) {
      if (element.animation) result[element.id] = slotStyleAtTime(element.animation, animationTime);
    }
    return result;
  }, [elements, animationTime]);
  const styleById = useMemo(
    () => buildSceneSlotStyles(slots, scene.templateOverrides, animatedSlotStyles),
    [slots, scene.templateOverrides, animatedSlotStyles],
  );

  const refreshHistoryControls = () => setHistoryStatus({
    canUndo: historyRef.current.past.length > 0,
    canRedo: historyRef.current.future.length > 0,
  });
  const pushHistory = () => {
    const history = historyRef.current;
    history.past = [...history.past, cloneSnapshot(currentSnapshotRef.current)].slice(-HISTORY_LIMIT);
    history.future = [];
    refreshHistoryControls();
  };
  const applySnapshot = (snapshot: SceneEditorSnapshot) => {
    const next = cloneSnapshot(snapshot);
    const slotIds = new Set([
      ...Object.keys(currentSnapshotRef.current.overrides),
      ...Object.keys(next.overrides),
    ]);
    for (const slotId of slotIds) onChange(slotId, next.overrides[slotId]);
    onElementsChange(next.elements);
    const selectedElementExists = next.selectedKey.startsWith('element:')
      && next.elements.some((element) => element.id === next.selectedKey.slice(8));
    const selectedSlotExists = next.selectedKey.startsWith('slot:')
      && slots.some((slot) => slot.id === next.selectedKey.slice(5));
    const nextSelectedKey = selectedElementExists || selectedSlotExists
      ? next.selectedKey
      : slots[0]
        ? `slot:${slots[0].id}`
        : next.elements[0]
          ? `element:${next.elements[0].id}`
          : '';
    currentSnapshotRef.current = { ...next, selectedKey: nextSelectedKey };
    setSelectedKey(nextSelectedKey);
  };
  const undo = () => {
    const history = historyRef.current;
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    history.past = history.past.slice(0, -1);
    history.future = [cloneSnapshot(currentSnapshotRef.current), ...history.future].slice(0, HISTORY_LIMIT);
    applySnapshot(previous);
    setActionMessage('Alteração desfeita');
    refreshHistoryControls();
  };
  const redo = () => {
    const history = historyRef.current;
    const next = history.future[0];
    if (!next) return;
    history.future = history.future.slice(1);
    history.past = [...history.past, cloneSnapshot(currentSnapshotRef.current)].slice(-HISTORY_LIMIT);
    applySnapshot(next);
    setActionMessage('Alteração refeita');
    refreshHistoryControls();
  };
  const commitSlotChange = (
    slotId: string,
    nextOverride: SceneTemplateSlotOverride | undefined,
  ) => {
    pushHistory();
    const overrides = { ...currentSnapshotRef.current.overrides };
    if (nextOverride && Object.keys(nextOverride).length > 0) overrides[slotId] = nextOverride;
    else delete overrides[slotId];
    currentSnapshotRef.current = { ...currentSnapshotRef.current, overrides };
    onChange(slotId, nextOverride);
  };
  const commitElementsChange = (nextElements: SceneTemplateElement[]) => {
    pushHistory();
    currentSnapshotRef.current = {
      ...currentSnapshotRef.current,
      elements: nextElements,
    };
    onElementsChange(nextElements);
  };
  const patchSlot = (changes: Partial<SceneTemplateSlotOverride>) => {
    if (selectedSlot) commitSlotChange(selectedSlot.id, { ...override, ...changes });
  };
  const patchElement = (changes: Partial<SceneTemplateElement>) => {
    if (!selectedElement) return;
    const normalized = 'rotation' in changes
      ? { ...changes, sourceTransform: undefined }
      : changes;
    commitElementsChange(elements.map((element) => (
      element.id === selectedElement.id ? { ...element, ...normalized } : element
    )));
  };
  const addElements = (next: SceneTemplateElement[]) => {
    commitElementsChange([...elements, ...next]);
    const last = next[next.length - 1];
    if (last) setSelectedKey(`element:${last.id}`);
    setActionMessage(`${next.length} elemento${next.length === 1 ? '' : 's'} adicionado${next.length === 1 ? '' : 's'}`);
  };
  const addElement = (type: SceneTemplateElementType) => {
    addElements([createElement(type, dimensions.width, dimensions.height, elements.length)]);
  };
  const removeElement = () => {
    if (!selectedElement) return;
    commitElementsChange(
      elements
        .filter((element) => element.id !== selectedElement.id)
        .map((element) => (
          element.maskElementId === selectedElement.id
            ? { ...element, maskElementId: undefined }
            : element
        )),
    );
    setActionMessage(`${selectedElement.name} excluído`);
    setSelectedKey(slots[0] ? `slot:${slots[0].id}` : '');
  };
  const duplicateElementById = (elementId: string) => {
    const source = elements.find((element) => element.id === elementId);
    if (!source) return;
    const copy: SceneTemplateElement = {
      ...source,
      id: createId(),
      name: `${source.name} cópia`,
    };
    const sourceIndex = elements.findIndex((element) => element.id === elementId);
    const next = [...elements];
    next.splice(sourceIndex + 1, 0, copy);
    commitElementsChange(next);
    setSelectedKey(`element:${copy.id}`);
    setActionMessage(`${source.name} duplicado na mesma posição`);
  };
  const duplicateElement = () => {
    if (selectedElement) duplicateElementById(selectedElement.id);
  };
  const duplicateSlot = () => {
    if (!selectedSlot) return;
    const content = contents.find((item) => item.id === selectedSlot.id);
    const composed = renderTemplate(markup, contents, { styleById });
    const composedDocument = new DOMParser().parseFromString(composed, 'image/svg+xml');
    const renderedRoot = Array.from(
      composedDocument.querySelectorAll('[data-rendered-slot-id]'),
    ).find((element) => element.getAttribute('data-rendered-slot-id') === selectedSlot.id);
    const renderedElement = renderedRoot?.localName === 'g'
      ? renderedRoot.querySelector('text, image, svg, rect, ellipse, path')
      : renderedRoot;
    const inspectionId = `duplicate-source-${selectedSlot.id}`;
    renderedElement?.setAttribute('id', inspectionId);
    const renderedMarkup = new XMLSerializer().serializeToString(composedDocument.documentElement);
    const source =
      getSvgElementProperties(renderedMarkup, inspectionId)
      ?? getSvgElementProperties(markup, selectedSlot.id);
    const defaultWidth = dimensions.width * (selectedSlot.type === 'icon' ? 0.08 : 0.34);
    const defaultHeight = dimensions.height * (selectedSlot.type === 'text' ? 0.09 : 0.2);
    const scale = override.scale ?? 1;
    const width = ((source?.width ?? selectedSlot.bounds.width) || defaultWidth) * scale;
    const height = ((source?.height ?? selectedSlot.bounds.height) || defaultHeight) * scale;
    const fontSize = override.fontSize ?? source?.fontSize;
    const base = {
      id: createId(),
      type: selectedSlot.type,
      name: `${selectedSlot.name} cópia`,
      x: (source?.x ?? selectedSlot.bounds.x) + (override.translateX ?? 0),
      y: (source?.y ?? selectedSlot.bounds.y) + (override.translateY ?? 0),
      width,
      height,
      fill: override.fill ?? source?.fill,
      fontFamily: override.fontFamily ?? source?.fontFamily,
      fontSize: fontSize == null ? undefined : fontSize * scale,
      fontWeight: override.fontWeight ?? source?.fontWeight,
      fontStyle: source?.fontStyle,
      letterSpacing: source?.letterSpacing,
      textDecoration: source?.textDecoration,
      textAlign: (source?.textAnchor === 'middle' || source?.textAnchor === 'end'
        ? source.textAnchor
        : 'start') as SceneTemplateElement['textAlign'],
      opacity: override.opacity ?? source?.opacity,
      rotation: override.rotation ?? source?.rotation,
      sourceTransform:
        override.translateX || override.translateY || override.scale || override.rotation
          ? undefined
          : source?.transform || undefined,
      stroke: source?.stroke === 'none' ? undefined : source?.stroke,
      strokeWidth: source?.strokeWidth || undefined,
      borderRadius: source?.borderRadius || undefined,
      animation: override.animation ?? selectedSlot.animation,
    } satisfies SceneTemplateElement;
    const copy: SceneTemplateElement = content?.type === 'text'
      ? {
          ...base,
          type: 'text',
          text: content.value,
          textPositionMode: source?.tagName === 'text' ? 'baseline' : 'box',
        }
      : content?.type === 'image'
        ? { ...base, type: 'image', imageHref: content.href, imageFit: content.fit }
        : {
            ...base,
            type: 'icon',
            iconSvg: content?.type === 'icon' ? content.svg : override.iconSvg ?? ICON_PRESETS.estrela,
          };
    addElements([copy]);
    setActionMessage(`${selectedSlot.name} duplicado com aparência preservada`);
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
    commitElementsChange(next);
    setActionMessage(`Camada ${element.name} reorganizada`);
  };
  const toggleElementVisibility = (elementId: string) => {
    commitElementsChange(elements.map((element) => (
      element.id === elementId ? { ...element, hidden: !element.hidden } : element
    )));
  };

  useEffect(() => {
    const handleEditorShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (command && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (target?.closest('input, textarea, select')) return;

      if (command && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        if (selectedElement) duplicateElement();
        else if (selectedSlot) duplicateSlot();
        return;
      }
      if (selectedElement && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        removeElement();
        return;
      }
      if (selectedElement && (event.key === '[' || event.key === ']')) {
        event.preventDefault();
        moveElement(selectedElement.id, event.key === ']' ? 'forward' : 'backward');
        return;
      }
      if (selectedElement && event.key.startsWith('Arrow')) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        patchElement({
          x: selectedElement.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
          y: selectedElement.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0),
        });
      }
    };
    window.addEventListener('keydown', handleEditorShortcut);
    return () => window.removeEventListener('keydown', handleEditorShortcut);
    // The handler must refresh whenever the current editor snapshot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElement, selectedSlot, elements, override, contents]);

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
  const normalizedLayerQuery = layerQuery.trim().toLocaleLowerCase('pt-BR');
  const visibleLayerEntries = [...elements]
    .reverse()
    .filter((element) => (
      !normalizedLayerQuery
      || element.name.toLocaleLowerCase('pt-BR').includes(normalizedLayerQuery)
      || element.type.toLocaleLowerCase('pt-BR').includes(normalizedLayerQuery)
    ));
  const alignSelection = (
    horizontal?: 'left' | 'center' | 'right',
    vertical?: 'top' | 'middle' | 'bottom',
  ) => {
    if (selectedElement) {
      const x = horizontal === 'left'
        ? 0
        : horizontal === 'center'
          ? (dimensions.width - selectedElement.width) / 2
          : horizontal === 'right'
            ? dimensions.width - selectedElement.width
            : selectedElement.x;
      const y = vertical === 'top'
        ? 0
        : vertical === 'middle'
          ? (dimensions.height - selectedElement.height) / 2
          : vertical === 'bottom'
            ? dimensions.height - selectedElement.height
            : selectedElement.y;
      patchElement({ x: Math.round(x), y: Math.round(y) });
      setActionMessage(`${selectedElement.name} alinhado ao quadro`);
      return;
    }
    if (selectedSlot) {
      const scale = override.scale ?? 1;
      const width = selectedSlot.bounds.width * scale;
      const height = selectedSlot.bounds.height * scale;
      const targetX = horizontal === 'left'
        ? 0
        : horizontal === 'center'
          ? (dimensions.width - width) / 2
          : horizontal === 'right'
            ? dimensions.width - width
            : selectedSlot.bounds.x + (override.translateX ?? 0);
      const targetY = vertical === 'top'
        ? 0
        : vertical === 'middle'
          ? (dimensions.height - height) / 2
          : vertical === 'bottom'
            ? dimensions.height - height
            : selectedSlot.bounds.y + (override.translateY ?? 0);
      patchSlot({
        translateX: Math.round(targetX - selectedSlot.bounds.x),
        translateY: Math.round(targetY - selectedSlot.bounds.y),
      });
      setActionMessage(`${selectedSlot.name} alinhado ao quadro`);
    }
  };

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
        historyRecorded: false,
      };
    } else {
      const current = scene.templateOverrides?.[slotId] ?? {};
      dragRef.current = {
        key,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: current.translateX ?? 0,
        startY: current.translateY ?? 0,
        historyRecorded: false,
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
    if (!drag.historyRecorded && (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01)) {
      pushHistory();
      drag.historyRecorded = true;
    }

    if (drag.key.startsWith('element:')) {
      const id = drag.key.slice(8);
      const nextElements = elements.map((element) => (
        element.id === id
          ? { ...element, x: Math.round(drag.startX + dx), y: Math.round(drag.startY + dy) }
          : element
      ));
      currentSnapshotRef.current = {
        ...currentSnapshotRef.current,
        elements: nextElements,
      };
      onElementsChange(nextElements);
    } else {
      const id = drag.key.slice(5);
      const current = scene.templateOverrides?.[id] ?? {};
      const nextOverride = {
        ...current,
        translateX: Math.round(drag.startX + dx),
        translateY: Math.round(drag.startY + dy),
      };
      currentSnapshotRef.current = {
        ...currentSnapshotRef.current,
        overrides: {
          ...currentSnapshotRef.current.overrides,
          [id]: nextOverride,
        },
      };
      onChange(id, nextOverride);
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
          <div className="scene-template-library-group">
            <strong>Elementos</strong>
            <button type="button" aria-label="Adicionar texto" onClick={() => addElement('text')}><b aria-hidden="true">T</b><span>Texto</span></button>
            <button type="button" aria-label="Adicionar imagem" onClick={() => addElement('image')}><b aria-hidden="true">IMG</b><span>Imagem</span></button>
            <button type="button" aria-label="Adicionar ícone" onClick={() => addElement('icon')}><b aria-hidden="true">ICO</b><span>Ícone</span></button>
            <button type="button" aria-label="Adicionar forma" onClick={() => addElement('shape')}><b aria-hidden="true">SHP</b><span>Forma</span></button>
          </div>
          <div className="scene-template-library-group scene-template-library-presets">
            <strong>Blocos prontos</strong>
            <button type="button" onClick={() => addElements(presetElements('title', dimensions.width, dimensions.height))}>Título central</button>
            <button type="button" onClick={() => addElements(presetElements('lower-third', dimensions.width, dimensions.height))}>Lower third</button>
            <button type="button" onClick={() => addElements(presetElements('badge', dimensions.width, dimensions.height))}>Selo</button>
            <button type="button" onClick={() => addElements(presetElements('image-card', dimensions.width, dimensions.height, scene.imageUrl))}>Card de imagem</button>
          </div>
        </div>

        <div className="scene-template-editor-body">
          <aside className="scene-template-slot-list">
            <div className="scene-template-panel-head">
              <div>
                <strong>Camadas</strong>
                <span>{elements.length} da cena, {slots.length} do modelo</span>
              </div>
              <label className="scene-template-layer-search">
                <span className="sr-only">Buscar camadas da cena</span>
                <input
                  value={layerQuery}
                  placeholder="Buscar camada"
                  onChange={(event) => setLayerQuery(event.target.value)}
                />
              </label>
            </div>
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
            {visibleLayerEntries.map((element) => {
              const reversedIndex = elements.length - 1 - elements.findIndex((item) => item.id === element.id);
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
                  <span><i className={`scene-template-layer-type type-${element.type}`}>{element.type.slice(0, 1).toUpperCase()}</i>{element.name}</span>
                  <small>camada {index + 1} · {element.type}</small>
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
            {elements.length > 0 && visibleLayerEntries.length === 0 && (
              <div className="scene-template-layer-empty">Nenhuma camada encontrada.</div>
            )}
          </aside>

          <main
            className="scene-template-preview"
            onPointerDown={handlePreviewPointerDown}
            onPointerMove={handlePreviewPointerMove}
            onPointerUp={handlePreviewPointerUp}
            onPointerCancel={handlePreviewPointerUp}
          >
            <div className="scene-template-canvas-toolbar" onPointerDown={(event) => event.stopPropagation()}>
              <span>{selectedSlot?.name ?? selectedElement?.name ?? 'Nenhum elemento selecionado'}</span>
              <div>
                <button
                  type="button"
                  aria-pressed={showGuides}
                  onClick={() => setShowGuides((visible) => !visible)}
                >
                  Guias
                </button>
                <select
                  aria-label="Tipo de guia"
                  value={guideMode}
                  disabled={!showGuides}
                  onChange={(event) => setGuideMode(event.target.value as typeof guideMode)}
                >
                  <option value="center">Centro</option>
                  <option value="thirds">Terços</option>
                  <option value="grid">Grade</option>
                </select>
                <select
                  aria-label="Área segura de vídeo"
                  value={safeAreaMode}
                  onChange={(event) => setSafeAreaMode(event.target.value as typeof safeAreaMode)}
                >
                  <option value="off">Área segura: off</option>
                  <option value="action">Ação 90%</option>
                  <option value="title">Título 80%</option>
                  <option value="both">Ação + título</option>
                </select>
                {activeAnimations.length > 0 && (
                  <button
                    type="button"
                    aria-label={animationPlaying ? 'Pausar animações' : 'Reproduzir animações'}
                    onClick={() => setAnimationPlaying((playing) => !playing)}
                  >
                    {animationPlaying ? 'Pausar' : 'Reproduzir'}
                  </button>
                )}
                <button type="button" aria-label="Reduzir zoom" disabled={canvasZoom <= 50} onClick={() => setCanvasZoom((zoom) => Math.max(50, zoom - 25))}>-</button>
                <output aria-label="Zoom do canvas">{canvasZoom}%</output>
                <button type="button" aria-label="Aumentar zoom" disabled={canvasZoom >= 200} onClick={() => setCanvasZoom((zoom) => Math.min(200, zoom + 25))}>+</button>
                <button type="button" onClick={() => setCanvasZoom(100)}>Ajustar</button>
              </div>
            </div>
            <div
              className="scene-template-canvas"
              style={{ width: `${canvasZoom}%`, maxWidth: `${canvasZoom * 7.6}px` }}
            >
              <TemplateRenderer
                markup={markup}
                contents={contents}
                options={{
                  styleById,
                  additionalElements: elements,
                  additionalStyleById,
                }}
                className="scene-template-preview-document"
              />
              {showGuides && (
                <div className={`scene-template-guides guide-${guideMode}`} aria-hidden="true">
                  <i className="guide-v guide-v-1" />
                  <i className="guide-v guide-v-2" />
                  <i className="guide-h guide-h-1" />
                  <i className="guide-h guide-h-2" />
                </div>
              )}
              {safeAreaMode !== 'off' && (
                <div className="scene-template-safe-areas" aria-hidden="true">
                  {(safeAreaMode === 'action' || safeAreaMode === 'both') && (
                    <i className="safe-action"><span>Ação 90%</span></i>
                  )}
                  {(safeAreaMode === 'title' || safeAreaMode === 'both') && (
                    <i className="safe-title"><span>Título 80%</span></i>
                  )}
                </div>
              )}
            </div>
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
                      <button type="button" onClick={() => commitSlotChange(selectedSlot.id, undefined)}>Restaurar</button>
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
                                commitElementsChange(elements.map((element) => {
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
                  <div className="scene-template-align-tools" aria-label="Alinhar ao quadro">
                    <button type="button" onClick={() => alignSelection('left')}>Esquerda</button>
                    <button type="button" onClick={() => alignSelection('center')}>Centro H</button>
                    <button type="button" onClick={() => alignSelection('right')}>Direita</button>
                    <button type="button" onClick={() => alignSelection(undefined, 'top')}>Topo</button>
                    <button type="button" onClick={() => alignSelection(undefined, 'middle')}>Centro V</button>
                    <button type="button" onClick={() => alignSelection(undefined, 'bottom')}>Base</button>
                  </div>
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
                    allowKenBurns={selectedType === 'image'}
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
          <div className="scene-template-editor-status" aria-live="polite">
            <span>{actionMessage}</span>
            <small><kbd>Ctrl Z</kbd> desfazer <kbd>Ctrl Shift Z</kbd> refazer <kbd>Ctrl D</kbd> duplicar <kbd>Setas</kbd> mover</small>
          </div>
          <div className="scene-template-history-actions">
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="Desfazer edição da cena"
              disabled={!historyStatus.canUndo}
              onClick={undo}
            >
              Desfazer
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="Refazer edição da cena"
              disabled={!historyStatus.canRedo}
              onClick={redo}
            >
              Refazer
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              pushHistory();
              applySnapshot({
                overrides: {},
                elements: [],
                selectedKey: slots[0] ? `slot:${slots[0].id}` : '',
              });
              setActionMessage('Cena restaurada');
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
