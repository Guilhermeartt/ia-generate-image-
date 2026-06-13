import type {
  GradientSpec,
  GradientStop,
  SvgElementProperties,
  SvgLayer,
  SlotType,
  TemplateSlot,
  TemplateSlotMeta,
} from './types';
import type { SlotAnimation } from './slotAnimation';

const SVG_NS = 'http://www.w3.org/2000/svg';

const ALLOWED_ELEMENTS = new Set([
  // estrutura
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  // formas
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  // texto
  'text',
  'tspan',
  'textPath',
  'style',
  // imagem embutida (href data:image/* ou #ref)
  'image',
  // pintura: gradientes e padrões
  'linearGradient',
  'radialGradient',
  'stop',
  'pattern',
  // recorte / máscara / marcadores
  'clipPath',
  'mask',
  'marker',
  // filtros e suas primitivas (efeitos)
  'filter',
  'feGaussianBlur',
  'feOffset',
  'feBlend',
  'feColorMatrix',
  'feFlood',
  'feComposite',
  'feMerge',
  'feMergeNode',
  'feDropShadow',
  'feMorphology',
  'feTile',
  'feTurbulence',
  'feDisplacementMap',
  'feComponentTransfer',
  'feFuncR',
  'feFuncG',
  'feFuncB',
  'feFuncA',
  'feConvolveMatrix',
  'feSpecularLighting',
  'feDiffuseLighting',
  'feDistantLight',
  'fePointLight',
  'feSpotLight',
  'feImage',
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
  'class',
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
  'color',
  'paint-order',
  'flood-color',
  'flood-opacity',
  'lighting-color',
  'color-interpolation',
  'color-interpolation-filters',
  'mix-blend-mode',
  'isolation',
  'clip-rule',
  'shape-rendering',
  'image-rendering',
  'overflow',
  'vector-effect',
  // ── contorno ──
  'stroke-miterlimit',
  'stroke-dashoffset',
  // ── texto ──
  'font-style',
  'font-variant',
  'font-stretch',
  'letter-spacing',
  'word-spacing',
  'text-decoration',
  'writing-mode',
  'text-rendering',
  'baseline-shift',
  'alignment-baseline',
  'rotate',
  'textLength',
  'lengthAdjust',
  'startOffset',
  'side',
  'method',
  'spacing',
  'white-space',
  // ── geometria / estrutura ──
  'pathLength',
  'preserveAspectRatio',
  'refX',
  'refY',
  'fx',
  'fy',
  'fr',
  // ── marcadores ──
  'marker-start',
  'marker-mid',
  'marker-end',
  'marker',
  'markerWidth',
  'markerHeight',
  'markerUnits',
  'orient',
  // ── recorte / máscara / padrão ──
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  // ── filtros ──
  'filterUnits',
  'primitiveUnits',
  'operator',
  'k1',
  'k2',
  'k3',
  'k4',
  'scale',
  'xChannelSelector',
  'yChannelSelector',
  'radius',
  'numOctaves',
  'baseFrequency',
  'seed',
  'stitchTiles',
  'tableValues',
  'slope',
  'intercept',
  'amplitude',
  'exponent',
  'surfaceScale',
  'specularConstant',
  'specularExponent',
  'diffuseConstant',
  'kernelMatrix',
  'order',
  'divisor',
  'bias',
  'targetX',
  'targetY',
  'edgeMode',
  'preserveAlpha',
  'kernelUnitLength',
  'azimuth',
  'elevation',
  'pointsAtX',
  'pointsAtY',
  'pointsAtZ',
  'limitingConeAngle',
  'z',
  // Marca um elemento como espaço parametrizável de um modelo de cena.
  // Conteúdo: JSON { type, name }. Tratado como texto comum (não-URL) pelo
  // sanitizer, então sobrevive ao round-trip de import/export.
  'data-slot',
  'data-editor-locked',
  'data-embedded-fonts',
]);

const URL_ATTRIBUTES = new Set([
  'fill',
  'stroke',
  'clip-path',
  'mask',
  'filter',
  'marker-start',
  'marker-mid',
  'marker-end',
  'marker',
]);

const CSS_PRESENTATION_ATTRIBUTES = new Set([
  'color',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'opacity',
  'display',
  'visibility',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'font-stretch',
  'letter-spacing',
  'word-spacing',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  'baseline-shift',
  'text-decoration',
  'writing-mode',
  'white-space',
  'paint-order',
  'mix-blend-mode',
  'isolation',
  'clip-rule',
  'shape-rendering',
  'image-rendering',
  'text-rendering',
  'vector-effect',
]);

const INHERITED_PRESENTATION_ATTRIBUTES = new Set([
  'color',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'font-stretch',
  'letter-spacing',
  'word-spacing',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  'baseline-shift',
  'text-decoration',
  'writing-mode',
  'white-space',
  'visibility',
]);
const ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const INTERNAL_REF = /^#[A-Za-z_][\w.:-]*$/;

// href/xlink:href: só referência interna (#id) ou imagem RASTER embutida.
// Bloqueia javascript:, data:text/html, URLs externas (privacidade/SSRF) e
// data:image/svg+xml — este último seria o vetor "SVG-em-data-URI" em <use>/feImage.
const sanitizeHref = (value: string): string | null => {
  const v = value.trim();
  if (INTERNAL_REF.test(v)) return v;
  if (/^data:image\/(png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+/=\s]+$/i.test(v)) return v;
  return null;
};

// style inline: mantém propriedades de apresentação (fill, filter, blend, etc.),
// mas rejeita o atributo inteiro se houver token perigoso ou url() não-interna.
const STYLE_BLOCKLIST =
  /expression\(|javascript:|behaviou?r\s*:|-moz-binding|@import|<\/|url\(\s*['"]?\s*(?!#)/i;
const sanitizeStyle = (value: string): string | null => {
  if (STYLE_BLOCKLIST.test(value)) return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const sanitizeEmbeddedFontCss = (value: string): string | null => {
  const rules: string[] = [];
  for (const match of value.matchAll(/@font-face\s*\{([^}]+)\}/gi)) {
    const body = match[1];
    const family = body.match(/font-family\s*:\s*["']?([^;"'}]+)["']?/i)?.[1]?.trim();
    const source = body.match(
      /src\s*:\s*url\(\s*["']?(data:font\/(ttf|otf|woff2?);base64,[A-Za-z0-9+/=]+)["']?\s*\)\s*format\(\s*["']?(truetype|opentype|woff2?)["']?\s*\)/i,
    );
    if (!family || !/^[\w -]{1,80}$/.test(family) || !source) continue;
    const expectedFormat: Record<string, string> = {
      ttf: 'truetype',
      otf: 'opentype',
      woff: 'woff',
      woff2: 'woff2',
    };
    if (expectedFormat[source[2].toLowerCase()] !== source[3].toLowerCase()) continue;
    const rawWeight = body.match(/font-weight\s*:\s*(\d{3}|normal|bold)/i)?.[1] ?? '400';
    const weight = rawWeight === 'normal' ? '400' : rawWeight === 'bold' ? '700' : rawWeight;
    if (!/^[1-9]00$/.test(weight)) continue;
    const style = body.match(/font-style\s*:\s*(normal|italic|oblique)/i)?.[1] ?? 'normal';
    rules.push(
      `@font-face{font-family:"${family}";src:url("${source[1]}") format("${source[3]}");font-weight:${weight};font-style:${style};font-display:block;}`,
    );
  }
  return rules.length > 0 ? rules.join('') : null;
};

interface CssDeclaration {
  name: string;
  value: string;
  important: boolean;
}

interface AppliedCssDeclaration extends CssDeclaration {
  specificity: number;
  order: number;
}

const parseCssDeclarations = (cssText: string): CssDeclaration[] => {
  const probe = document.createElement('span');
  probe.setAttribute('style', cssText);
  return Array.from(probe.style)
    .map((name) => ({
      name,
      value: probe.style.getPropertyValue(name).trim(),
      important: probe.style.getPropertyPriority(name) === 'important',
    }))
    .filter(
      ({ name, value }) =>
        CSS_PRESENTATION_ATTRIBUTES.has(name) &&
        !!value &&
        isSafeAttributeValue(name, value) &&
        !STYLE_BLOCKLIST.test(`${name}:${value}`),
    );
};

const selectorSpecificity = (selector: string): number => {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
  const classes = selector.match(/\.[\w-]+|\[[^\]]+\]/g)?.length ?? 0;
  const elements = selector.match(/(^|[\s>+~])([a-zA-Z][\w-]*)/g)?.length ?? 0;
  return ids * 100 + classes * 10 + elements;
};

const materializeStylesheets = (sourceDocument: XMLDocument): void => {
  const applied = new Map<Element, Map<string, AppliedCssDeclaration>>();
  let order = 0;

  for (const styleElement of Array.from(sourceDocument.querySelectorAll('style'))) {
    const cssText = styleElement.textContent || '';
    if (!sanitizeStyle(cssText)) continue;

    const styleHost = document.createElement('style');
    styleHost.textContent = cssText;
    document.head.appendChild(styleHost);
    try {
      for (const rule of Array.from(styleHost.sheet?.cssRules ?? [])) {
        if (rule.type !== CSSRule.STYLE_RULE) continue;
        const styleRule = rule as CSSStyleRule;
        for (const selector of styleRule.selectorText.split(',')) {
          let matches: Element[] = [];
          try {
            matches = Array.from(sourceDocument.querySelectorAll(selector.trim()));
          } catch {
            continue;
          }
          const specificity = selectorSpecificity(selector);
          const declarations = parseCssDeclarations(styleRule.style.cssText);
          for (const element of matches) {
            const elementRules = applied.get(element) ?? new Map<string, AppliedCssDeclaration>();
            for (const declaration of declarations) {
              const previous = elementRules.get(declaration.name);
              const wins =
                !previous ||
                (declaration.important && !previous.important) ||
                (declaration.important === previous.important &&
                  (specificity > previous.specificity ||
                    (specificity === previous.specificity && order >= previous.order)));
              if (wins) elementRules.set(declaration.name, { ...declaration, specificity, order });
            }
            applied.set(element, elementRules);
          }
          order += 1;
        }
      }
    } finally {
      styleHost.remove();
    }
  }

  for (const element of Array.from(sourceDocument.querySelectorAll('*'))) {
    const elementRules = applied.get(element) ?? new Map<string, AppliedCssDeclaration>();
    for (const declaration of parseCssDeclarations(element.getAttribute('style') || '')) {
      const previous = elementRules.get(declaration.name);
      if (!previous?.important || declaration.important) {
        elementRules.set(declaration.name, {
          ...declaration,
          specificity: 1000,
          order: Number.MAX_SAFE_INTEGER,
        });
      }
    }
    for (const declaration of elementRules.values()) {
      element.setAttribute(declaration.name, declaration.value);
    }
    element.removeAttribute('style');
    element.removeAttribute('class');
  }
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

const isSafeMutation = (name: string, value: string): boolean => {
  if (!ALLOWED_ATTRIBUTES.has(name) || !isSafeAttributeValue(name, value)) return false;
  if (name === 'data-editor-locked') return value === 'true';
  if (name === 'data-slot') return parseSlotMeta(value) !== null;
  return true;
};

const copySafeElement = (
  source: Element,
  targetDocument: XMLDocument,
  usedIds: Set<string>,
): Element | null => {
  if (!ALLOWED_ELEMENTS.has(source.localName)) return null;

  if (source.localName === 'style') {
    if (source.getAttribute('data-embedded-fonts') !== 'true') return null;
    const css = sanitizeEmbeddedFontCss(source.textContent || '');
    if (!css) return null;
    const style = targetDocument.createElementNS(SVG_NS, 'style');
    style.setAttribute('data-embedded-fonts', 'true');
    style.appendChild(targetDocument.createTextNode(css));
    return style;
  }

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
    } else if (
      child.nodeType === Node.TEXT_NODE &&
      ['text', 'tspan', 'textPath', 'style'].includes(source.localName)
    ) {
      target.appendChild(targetDocument.createTextNode(child.textContent ?? ''));
    }
  }
  return target;
};

export const sanitizeSvg = (markup: string): string => {
  const sourceDocument = parseSvg(markup);
  materializeStylesheets(sourceDocument);
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
  const safeWidth = Number.isFinite(width) ? Math.max(1, Math.round(width)) : 1280;
  const safeHeight = Number.isFinite(height) ? Math.max(1, Math.round(height)) : 720;
  root.setAttribute('viewBox', `0 0 ${safeWidth} ${safeHeight}`);
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
  const fill = effectivePresentationValue(element, 'fill', 'none');
  const resolvedFill =
    fill === 'currentColor' ? effectivePresentationValue(element, 'color', '#000000') : fill;
  const stroke = effectivePresentationValue(element, 'stroke', 'none');
  const resolvedStroke =
    stroke === 'currentColor' ? effectivePresentationValue(element, 'color', '#000000') : stroke;
  const transform = element.getAttribute('transform') || '';
  const rotateMatch = transform.match(/rotate\(\s*(-?\d+(?:\.\d+)?)/i);
  return {
    id,
    tagName: element.localName,
    fill: resolvedFill,
    stroke: resolvedStroke,
    strokeWidth: Number.parseFloat(effectivePresentationValue(element, 'stroke-width', '0')),
    strokeDasharray: effectivePresentationValue(element, 'stroke-dasharray', ''),
    opacity: Number.parseFloat(effectivePresentationValue(element, 'opacity', '1')),
    text: element.textContent || '',
    fontFamily: effectivePresentationValue(element, 'font-family', 'sans-serif'),
    fontSize: Number.parseFloat(effectivePresentationValue(element, 'font-size', '16')) || 16,
    fontWeight: effectivePresentationValue(element, 'font-weight', '400'),
    fontStyle: effectivePresentationValue(element, 'font-style', 'normal'),
    letterSpacing: effectivePresentationValue(element, 'letter-spacing', 'normal'),
    textDecoration: effectivePresentationValue(element, 'text-decoration', 'none'),
    textAnchor: effectivePresentationValue(element, 'text-anchor', 'start'),
    borderRadius: Number.parseFloat(element.getAttribute('rx') || '0') || 0,
    textLength: element.hasAttribute('textLength')
      ? Number.parseFloat(element.getAttribute('textLength') || '0')
      : null,
    lengthAdjust: element.getAttribute('lengthAdjust') || 'spacing',
    structuredText:
      element.localName === 'text' &&
      Array.from(element.children).some((child) => ['tspan', 'textPath'].includes(child.localName)),
    transform,
    rotation: rotateMatch ? Number.parseFloat(rotateMatch[1]) || 0 : 0,
    ...bounds,
  };
};

const effectivePresentationValue = (element: Element, name: string, fallback: string): string => {
  let current: Element | null = element;
  while (current) {
    const direct = current.getAttribute(name);
    if (direct && direct !== 'inherit') return direct;
    if (!INHERITED_PRESENTATION_ATTRIBUTES.has(name)) break;
    current = current.parentElement;
  }
  return fallback;
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
    else {
      const serialized = String(value);
      if (isSafeMutation(name, serialized)) element.setAttribute(name, serialized);
    }
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
  if (
    Array.from(element.children).some((child) => ['tspan', 'textPath'].includes(child.localName))
  ) {
    return markup;
  }
  element.textContent = text;
  return serialize(document);
};

export const listSvgLayers = (markup: string): SvgLayer[] => {
  const document = parseSvg(markup);
  const layers: SvgLayer[] = [];
  const visit = (parent: Element, depth: number, parentId: string | null) => {
    const children = Array.from(parent.children).filter(
      (element) => EDITABLE_ELEMENTS.has(element.localName) && element.id,
    );
    for (const element of children.reverse()) {
      layers.push({
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
                image: 'Imagem',
                polygon: 'Polígono',
                polyline: 'Polilinha',
              }[element.localName] || element.localName,
        depth,
        parentId,
        visible: element.getAttribute('display') !== 'none',
        locked: element.getAttribute('data-editor-locked') === 'true',
      });
      visit(element, depth + 1, element.id);
    }
  };
  visit(document.documentElement, 0, null);
  return layers;
};

export const setSvgElementVisibility = (markup: string, id: string, visible: boolean): string =>
  updateSvgElement(markup, id, { display: visible ? null : 'none' });

export const setSvgElementLocked = (markup: string, id: string, locked: boolean): string =>
  updateSvgElement(markup, id, { 'data-editor-locked': locked ? 'true' : null });

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

/**
 * Move o elemento `id` para junto de `referenceId` no DOM (reordena z-order e
 * re-parenta: o elemento passa a ser irmão de `referenceId`). `before=true` o
 * insere ANTES (atrás no render); `false`, depois (à frente).
 */
export const moveSvgElement = (
  markup: string,
  id: string,
  referenceId: string,
  before: boolean,
): string => {
  if (id === referenceId) return markup;
  const document = parseSvg(markup);
  const moving = document.getElementById(id);
  const reference = document.getElementById(referenceId);
  const parent = reference?.parentElement;
  if (!moving || !reference || !parent) return markup;
  // Não pode mover um grupo para dentro de si mesmo.
  if (moving.contains(reference)) return markup;
  parent.insertBefore(moving, before ? reference : reference.nextSibling);
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

const assignFreshIds = (element: Element, replacements: Map<string, string>): void => {
  if (element.id) {
    const previous = element.id;
    const next = createSvgId(element.localName);
    replacements.set(previous, next);
    element.setAttribute('id', next);
  } else if (EDITABLE_ELEMENTS.has(element.localName)) {
    element.setAttribute('id', createSvgId(element.localName));
  }
  for (const child of Array.from(element.children)) assignFreshIds(child, replacements);
};

const rewriteInternalReferences = (element: Element, replacements: Map<string, string>): void => {
  for (const attribute of Array.from(element.attributes)) {
    let value = attribute.value.replace(
      /url\(\s*#([A-Za-z_][\w.:-]*)\s*\)/g,
      (reference, id: string) => {
        const replacement = replacements.get(id);
        return replacement ? `url(#${replacement})` : reference;
      },
    );
    const directReference = value.match(/^#([A-Za-z_][\w.:-]*)$/);
    if (directReference) {
      const replacement = replacements.get(directReference[1]);
      if (replacement) value = `#${replacement}`;
    }
    if (value !== attribute.value) element.setAttribute(attribute.name, value);
  }
  for (const child of Array.from(element.children)) rewriteInternalReferences(child, replacements);
};

export const duplicateSvgElement = (
  markup: string,
  id: string,
): { markup: string; id: string | null } => {
  const document = parseSvg(markup);
  const source = document.getElementById(id);
  if (!source || !source.parentElement) return { markup, id: null };
  const clone = source.cloneNode(true) as Element;
  const replacements = new Map<string, string>();
  assignFreshIds(clone, replacements);
  rewriteInternalReferences(clone, replacements);
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

export const transformSvgElement = (markup: string, id: string, transform: string): string =>
  updateSvgElement(markup, id, { transform });

// ── Slots de modelo de cena ──────────────────────────────────────────────────
// Um slot é um elemento comum do SVG marcado com `data-slot`. A geometria do
// slot é derivada do próprio elemento (mesmo cálculo das propriedades), então
// não há fonte de verdade duplicada: o markup é o template.

const SLOT_TYPES = new Set<SlotType>(['image', 'text', 'icon']);

const defaultSlotName = (type: SlotType): string =>
  ({ image: 'Imagem', text: 'Texto', icon: 'Ícone' })[type];

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

// ── Degradês (gradientes lineares/radiais) ───────────────────────────────────
// Os gradientes vivem no <defs> e são referenciados por fill="url(#id)". Usam
// gradientUnits="objectBoundingBox" (coords 0..1) para funcionar em qualquer
// tamanho de forma. O ângulo (linear) é mapeado para x1/y1/x2/y2.

const GRADIENT_TAGS = new Set(['linearGradient', 'radialGradient']);

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

const DEFAULT_GRADIENT_STOPS: GradientStop[] = [
  { offset: 0, color: '#7f77dd', opacity: 1 },
  { offset: 1, color: '#1d9e75', opacity: 1 },
];

/** Verdadeiro se o valor de fill/stroke aponta para um recurso por id (url(#…)). */
export const isGradientFill = (value: string | null | undefined): boolean =>
  !!value && /^url\(\s*#.+\)$/.test(value.trim());

const gradientIdFromFill = (value: string): string | null =>
  value.trim().match(/^url\(\s*#([^)\s]+)\s*\)$/)?.[1] ?? null;

const parseOffset = (raw: string | null): number => {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (trimmed.endsWith('%')) return clampUnit(Number.parseFloat(trimmed) / 100);
  return clampUnit(Number.parseFloat(trimmed) || 0);
};

const coordsFromAngle = (
  angleDeg: number,
): { x1: number; y1: number; x2: number; y2: number } => {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad) / 2;
  const dy = Math.sin(rad) / 2;
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };
};

const angleFromGradient = (grad: Element): number => {
  const x1 = numberAttribute(grad, 'x1');
  const y1 = numberAttribute(grad, 'y1');
  const x2 = grad.hasAttribute('x2') ? numberAttribute(grad, 'x2') : 1;
  const y2 = numberAttribute(grad, 'y2');
  return Math.round((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI);
};

const round3 = (value: number): string => String(Math.round(value * 1000) / 1000);

/** Lê o degradê referenciado pelo fill de `id`, ou null se o fill não for um degradê. */
export const readGradient = (markup: string, id: string): GradientSpec | null => {
  const document = parseSvg(markup);
  const element = document.getElementById(id);
  if (!element) return null;
  const fill = element.getAttribute('fill') || '';
  const gradientId = isGradientFill(fill) ? gradientIdFromFill(fill) : null;
  if (!gradientId) return null;
  const grad = document.getElementById(gradientId);
  if (!grad || !GRADIENT_TAGS.has(grad.localName)) return null;

  const type = grad.localName === 'radialGradient' ? 'radial' : 'linear';
  const stops: GradientStop[] = Array.from(grad.querySelectorAll('stop')).map((stop) => ({
    offset: parseOffset(stop.getAttribute('offset')),
    color: stop.getAttribute('stop-color') || '#000000',
    opacity: clampUnit(Number.parseFloat(stop.getAttribute('stop-opacity') || '1')),
  }));
  return {
    type,
    stops: stops.length ? stops : DEFAULT_GRADIENT_STOPS.map((stop) => ({ ...stop })),
    angle: type === 'linear' ? angleFromGradient(grad) : 0,
  };
};

const ensureGradientDefs = (document: XMLDocument): Element => {
  const existing = document.documentElement.querySelector(':scope > defs');
  if (existing) return existing;
  const defs = document.createElementNS(SVG_NS, 'defs');
  document.documentElement.insertBefore(defs, document.documentElement.firstChild);
  return defs;
};

/**
 * Aplica um degradê ao preenchimento de `id`: cria (ou atualiza, reusando o id se
 * a forma já apontava para um) o <linearGradient>/<radialGradient> no <defs> e
 * aponta o fill da forma para ele.
 */
export const applyGradientFill = (markup: string, id: string, spec: GradientSpec): string => {
  const document = parseSvg(markup);
  const element = document.getElementById(id);
  if (!element) return markup;

  const wantTag = spec.type === 'radial' ? 'radialGradient' : 'linearGradient';
  const fill = element.getAttribute('fill') || '';
  const existingId = isGradientFill(fill) ? gradientIdFromFill(fill) : null;
  const existing = existingId ? document.getElementById(existingId) : null;

  let gradientId: string;
  let grad: Element;
  if (existing && existingId && GRADIENT_TAGS.has(existing.localName)) {
    gradientId = existingId;
    if (existing.localName === wantTag) {
      grad = existing;
    } else {
      // Troca de tipo (linear↔radial) mantendo o mesmo id.
      grad = document.createElementNS(SVG_NS, wantTag);
      grad.setAttribute('id', gradientId);
      existing.replaceWith(grad);
    }
  } else {
    gradientId = createSvgId('grad');
    grad = document.createElementNS(SVG_NS, wantTag);
    grad.setAttribute('id', gradientId);
    ensureGradientDefs(document).appendChild(grad);
  }

  while (grad.firstChild) grad.removeChild(grad.firstChild);
  for (const attribute of ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy', 'fr']) {
    grad.removeAttribute(attribute);
  }
  grad.setAttribute('gradientUnits', 'objectBoundingBox');

  if (spec.type === 'linear') {
    const coords = coordsFromAngle(spec.angle);
    grad.setAttribute('x1', round3(coords.x1));
    grad.setAttribute('y1', round3(coords.y1));
    grad.setAttribute('x2', round3(coords.x2));
    grad.setAttribute('y2', round3(coords.y2));
  } else {
    grad.setAttribute('cx', '0.5');
    grad.setAttribute('cy', '0.5');
    grad.setAttribute('r', '0.5');
  }

  const stops = (spec.stops.length >= 2 ? spec.stops : DEFAULT_GRADIENT_STOPS)
    .map((stop) => ({ ...stop, offset: clampUnit(stop.offset) }))
    .sort((left, right) => left.offset - right.offset);
  for (const stop of stops) {
    const stopElement = document.createElementNS(SVG_NS, 'stop');
    stopElement.setAttribute('offset', round3(stop.offset));
    stopElement.setAttribute('stop-color', stop.color);
    if (stop.opacity < 1) stopElement.setAttribute('stop-opacity', round3(clampUnit(stop.opacity)));
    grad.appendChild(stopElement);
  }

  element.setAttribute('fill', `url(#${gradientId})`);
  return serialize(document);
};

// ── Limpeza / organização do SVG (segura e determinística) ───────────────────
// Remove elementos ocultos, achata grupos redundantes e descarta defs órfãos.
// NÃO remove elementos "atrás de outros" (oclusão) — isso seria geometricamente
// arriscado. Nunca remove algo referenciado por id.

export interface CleanupSummary {
  hidden: number;
  groups: number;
  defs: number;
}

const DEF_LIKE = new Set([
  'defs',
  'linearGradient',
  'radialGradient',
  'pattern',
  'clipPath',
  'mask',
  'filter',
  'symbol',
  'marker',
]);

const REF_TAGS = 'linearGradient,radialGradient,pattern,clipPath,mask,filter,symbol,marker';

const collectReferencedIds = (root: Element): Set<string> => {
  const ids = new Set<string>();
  const visit = (element: Element) => {
    for (const attribute of Array.from(element.attributes)) {
      for (const match of attribute.value.matchAll(/url\(\s*#([A-Za-z_][\w.:-]*)\s*\)/g)) {
        ids.add(match[1]);
      }
      if (attribute.name === 'href' || attribute.name === 'xlink:href') {
        const direct = attribute.value.trim().match(/^#([A-Za-z_][\w.:-]*)$/);
        if (direct) ids.add(direct[1]);
      }
    }
    for (const child of Array.from(element.children)) visit(child);
  };
  visit(root);
  return ids;
};

const styleHas = (element: Element, pattern: RegExp): boolean =>
  pattern.test((element.getAttribute('style') || '').toLowerCase());

const isZeroSized = (element: Element): boolean => {
  const num = (name: string) => Number.parseFloat(element.getAttribute(name) || 'NaN');
  switch (element.localName) {
    case 'rect':
    case 'image':
      return num('width') === 0 || num('height') === 0;
    case 'circle':
      return num('r') === 0;
    case 'ellipse':
      return num('rx') === 0 || num('ry') === 0;
    default:
      return false;
  }
};

/**
 * Limpa o SVG: remove ocultos, achata grupos redundantes e remove defs órfãos.
 * Retorna o markup limpo e um resumo do que foi removido.
 */
export const cleanupSvg = (markup: string): { markup: string; summary: CleanupSummary } => {
  const document = parseSvg(markup);
  const root = document.documentElement;
  const summary: CleanupSummary = { hidden: 0, groups: 0, defs: 0 };

  const insideDef = (element: Element): boolean => {
    let parent = element.parentElement;
    while (parent && parent !== root) {
      if (DEF_LIKE.has(parent.localName)) return true;
      parent = parent.parentElement;
    }
    return false;
  };

  // 1. Ocultos / tamanho zero (apenas na árvore renderizável; nunca referenciados).
  const referenced = collectReferencedIds(root);
  for (const element of Array.from(root.querySelectorAll('*'))) {
    if (DEF_LIKE.has(element.localName) || insideDef(element)) continue;
    if (element.id && referenced.has(element.id)) continue;
    const displayNone =
      element.getAttribute('display') === 'none' || styleHas(element, /(?:^|;)\s*display\s*:\s*none/);
    const isGroup = element.localName === 'g';
    // display:none esconde toda a subárvore (seguro até em grupos). Os demais só
    // em formas-folha, pois filhos poderiam sobrescrever visibility/opacity.
    const leafHidden =
      !isGroup &&
      (element.getAttribute('visibility') === 'hidden' ||
        styleHas(element, /(?:^|;)\s*visibility\s*:\s*hidden/) ||
        element.getAttribute('opacity') === '0' ||
        Number.parseFloat(element.getAttribute('opacity') || 'NaN') === 0 ||
        styleHas(element, /(?:^|;)\s*opacity\s*:\s*0(?:\.0+)?\s*(?:;|$)/) ||
        isZeroSized(element));
    if (displayNone || leafHidden) {
      element.remove();
      summary.hidden += 1;
    }
  }

  // 2. Grupos: remove vazios e desembrulha redundantes (sem atributos que afetem
  //    o render — exceto um id não referenciado). Repete até estabilizar.
  const groupRefs = collectReferencedIds(root);
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of Array.from(root.querySelectorAll('g'))) {
      if (insideDef(group)) continue;
      if (group.children.length === 0) {
        group.remove();
        summary.groups += 1;
        changed = true;
        continue;
      }
      const attributeNames = Array.from(group.attributes).map((attribute) => attribute.name);
      const onlyUnusedId =
        attributeNames.length === 0 ||
        (attributeNames.length === 1 &&
          attributeNames[0] === 'id' &&
          !groupRefs.has(group.id));
      if (onlyUnusedId) {
        group.replaceWith(...Array.from(group.childNodes));
        summary.groups += 1;
        changed = true;
      }
    }
  }

  // 3. Defs órfãos (nada referencia o id). Repete até estabilizar (refs encadeadas).
  changed = true;
  while (changed) {
    changed = false;
    const refs = collectReferencedIds(root);
    for (const def of Array.from(root.querySelectorAll(REF_TAGS))) {
      if (def.id && !refs.has(def.id)) {
        def.remove();
        summary.defs += 1;
        changed = true;
      }
    }
  }
  for (const defs of Array.from(root.querySelectorAll('defs'))) {
    if (defs.children.length === 0) defs.remove();
  }

  return { markup: serialize(document), summary };
};
