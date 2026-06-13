import type { SceneTemplateElement } from '../../types';
import { sanitizeSvg } from './svgDocument';

// ── Renderizador de modelo (composição por substituição in-place) ────────────
// Pega o markup de um modelo (SVG sanitizado + slots marcados com data-slot) e
// substitui cada slot pelo seu conteúdo NO MESMO lugar do documento — o que
// preserva a ordem de pintura (z-order) automaticamente: o que estava atrás do
// slot continua atrás, o que estava na frente continua na frente.
//
// SEGURANÇA: a saída NÃO passa pelo sanitizer (ela contém <image href>, que o
// sanitizer remove de propósito). É seguro porque (a) o markup de entrada já é
// sanitizado, e (b) o conteúdo (URL de imagem, texto, ícone) é inserido via
// APIs de DOM com escape automático na serialização — nada de concatenar string
// crua em atributos.

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SlotImageContent {
  id: string;
  type: 'image';
  /** data URL, blob URL ou URL remota da imagem. */
  href: string;
  /** `cover` (preenche e corta) ou `contain` (cabe inteira). Default: cover. */
  fit?: 'cover' | 'contain';
}

export interface SlotTextContent {
  id: string;
  type: 'text';
  value: string;
  fill?: string;
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  align?: 'start' | 'middle' | 'end';
}

export interface SlotIconContent {
  id: string;
  type: 'icon';
  /** Markup `<svg>…</svg>` do ícone (será escalado para dentro do slot). */
  svg: string;
  fill?: string;
}

export type SlotContent = SlotImageContent | SlotTextContent | SlotIconContent;

const parse = (markup: string): XMLDocument => {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') {
    throw new Error('SVG inválido.');
  }
  return doc;
};

const serialize = (doc: XMLDocument): string =>
  new XMLSerializer().serializeToString(doc.documentElement);

const num = (el: Element, name: string): number =>
  Number.parseFloat(el.getAttribute(name) || '0') || 0;

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const boundsOf = (el: Element): Bounds => {
  switch (el.localName) {
    case 'rect':
      return { x: num(el, 'x'), y: num(el, 'y'), width: num(el, 'width'), height: num(el, 'height') };
    case 'circle': {
      const r = num(el, 'r');
      return { x: num(el, 'cx') - r, y: num(el, 'cy') - r, width: r * 2, height: r * 2 };
    }
    case 'ellipse': {
      const rx = num(el, 'rx');
      const ry = num(el, 'ry');
      return { x: num(el, 'cx') - rx, y: num(el, 'cy') - ry, width: rx * 2, height: ry * 2 };
    }
    case 'line': {
      const x1 = num(el, 'x1');
      const y1 = num(el, 'y1');
      const x2 = num(el, 'x2');
      const y2 = num(el, 'y2');
      return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
    }
    case 'text':
      return { x: num(el, 'x'), y: num(el, 'y'), width: 0, height: 0 };
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
};

let clipCounter = 0;

const ensureDefs = (doc: XMLDocument): Element => {
  const existing = doc.documentElement.querySelector('defs');
  if (existing) return existing;
  const defs = doc.createElementNS(SVG_NS, 'defs');
  doc.documentElement.insertBefore(defs, doc.documentElement.firstChild);
  return defs;
};

const buildImage = (doc: XMLDocument, slot: Element, content: SlotImageContent): Element => {
  const bounds = boundsOf(slot);
  const image = doc.createElementNS(SVG_NS, 'image');
  image.setAttribute('x', String(bounds.x));
  image.setAttribute('y', String(bounds.y));
  image.setAttribute('width', String(Math.max(0, bounds.width)));
  image.setAttribute('height', String(Math.max(0, bounds.height)));
  const safeHref = /^(data:image\/(?:png|jpe?g|gif|webp|bmp)[;,]|blob:|https?:)/i.test(
    content.href.trim(),
  )
    ? content.href
    : '';
  image.setAttribute('href', safeHref);
  image.setAttribute(
    'preserveAspectRatio',
    content.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice',
  );
  // Recorta a imagem pela forma original do slot (rect com rx, elipse, etc.).
  if (slot.localName !== 'line') {
    clipCounter += 1;
    const clipId = `slot-clip-${clipCounter}`;
    const clip = doc.createElementNS(SVG_NS, 'clipPath');
    clip.setAttribute('id', clipId);
    const shape = slot.cloneNode(true) as Element;
    shape.removeAttribute('id');
    shape.removeAttribute('data-slot');
    clip.appendChild(shape);
    ensureDefs(doc).appendChild(clip);
    image.setAttribute('clip-path', `url(#${clipId})`);
  }
  // Mantém um transform do slot (caso o usuário tenha movido a forma).
  const transform = slot.getAttribute('transform');
  if (transform) image.setAttribute('transform', transform);
  image.setAttribute('data-rendered-slot-id', content.id);
  return image;
};

const buildText = (doc: XMLDocument, slot: Element, content: SlotTextContent): Element => {
  // Slot que já é <text>: mantém posição/estilo e só troca o conteúdo.
  if (slot.localName === 'text') {
    const text = slot.cloneNode(false) as Element;
    text.removeAttribute('data-slot');
    if (content.fill) text.setAttribute('fill', content.fill);
    if (content.fontSize) text.setAttribute('font-size', String(content.fontSize));
    if (content.fontFamily) text.setAttribute('font-family', content.fontFamily);
    if (content.fontWeight) text.setAttribute('font-weight', String(content.fontWeight));
    text.textContent = content.value;
    text.setAttribute('data-rendered-slot-id', content.id);
    return text;
  }
  // Slot-forma (ex.: retângulo): cria um <text> centralizado nos limites.
  const bounds = boundsOf(slot);
  const fontSize =
    content.fontSize ??
    Math.max(
      8,
      Math.min(bounds.height * 0.5 || 16, (bounds.width * 1.6) / Math.max(1, content.value.length)),
    );
  const text = doc.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', String(bounds.x + bounds.width / 2));
  text.setAttribute('y', String(bounds.y + bounds.height / 2));
  text.setAttribute('text-anchor', content.align || 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('font-size', String(Math.round(fontSize)));
  text.setAttribute('fill', content.fill || '#111111');
  if (content.fontFamily) text.setAttribute('font-family', content.fontFamily);
  if (content.fontWeight) text.setAttribute('font-weight', String(content.fontWeight));
  const transform = slot.getAttribute('transform');
  if (transform) text.setAttribute('transform', transform);
  text.textContent = content.value;
  text.setAttribute('data-rendered-slot-id', content.id);
  return text;
};

const buildIcon = (doc: XMLDocument, slot: Element, content: SlotIconContent): Element | null => {
  let iconDoc: XMLDocument;
  try {
    iconDoc = parse(sanitizeSvg(content.svg));
  } catch {
    return null;
  }
  const bounds = boundsOf(slot);
  const viewBox = iconDoc.documentElement.getAttribute('viewBox') || '0 0 24 24';
  // <svg> aninhado escala o ícone (via viewBox) para dentro dos limites do slot.
  const nested = doc.createElementNS(SVG_NS, 'svg');
  nested.setAttribute('x', String(bounds.x));
  nested.setAttribute('y', String(bounds.y));
  nested.setAttribute('width', String(Math.max(0, bounds.width)));
  nested.setAttribute('height', String(Math.max(0, bounds.height)));
  nested.setAttribute('viewBox', viewBox);
  nested.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  if (content.fill) nested.setAttribute('color', content.fill);
  for (const child of Array.from(iconDoc.documentElement.childNodes)) {
    nested.appendChild(doc.importNode(child, true));
  }
  const transform = slot.getAttribute('transform');
  if (transform) nested.setAttribute('transform', transform);
  nested.setAttribute('data-rendered-slot-id', content.id);
  return nested;
};

/** Estilo de animação aplicável a um slot (subset de CSS). */
export interface SlotStyle {
  opacity?: number;
  transform?: string;
  contentTransform?: string;
  filter?: string;
}

export interface RenderTemplateOptions {
  /** Estilo por slot — quando presente, o slot é envolvido num <g style> animável. */
  styleById?: Record<string, SlotStyle>;
  /** Elementos exclusivos da cena, desenhados sobre o markup do modelo. */
  additionalElements?: SceneTemplateElement[];
  /** Estilo/estado animado dos elementos adicionais. */
  additionalStyleById?: Record<string, SlotStyle>;
}

const styleToCss = (style: SlotStyle): string => {
  const parts = ['transform-box:fill-box', 'transform-origin:center'];
  if (style.opacity != null) parts.push(`opacity:${style.opacity}`);
  if (style.transform) parts.push(`transform:${style.transform}`);
  if (style.filter) parts.push(`filter:${style.filter}`);
  return parts.join(';');
};

const appendStyledContent = (
  doc: XMLDocument,
  outer: Element,
  content: Element,
  style: SlotStyle,
): void => {
  if (!style.contentTransform) {
    outer.appendChild(content);
    return;
  }
  const clipPath = content.getAttribute('clip-path');
  if (clipPath) {
    outer.setAttribute('clip-path', clipPath);
    content.removeAttribute('clip-path');
  }
  const inner = doc.createElementNS(SVG_NS, 'g');
  inner.setAttribute('style', styleToCss({ transform: style.contentTransform }));
  inner.appendChild(content);
  outer.appendChild(inner);
};

const safeImageHref = (href: string): string =>
  /^(data:image\/(?:png|jpe?g|gif|webp|bmp)[;,]|blob:|https?:)/i.test(href.trim()) ? href : '';

const buildShapeNode = (
  doc: XMLDocument,
  element: Pick<
    SceneTemplateElement,
    'x' | 'y' | 'width' | 'height' | 'shape' | 'borderRadius'
  >,
): Element => {
  if (element.shape === 'circle') {
    const ellipse = doc.createElementNS(SVG_NS, 'ellipse');
    ellipse.setAttribute('cx', String(element.x + element.width / 2));
    ellipse.setAttribute('cy', String(element.y + element.height / 2));
    ellipse.setAttribute('rx', String(element.width / 2));
    ellipse.setAttribute('ry', String(element.height / 2));
    return ellipse;
  }
  if (element.shape === 'line') {
    const line = doc.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(element.x));
    line.setAttribute('y1', String(element.y + element.height / 2));
    line.setAttribute('x2', String(element.x + element.width));
    line.setAttribute('y2', String(element.y + element.height / 2));
    return line;
  }
  const rect = doc.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', String(element.x));
  rect.setAttribute('y', String(element.y));
  rect.setAttribute('width', String(element.width));
  rect.setAttribute('height', String(element.height));
  const radius = element.shape === 'pill' ? element.height / 2 : element.borderRadius ?? 0;
  if (radius > 0) rect.setAttribute('rx', String(radius));
  return rect;
};

const polygonPoints = (
  count: number,
  x: number,
  y: number,
  width: number,
  height: number,
  innerRatio?: number,
): string => {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const total = innerRatio ? count * 2 : count;
  return Array.from({ length: total }, (_, index) => {
    const inner = innerRatio && index % 2 === 1;
    const radiusX = inner ? rx * innerRatio : rx;
    const radiusY = inner ? ry * innerRatio : ry;
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
    return `${cx + Math.cos(angle) * radiusX},${cy + Math.sin(angle) * radiusY}`;
  }).join(' ');
};

const buildImageMaskNode = (
  doc: XMLDocument,
  image: SceneTemplateElement,
  elementsById: Map<string, SceneTemplateElement>,
): Element | null => {
  const source = image.maskElementId ? elementsById.get(image.maskElementId) : undefined;
  if (source?.type === 'shape' && source.shape !== 'line') {
    const node = buildShapeNode(doc, source);
    if (source.rotation) {
      node.setAttribute(
        'transform',
        `rotate(${source.rotation} ${source.x + source.width / 2} ${source.y + source.height / 2})`,
      );
    }
    return node;
  }

  const mask = image.imageMask ?? (image.borderRadius ? 'rounded' : 'rectangle');
  if (mask === 'circle' || mask === 'ellipse') {
    return buildShapeNode(doc, { ...image, shape: 'circle' });
  }
  if (mask === 'triangle' || mask === 'star' || mask === 'hexagon') {
    const polygon = doc.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute(
      'points',
      mask === 'triangle'
        ? polygonPoints(3, image.x, image.y, image.width, image.height)
        : mask === 'hexagon'
          ? polygonPoints(6, image.x, image.y, image.width, image.height)
          : polygonPoints(5, image.x, image.y, image.width, image.height, 0.44),
    );
    return polygon;
  }
  return buildShapeNode(doc, {
    ...image,
    shape: mask === 'rounded' ? 'rectangle' : 'rectangle',
    borderRadius: mask === 'rounded' ? image.borderRadius ?? Math.min(image.width, image.height) * 0.12 : 0,
  });
};

const appendAdditionalElement = (
  doc: XMLDocument,
  element: SceneTemplateElement,
  elementsById: Map<string, SceneTemplateElement>,
  style?: SlotStyle,
): void => {
  const wrapper = doc.createElementNS(SVG_NS, 'g');
  wrapper.setAttribute('data-scene-element-id', element.id);
  if (element.sourceTransform) {
    wrapper.setAttribute('transform', element.sourceTransform);
  } else if (element.rotation) {
    wrapper.setAttribute(
      'transform',
      `rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})`,
    );
  }
  wrapper.setAttribute(
    'style',
    styleToCss({
      transform: style?.transform,
      filter: style?.filter,
      opacity: (element.hidden ? 0 : element.opacity ?? 1) * (style?.opacity ?? 1),
    }),
  );

  let node: Element | null = null;
  if (element.type === 'text') {
    node = doc.createElementNS(SVG_NS, 'text');
    const align = element.textAlign ?? 'start';
    const baselineMode = element.textPositionMode === 'baseline';
    const x = baselineMode
      ? element.x
      : align === 'middle'
        ? element.x + element.width / 2
        : align === 'end' ? element.x + element.width : element.x;
    node.setAttribute('x', String(x));
    node.setAttribute('y', String(baselineMode ? element.y : element.y + element.height / 2));
    node.setAttribute('text-anchor', align);
    if (!baselineMode) node.setAttribute('dominant-baseline', 'central');
    node.setAttribute('font-size', String(element.fontSize ?? Math.max(12, element.height * 0.55)));
    node.setAttribute('font-weight', String(element.fontWeight ?? 700));
    if (element.fontStyle) node.setAttribute('font-style', element.fontStyle);
    node.setAttribute('fill', element.fill ?? '#ffffff');
    if (element.fontFamily) node.setAttribute('font-family', element.fontFamily);
    if (element.letterSpacing) node.setAttribute('letter-spacing', element.letterSpacing);
    if (element.textDecoration) node.setAttribute('text-decoration', element.textDecoration);
    if (element.stroke) node.setAttribute('stroke', element.stroke);
    if (element.strokeWidth) node.setAttribute('stroke-width', String(element.strokeWidth));
    node.textContent = element.text ?? element.name;
  } else if (element.type === 'image') {
    node = doc.createElementNS(SVG_NS, 'image');
    node.setAttribute('x', String(element.x));
    node.setAttribute('y', String(element.y));
    node.setAttribute('width', String(Math.max(0, element.width)));
    node.setAttribute('height', String(Math.max(0, element.height)));
    node.setAttribute('href', safeImageHref(element.imageHref ?? ''));
    node.setAttribute(
      'preserveAspectRatio',
      element.imageFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice',
    );
    if (
      (element.imageMask && element.imageMask !== 'rectangle')
      || element.maskElementId
      || (element.borderRadius ?? 0) > 0
    ) {
      clipCounter += 1;
      const clipId = `scene-element-clip-${clipCounter}`;
      const clip = doc.createElementNS(SVG_NS, 'clipPath');
      clip.setAttribute('id', clipId);
      const maskNode = buildImageMaskNode(doc, element, elementsById);
      if (maskNode) {
        clip.appendChild(maskNode);
        ensureDefs(doc).appendChild(clip);
        node.setAttribute('clip-path', `url(#${clipId})`);
      }
    }
  } else if (element.type === 'icon' && element.iconSvg) {
    const slot = doc.createElementNS(SVG_NS, 'rect');
    slot.setAttribute('x', String(element.x));
    slot.setAttribute('y', String(element.y));
    slot.setAttribute('width', String(element.width));
    slot.setAttribute('height', String(element.height));
    node = buildIcon(doc, slot, {
      id: element.id,
      type: 'icon',
      svg: element.iconSvg,
      fill: element.fill,
    });
  } else if (element.type === 'shape') {
    node = buildShapeNode(doc, element);
    node.setAttribute('fill', element.shape === 'line' ? 'none' : element.fill ?? '#7f77dd');
    node.setAttribute('stroke', element.stroke ?? (element.shape === 'line' ? element.fill ?? '#ffffff' : 'none'));
    node.setAttribute('stroke-width', String(element.strokeWidth ?? (element.shape === 'line' ? 4 : 0)));
  }

  if (!node) return;
  if (element.type === 'image' && style?.contentTransform && !node.hasAttribute('clip-path')) {
    clipCounter += 1;
    const clipId = `scene-element-motion-clip-${clipCounter}`;
    const clip = doc.createElementNS(SVG_NS, 'clipPath');
    clip.setAttribute('id', clipId);
    const maskNode = buildImageMaskNode(doc, element, elementsById);
    if (maskNode) {
      clip.appendChild(maskNode);
      ensureDefs(doc).appendChild(clip);
      node.setAttribute('clip-path', `url(#${clipId})`);
    }
  }
  appendStyledContent(doc, wrapper, node, style ?? {});
  doc.documentElement.appendChild(wrapper);
};

/**
 * Compõe o modelo preenchendo os slots com `contents`. Slots sem conteúdo são
 * mantidos como estão (fazem parte do desenho). Com `options.styleById`, cada
 * slot é envolvido num `<g style>` para animação (entrada/saída). Retorna o SVG.
 */
export const renderTemplate = (
  markup: string,
  contents: SlotContent[],
  options?: RenderTemplateOptions,
): string => {
  const doc = parse(markup);
  const renderedIds = new Set<string>();
  for (const content of contents) {
    const slot = doc.getElementById(content.id);
    if (!slot || !slot.parentNode) continue;
    let replacement: Element | null = null;
    if (content.type === 'image') replacement = buildImage(doc, slot, content);
    else if (content.type === 'text') replacement = buildText(doc, slot, content);
    else if (content.type === 'icon') replacement = buildIcon(doc, slot, content);
    if (!replacement) continue;
    renderedIds.add(content.id);

    const style = options?.styleById?.[content.id];
    if (style) {
      const group = doc.createElementNS(SVG_NS, 'g');
      group.setAttribute('data-rendered-slot-id', content.id);
      group.setAttribute('style', styleToCss({
        opacity: style.opacity,
        transform: style.transform,
        filter: style.filter,
      }));
      appendStyledContent(doc, group, replacement, style);
      slot.parentNode.replaceChild(group, slot);
    } else {
      slot.parentNode.replaceChild(replacement, slot);
    }
  }

  for (const [slotId, style] of Object.entries(options?.styleById ?? {})) {
    if (renderedIds.has(slotId)) continue;
    const slot = doc.getElementById(slotId);
    if (!slot?.parentNode) continue;
    const group = doc.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-rendered-slot-id', slotId);
    group.setAttribute('style', styleToCss({
      opacity: style.opacity,
      transform: style.transform,
      filter: style.filter,
    }));
    slot.parentNode.replaceChild(group, slot);
    appendStyledContent(doc, group, slot, style);
  }
  const additionalElements = options?.additionalElements ?? [];
  const elementsById = new Map(additionalElements.map((element) => [element.id, element]));
  for (const element of additionalElements) {
    appendAdditionalElement(doc, element, elementsById, options?.additionalStyleById?.[element.id]);
  }
  return serialize(doc);
};
