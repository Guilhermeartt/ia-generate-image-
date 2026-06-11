const SVG_NS = 'http://www.w3.org/2000/svg';

export interface PreparedSvgImport {
  markup: string;
  embeddedImages: number;
  embeddedFonts: number;
  unresolvedImages: string[];
}

const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const MAX_FONT_BYTES = 12 * 1024 * 1024;

const parseSvg = (markup: string): XMLDocument => {
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') {
    throw new Error('O arquivo não contém um SVG válido.');
  }
  return document;
};

const basename = (value: string): string => {
  const normalized = value.split(/[?#]/, 1)[0].replaceAll('\\', '/');
  const name = normalized.slice(normalized.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(name).toLowerCase();
  } catch {
    return name.toLowerCase();
  }
};

const fileStem = (name: string): string => name.replace(/\.[^.]+$/, '');

const readAsDataUrl = (file: File, mime: string, maxBytes: number): Promise<string> =>
  new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(
        new Error(
          `"${file.name}" excede o limite de ${Math.round(maxBytes / 1024 / 1024)} MB para importação.`,
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Não foi possível ler ${file.name}.`));
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;,]*/i, `data:${mime}`));
    reader.readAsDataURL(file);
  });

const imageMime = (file: File): string | null => {
  if (/^image\/(png|jpe?g|gif|webp|bmp)$/i.test(file.type)) return file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension && ['png', 'gif', 'webp', 'bmp'].includes(extension)) {
    return `image/${extension}`;
  }
  return null;
};

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

const normalizeFamily = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const fontMetadata = (
  file: File,
  families: Set<string>,
): { family: string; weight: number; style: 'normal' | 'italic' } => {
  const stem = fileStem(file.name);
  const normalizedStem = normalizeFamily(stem);
  const candidates = Array.from(families).filter(Boolean);
  const exact = candidates.find((candidate) => normalizeFamily(candidate) === normalizedStem);
  const related = candidates
    .filter((candidate) => normalizedStem.startsWith(normalizeFamily(candidate)))
    .sort((left, right) => normalizeFamily(right).length - normalizeFamily(left).length)[0];
  const style = /(?:italic|oblique)/i.test(stem) ? 'italic' : 'normal';
  const weight =
    [
      [/(?:thin|hairline)/i, 100],
      [/(?:extra[- ]?light|ultra[- ]?light)/i, 200],
      [/(?:light)/i, 300],
      [/(?:medium)/i, 500],
      [/(?:semi[- ]?bold|demi[- ]?bold)/i, 600],
      [/(?:extra[- ]?bold|ultra[- ]?bold)/i, 800],
      [/(?:black|heavy)/i, 900],
      [/(?:bold)/i, 700],
    ].find(([pattern]) => (pattern as RegExp).test(stem))?.[1] ?? 400;
  return {
    family: (exact ?? related ?? stem).replaceAll('"', '').replaceAll('\\', ''),
    weight: weight as number,
    style,
  };
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
    const mime = asset ? imageMime(asset) : null;
    if (!asset || !mime) {
      unresolvedImages.push(href);
      continue;
    }
    image.setAttribute('href', await readAsDataUrl(asset, mime, MAX_IMAGE_BYTES));
    image.removeAttribute('xlink:href');
    embeddedImages += 1;
  }

  const families = cssFamilyCandidates(document);
  const fontRules: string[] = [];
  for (const file of assets) {
    const format = fontFormat(file);
    if (!format) continue;
    const metadata = fontMetadata(file, families);
    const dataUrl = await readAsDataUrl(file, format.mime, MAX_FONT_BYTES);
    fontRules.push(
      `@font-face{font-family:"${metadata.family}";src:url("${dataUrl}") format("${format.format}");font-weight:${metadata.weight};font-style:${metadata.style};font-display:block;}`,
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
