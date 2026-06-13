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
  filter?: string;
}

export interface RenderTemplateOptions {
  /** Estilo por slot — quando presente, o slot é envolvido num <g style> animável. */
  styleById?: Record<string, SlotStyle>;
}

const styleToCss = (style: SlotStyle): string => {
  const parts = ['transform-box:fill-box', 'transform-origin:center'];
  if (style.opacity != null) parts.push(`opacity:${style.opacity}`);
  if (style.transform) parts.push(`transform:${style.transform}`);
  if (style.filter) parts.push(`filter:${style.filter}`);
  return parts.join(';');
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
      group.setAttribute('style', styleToCss(style));
      group.appendChild(replacement);
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
    group.setAttribute('style', styleToCss(style));
    slot.parentNode.replaceChild(group, slot);
    group.appendChild(slot);
  }
  return serialize(doc);
};
