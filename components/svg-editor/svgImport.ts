const SVG_NS = 'http://www.w3.org/2000/svg';

export interface PreparedSvgImport {
  markup: string;
  embeddedImages: number;
  embeddedFonts: number;
  unresolvedImages: string[];
}

const parseSvg = (markup: string): XMLDocument => {
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') {
    throw new Error('O arquivo não contém um SVG válido.');
  }
  return document;
};

const basename = (value: string): string => {
  const normalized = value.split(/[?#]/, 1)[0].replaceAll('\\', '/');
  return decodeURIComponent(normalized.slice(normalized.lastIndexOf('/') + 1)).toLowerCase();
};

const fileStem = (name: string): string => name.replace(/\.[^.]+$/, '');

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Não foi possível ler ${file.name}.`));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

const cssFamilyCandidates = (document: XMLDocument): Set<string> => {
  const families = new Set<string>();
  for (const element of Array.from(document.querySelectorAll('[font-family]'))) {
    const value = element.getAttribute('font-family') || '';
    value.split(',').forEach((family) => families.add(family.trim().replace(/^['"]|['"]$/g, '')));
  }
  for (const style of Array.from(document.querySelectorAll('style'))) {
    const text = style.textContent || '';
    for (const match of text.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
      match[1]
        .split(',')
        .forEach((family) => families.add(family.trim().replace(/^['"]|['"]$/g, '')));
    }
  }
  return families;
};

const fontFormat = (file: File): { mime: string; format: string } | null => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'ttf') return { mime: 'font/ttf', format: 'truetype' };
  if (extension === 'otf') return { mime: 'font/otf', format: 'opentype' };
  if (extension === 'woff') return { mime: 'font/woff', format: 'woff' };
  if (extension === 'woff2') return { mime: 'font/woff2', format: 'woff2' };
  return null;
};

const ensureDefs = (document: XMLDocument): Element => {
  const existing = document.documentElement.querySelector(':scope > defs');
  if (existing) return existing;
  const defs = document.createElementNS(SVG_NS, 'defs');
  document.documentElement.insertBefore(defs, document.documentElement.firstChild);
  return defs;
};

export const prepareSvgImport = async (
  markup: string,
  assets: File[],
): Promise<PreparedSvgImport> => {
  const document = parseSvg(markup);
  const byName = new Map(assets.map((file) => [file.name.toLowerCase(), file]));
  const unresolvedImages: string[] = [];
  let embeddedImages = 0;

  for (const image of Array.from(document.querySelectorAll('image'))) {
    const href = image.getAttribute('href') || image.getAttribute('xlink:href') || '';
    if (!href || /^(data:|blob:|#)/i.test(href)) continue;
    const asset = byName.get(basename(href));
    if (!asset || !asset.type.startsWith('image/')) {
      unresolvedImages.push(href);
      continue;
    }
    image.setAttribute('href', await readAsDataUrl(asset));
    image.removeAttribute('xlink:href');
    embeddedImages += 1;
  }

  const families = cssFamilyCandidates(document);
  const fontRules: string[] = [];
  for (const file of assets) {
    const format = fontFormat(file);
    if (!format) continue;
    const family = fileStem(file.name);
    const matchingFamily =
      Array.from(families).find(
        (candidate) =>
          candidate.toLowerCase() === family.toLowerCase() ||
          candidate.toLowerCase().replaceAll(' ', '-') === family.toLowerCase(),
      ) ?? family;
    const dataUrl = await readAsDataUrl(file);
    const normalizedDataUrl = dataUrl.replace(/^data:[^;,]+/i, `data:${format.mime}`);
    fontRules.push(
      `@font-face{font-family:"${matchingFamily.replaceAll('"', '')}";src:url("${normalizedDataUrl}") format("${format.format}");font-style:normal;font-display:block;}`,
    );
  }

  if (fontRules.length > 0) {
    const style = document.createElementNS(SVG_NS, 'style');
    style.setAttribute('data-embedded-fonts', 'true');
    style.textContent = fontRules.join('');
    ensureDefs(document).appendChild(style);
  }

  return {
    markup: new XMLSerializer().serializeToString(document.documentElement),
    embeddedImages,
    embeddedFonts: fontRules.length,
    unresolvedImages,
  };
};
