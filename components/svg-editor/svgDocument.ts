import type { SvgElementProperties, SvgLayer, SlotType, TemplateSlot, TemplateSlotMeta } from './types';
import type { SlotAnimation } from './slotAnimation';

const SVG_NS = 'http://www.w3.org/2000/svg';

const ALLOWED_ELEMENTS = new Set([
  // estrutura
  'svg', 'g', 'defs', 'symbol', 'use',
  // formas
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  // texto
  'text', 'tspan', 'textPath',
  // imagem embutida (href data:image/* ou #ref)
  'image',
  // pintura: gradientes e padrões
  'linearGradient', 'radialGradient', 'stop', 'pattern',
  // recorte / máscara / marcadores
  'clipPath', 'mask', 'marker',
  // filtros e suas primitivas (efeitos)
  'filter',
  'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feFlood',
  'feComposite', 'feMerge', 'feMergeNode', 'feDropShadow', 'feMorphology',
  'feTile', 'feTurbulence', 'feDisplacementMap', 'feComponentTransfer',
  'feFuncR', 'feFuncG', 'feFuncB', 'feFuncA', 'feConvolveMatrix',
  'feSpecularLighting', 'feDiffuseLighting', 'feDistantLight',
  'fePointLight', 'feSpotLight', 'feImage',
]);

const EDITABLE_ELEMENTS = new Set([
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'image',
]);

const ALLOWED_ATTRIBUTES = new Set([
  'id',
  'viewBox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'transform',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'opacity',
  'display',
  'visibility',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'clip-path',
  'mask',
  'filter',
  'result',
  'in',
  'in2',
  'stdDeviation',
  'dx',
  'dy',
  'mode',
  'values',
  'type',
  // ── pintura / cor / blend ──
  'color', 'paint-order', 'flood-color', 'flood-opacity', 'lighting-color',
  'color-interpolation', 'color-interpolation-filters', 'mix-blend-mode',
  'isolation', 'clip-rule', 'shape-rendering', 'image-rendering', 'overflow',
  'vector-effect',
  // ── contorno ──
  'stroke-miterlimit', 'stroke-dashoffset',
  // ── texto ──
  'font-style', 'font-variant', 'font-stretch', 'letter-spacing', 'word-spacing',
  'text-decoration', 'writing-mode', 'text-rendering', 'baseline-shift',
  'alignment-baseline', 'rotate', 'textLength', 'lengthAdjust', 'startOffset',
  'side', 'method', 'spacing', 'white-space',
  // ── geometria / estrutura ──
  'pathLength', 'preserveAspectRatio', 'refX', 'refY', 'fx', 'fy', 'fr',
  // ── marcadores ──
  'marker-start', 'marker-mid', 'marker-end', 'marker',
  'markerWidth', 'markerHeight', 'markerUnits', 'orient',
  // ── recorte / máscara / padrão ──
  'clipPathUnits', 'maskUnits', 'maskContentUnits',
  'patternUnits', 'patternContentUnits', 'patternTransform',
  // ── filtros ──
  'filterUnits', 'primitiveUnits', 'operator', 'k1', 'k2', 'k3', 'k4', 'scale',
  'xChannelSelector', 'yChannelSelector', 'radius', 'numOctaves', 'baseFrequency',
  'seed', 'stitchTiles', 'tableValues', 'slope', 'intercept', 'amplitude',
  'exponent', 'surfaceScale', 'specularConstant', 'specularExponent',
  'diffuseConstant', 'kernelMatrix', 'order', 'divisor', 'bias', 'targetX',
  'targetY', 'edgeMode', 'preserveAlpha', 'kernelUnitLength', 'azimuth',
  'elevation', 'pointsAtX', 'pointsAtY', 'pointsAtZ', 'limitingConeAngle', 'z',
  // Marca um elemento como espaço parametrizável de um modelo de cena.
  // Conteúdo: JSON { type, name }. Tratado como texto comum (não-URL) pelo
  // sanitizer, então sobrevive ao round-trip de import/export.
  'data-slot',
]);

const URL_ATTRIBUTES = new Set([
  'fill', 'stroke', 'clip-path', 'mask', 'filter',
  'marker-start', 'marker-mid', 'marker-end', 'marker',
]);
const ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const INTERNAL_REF = /^#[A-Za-z_][\w.:-]*$/;

// href/xlink:href: só referência interna (#id) ou imagem RASTER embutida.
// Bloqueia javascript:, data:text/html, URLs externas (privacidade/SSRF) e
// data:image/svg+xml — este último seria o vetor "SVG-em-data-URI" em <use>/feImage.
const sanitizeHref = (value: string): string | null => {
  const v = value.trim();
  if (INTERNAL_REF.test(v)) return v;
  if (/^data:image\/(png|jpe?g|gif|webp|bmp);/i.test(v)) return v;
  return null;
};

// style inline: mantém propriedades de apresentação (fill, filter, blend, etc.),
// mas rejeita o atributo inteiro se houver token perigoso ou url() não-interna.
const STYLE_BLOCKLIST = /expression\(|javascript:|behaviou?r\s*:|-moz-binding|@import|<\/|url\(\s*['"]?\s*(?!#)/i;
const sanitizeStyle = (value: string): string | null => {
  if (STYLE_BLOCKLIST.test(value)) return null;
  const trimmed = value.trim();
  return trimmed || null;
};

let idCounter = 0;

export const createSvgId = (prefix = 'shape'): string => {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
};

const parseSvg = (markup: string): XMLDocument => {
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') {
    throw new Error('O arquivo não contém um SVG válido.');
  }
  return document;
};

const isSafeAttributeValue = (name: string, value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('javascript:') || normalized.includes('data:text/html')) return false;
  if (URL_ATTRIBUTES.has(name) && normalized.includes('url(')) {
    return /^url\(\s*#[A-Za-z_][A-Za-z0-9_.:-]*\s*\)$/.test(value.trim());
  }
  return true;
};

const copySafeElement = (
  source: Element,
  targetDocument: XMLDocument,
  usedIds: Set<string>,
): Element | null => {
  if (!ALLOWED_ELEMENTS.has(source.localName)) return null;

  const target = targetDocument.createElementNS(SVG_NS, source.localName);
  for (const attribute of Array.from(source.attributes)) {
    const name = attribute.name;

    // Handlers de evento (onload, onclick, …) são sempre removidos.
    if (name.toLowerCase().startsWith('on')) continue;

    // style: mantém apresentação segura; descarta se tiver token perigoso.
    if (name === 'style') {
      const safe = sanitizeStyle(attribute.value);
      if (safe) target.setAttribute('style', safe);
      continue;
    }

    // href / xlink:href: só #id interno ou data:image/* (normaliza para `href`).
    if (name === 'href' || name === 'xlink:href') {
      const safe = sanitizeHref(attribute.value);
      if (safe) target.setAttribute('href', safe);
      continue;
    }

    if (!ALLOWED_ATTRIBUTES.has(name) || !isSafeAttributeValue(name, attribute.value)) continue;

    if (name === 'id') {
      if (!ID_PATTERN.test(attribute.value) || usedIds.has(attribute.value)) continue;
      usedIds.add(attribute.value);
    }
    target.setAttribute(name, attribute.value);
  }

  if (EDITABLE_ELEMENTS.has(source.localName) && !target.id) {
    const id = createSvgId(source.localName);
    usedIds.add(id);
    target.setAttribute('id', id);
  }

  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const copied = copySafeElement(child as Element, targetDocument, usedIds);
      if (copied) target.appendChild(copied);
    } else if (child.nodeType === Node.TEXT_NODE && ['text', 'tspan', 'textPath'].includes(source.localName)) {
      target.appendChild(targetDocument.createTextNode(child.textContent ?? ''));
    }
  }
  return target;
};

export const sanitizeSvg = (markup: string): string => {
  const sourceDocument = parseSvg(markup);
  const targetDocument = document.implementation.createDocument(SVG_NS, 'svg', null);
  const sanitized = copySafeElement(
    sourceDocument.documentElement,
    targetDocument,
    new Set<string>(),
  );
  if (!sanitized) throw new Error('O SVG não possui conteúdo compatível.');

  targetDocument.replaceChild(sanitized, targetDocument.documentElement);
  if (!sanitized.getAttribute('viewBox')) {
    const width = Number.parseFloat(sanitized.getAttribute('width') || '800') || 800;
    const height = Number.parseFloat(sanitized.getAttribute('height') || '600') || 600;
    sanitized.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  sanitized.setAttribute('width', '100%');
  sanitized.setAttribute('height', '100%');
  return new XMLSerializer().serializeToString(sanitized);
};

// Proporções de quadro do modelo. Default 16:9 (alinhado ao vídeo do storyboard).
export const SVG_ASPECT_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '16:9', width: 1280, height: 720 },
  { label: '9:16', width: 720, height: 1280 },
  { label: '1:1', width: 1080, height: 1080 },
  { label: '4:5', width: 1080, height: 1350 },
  { label: '4:3', width: 1200, height: 900 },
];

export const createBlankSvg = (width = 1280, height = 720): string =>
  sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"></svg>`,
  );

const serialize = (document: XMLDocument): string =>
  new XMLSerializer().serializeToString(document.documentElement);

/** Redefine o quadro (viewBox) do modelo para a proporção desejada (16:9, 9:16…). */
export const setViewBox = (markup: string, width: number, height: number): string => {
  const document = parseSvg(markup);
  const root = document.documentElement;
  root.setAttribute('viewBox', `0 0 ${Math.round(width)} ${Math.round(height)}`);
  root.setAttribute('width', '100%');
  root.setAttribute('height', '100%');
  return serialize(document);
};

/** Rótulo da proporção mais próxima do viewBox atual, ou 'Personalizado'. */
export const aspectLabelFor = (width: number, height: number): string => {
  if (!width || !height) return 'Personalizado';
  const ratio = width / height;
  const match = SVG_ASPECT_PRESETS.find(
    (preset) => Math.abs(preset.width / preset.height - ratio) < 0.02,
  );
  return match ? match.label : 'Personalizado';
};

export const getSvgElementProperties = (
  markup: string,
  id: string,
): SvgElementProperties | null => {
  const element = parseSvg(markup).getElementById(id);
  if (!element) return null;
  const bounds = getElementAttributeBounds(element);
  return {
    id,
    tagName: element.localName,
    fill: element.getAttribute('fill') || 'none',
    stroke: element.getAttribute('stroke') || 'none',
    strokeWidth: Number.parseFloat(element.getAttribute('stroke-width') || '0'),
    strokeDasharray: element.getAttribute('stroke-dasharray') || '',
    opacity: Number.parseFloat(element.getAttribute('opacity') || '1'),
    text: element.textContent || '',
    ...bounds,
  };
};

const numberAttribute = (element: Element, name: string): number =>
  Number.parseFloat(element.getAttribute(name) || '0') || 0;

const getElementAttributeBounds = (
  element: Element,
): Pick<SvgElementProperties, 'x' | 'y' | 'width' | 'height'> => {
  if (element.localName === 'rect') {
    return {
      x: numberAttribute(element, 'x'),
      y: numberAttribute(element, 'y'),
      width: numberAttribute(element, 'width'),
      height: numberAttribute(element, 'height'),
    };
  }
  if (element.localName === 'ellipse' || element.localName === 'circle') {
    const rx = numberAttribute(element, element.localName === 'circle' ? 'r' : 'rx');
    const ry = numberAttribute(element, element.localName === 'circle' ? 'r' : 'ry');
    return {
      x: numberAttribute(element, 'cx') - rx,
      y: numberAttribute(element, 'cy') - ry,
      width: rx * 2,
      height: ry * 2,
    };
  }
  if (element.localName === 'line') {
    const x1 = numberAttribute(element, 'x1');
    const y1 = numberAttribute(element, 'y1');
    const x2 = numberAttribute(element, 'x2');
    const y2 = numberAttribute(element, 'y2');
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }
  if (element.localName === 'text') {
    return {
      x: numberAttribute(element, 'x'),
      y: numberAttribute(element, 'y'),
      width: null,
      height: null,
    };
  }
  return { x: null, y: null, width: null, height: null };
};

export const updateSvgElement = (
  markup: string,
  id: string,
  attributes: Record<string, string | number | null>,
): string => {
  const document = parseSvg(markup);
  const element = document.getElementById(id);
  if (!element) return markup;
  for (const [name, value] of Object.entries(attributes)) {
    if (!ALLOWED_ATTRIBUTES.has(name)) continue;
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, String(value));
  }
  return serialize(document);
};

export const appendSvgElement = (
  markup: string,
  tagName: 'rect' | 'ellipse' | 'line' | 'path' | 'text',
  attributes: Record<string, string | number>,
  textContent?: string,
): { markup: string; id: string } => {
  const document = parseSvg(markup);
  const element = document.createElementNS(SVG_NS, tagName);
  const id = createSvgId(tagName);
  element.setAttribute('id', id);
  for (const [name, value] of Object.entries(attributes)) {
    if (ALLOWED_ATTRIBUTES.has(name)) element.setAttribute(name, String(value));
  }
  if (tagName === 'text') element.textContent = textContent || 'Texto';
  document.documentElement.appendChild(element);
  return { markup: serialize(document), id };
};

export const updateSvgText = (markup: string, id: string, text: string): string => {
  const document = parseSvg(markup);
  const element = document.getElementById(id);
  if (!element || element.localName !== 'text') return markup;
  element.textContent = text;
  return serialize(document);
};

export const listSvgLayers = (markup: string): SvgLayer[] => {
  const document = parseSvg(markup);
  return Array.from(document.documentElement.children)
    .filter((element) => EDITABLE_ELEMENTS.has(element.localName) && element.id)
    .reverse()
    .map((element) => ({
      id: element.id,
      tagName: element.localName,
      label:
        element.localName === 'text'
          ? element.textContent?.trim() || 'Texto'
          : {
              rect: 'Retângulo',
              ellipse: 'Elipse',
              circle: 'Círculo',
              line: 'Linha',
              path: 'Path',
              g: 'Grupo',
              polygon: 'Polígono',
              polyline: 'Polilinha',
            }[element.localName] || element.localName,
    }));
};

export const reorderSvgElement = (
  markup: string,
  id: string,
  direction: 'front' | 'back',
): string => {
  const document = parseSvg(markup);
  const element = document.getElementById(id);
  const parent = element?.parentElement;
  if (!element || !parent) return markup;
  if (direction === 'front') parent.appendChild(element);
  else parent.insertBefore(element, parent.firstChild);
  return serialize(document);
};

export const resizeSvgElement = (
  markup: string,
  id: string,
  bounds: { x: number; y: number; width: number; height: number },
): string => {
  const document = parseSvg(markup);
  const element = document.getElementById(id);
  if (!element) return markup;
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  if (element.localName === 'rect') {
    element.setAttribute('x', String(bounds.x));
    element.setAttribute('y', String(bounds.y));
    element.setAttribute('width', String(width));
    element.setAttribute('height', String(height));
  } else if (element.localName === 'ellipse') {
    element.setAttribute('cx', String(bounds.x + width / 2));
    element.setAttribute('cy', String(bounds.y + height / 2));
    element.setAttribute('rx', String(width / 2));
    element.setAttribute('ry', String(height / 2));
  } else if (element.localName === 'circle') {
    element.setAttribute('cx', String(bounds.x + width / 2));
    element.setAttribute('cy', String(bounds.y + height / 2));
    element.setAttribute('r', String(Math.min(width, height) / 2));
  } else if (element.localName === 'line') {
    element.setAttribute('x1', String(bounds.x));
    element.setAttribute('y1', String(bounds.y));
    element.setAttribute('x2', String(bounds.x + width));
    element.setAttribute('y2', String(bounds.y + height));
  } else if (element.localName === 'text') {
    element.setAttribute('x', String(bounds.x));
    element.setAttribute('y', String(bounds.y));
  } else {
    return markup;
  }
  return serialize(document);
};

export const removeSvgElement = (markup: string, id: string): string => {
  const document = parseSvg(markup);
  document.getElementById(id)?.remove();
  return serialize(document);
};

const assignFreshIds = (element: Element): void => {
  if (EDITABLE_ELEMENTS.has(element.localName)) {
    element.setAttribute('id', createSvgId(element.localName));
  }
  for (const child of Array.from(element.children)) assignFreshIds(child);
};

export const duplicateSvgElement = (
  markup: string,
  id: string,
): { markup: string; id: string | null } => {
  const document = parseSvg(markup);
  const source = document.getElementById(id);
  if (!source || !source.parentElement) return { markup, id: null };
  const clone = source.cloneNode(true) as Element;
  assignFreshIds(clone);
  const transform = clone.getAttribute('transform') || '';
  clone.setAttribute('transform', `translate(16 16) ${transform}`.trim());
  source.parentElement.appendChild(clone);
  return { markup: serialize(document), id: clone.id };
};

export const translateSvgElement = (markup: string, id: string, dx: number, dy: number): string => {
  const document = parseSvg(markup);
  const element = document.getElementById(id);
  if (!element) return markup;
  const transform = element.getAttribute('transform') || '';
  element.setAttribute('transform', `translate(${dx} ${dy}) ${transform}`.trim());
  return serialize(document);
};

// ── Slots de modelo de cena ──────────────────────────────────────────────────
// Um slot é um elemento comum do SVG marcado com `data-slot`. A geometria do
// slot é derivada do próprio elemento (mesmo cálculo das propriedades), então
// não há fonte de verdade duplicada: o markup é o template.

const SLOT_TYPES = new Set<SlotType>(['image', 'text', 'icon']);

const defaultSlotName = (type: SlotType): string =>
  ({ image: 'Imagem', text: 'Texto', icon: 'Ícone' }[type]);

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const parseAnimation = (raw: unknown): SlotAnimation | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Record<string, unknown>;
  if (typeof data.enter !== 'string' || typeof data.exit !== 'string') return undefined;
  return {
    enter: data.enter as SlotAnimation['enter'],
    exit: data.exit as SlotAnimation['exit'],
    startSeconds: numberOrUndefined(data.startSeconds),
    endSeconds: numberOrUndefined(data.endSeconds),
    enterDurationSeconds: numberOrUndefined(data.enterDurationSeconds),
    exitDurationSeconds: numberOrUndefined(data.exitDurationSeconds),
  };
};

const parseSlotMeta = (raw: string | null): TemplateSlotMeta | null => {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<TemplateSlotMeta>;
    if (!data || !data.type || !SLOT_TYPES.has(data.type)) return null;
    const name =
      typeof data.name === 'string' && data.name.trim()
        ? data.name.trim()
        : defaultSlotName(data.type);
    const animation = parseAnimation(data.animation);
    return animation ? { type: data.type, name, animation } : { type: data.type, name };
  } catch {
    return null;
  }
};

/** Marca o elemento `id` como slot (ou atualiza tipo/nome/animação de um slot existente). */
export const markSlot = (markup: string, id: string, meta: TemplateSlotMeta): string => {
  const document = parseSvg(markup);
  const element = document.getElementById(id);
  if (!element || !SLOT_TYPES.has(meta.type)) return markup;
  const name = (meta.name || '').trim().slice(0, 80) || defaultSlotName(meta.type);
  const payload: TemplateSlotMeta = { type: meta.type, name };
  if (meta.animation) payload.animation = meta.animation;
  element.setAttribute('data-slot', JSON.stringify(payload));
  return serialize(document);
};

/** Remove a marcação de slot do elemento `id` (volta a ser desenho comum). */
export const unmarkSlot = (markup: string, id: string): string => {
  const document = parseSvg(markup);
  document.getElementById(id)?.removeAttribute('data-slot');
  return serialize(document);
};

/** Metadados de slot do elemento `id`, ou null se ele não for um slot. */
export const getSlotMeta = (markup: string, id: string): TemplateSlotMeta | null => {
  const element = parseSvg(markup).getElementById(id);
  return element ? parseSlotMeta(element.getAttribute('data-slot')) : null;
};

/** Lista todos os slots do modelo, com geometria resolvida. */
export const listSlots = (markup: string): TemplateSlot[] => {
  const document = parseSvg(markup);
  const slots: TemplateSlot[] = [];
  document.documentElement.querySelectorAll('[data-slot]').forEach((element) => {
    const meta = parseSlotMeta(element.getAttribute('data-slot'));
    if (!meta || !element.id) return;
    const bounds = getElementAttributeBounds(element);
    slots.push({
      id: element.id,
      type: meta.type,
      name: meta.name,
      animation: meta.animation,
      bounds: {
        x: bounds.x ?? 0,
        y: bounds.y ?? 0,
        width: bounds.width ?? 0,
        height: bounds.height ?? 0,
      },
    });
  });
  return slots;
};

/** Dimensões do viewBox do SVG (largura/altura em unidades de usuário). */
export const parseViewBox = (markup: string): { width: number; height: number } | null => {
  try {
    const root = parseSvg(markup).documentElement;
    const parts = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { width: parts[2], height: parts[3] };
    }
  } catch {
    // markup inválido — sem viewBox
  }
  return null;
};
