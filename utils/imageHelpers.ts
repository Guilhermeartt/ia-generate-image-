/** Maior divisor comum (para reduzir proporções de imagem). */
export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Retorna a proporção reduzida no formato "L:A" (ex.: 1920×1080 → "16:9").
 * Retorna string vazia se alguma dimensão for inválida.
 */
export const aspectRatioLabel = (width?: number, height?: number): string => {
  if (!width || !height) return '';
  const d = gcd(width, height) || 1;
  return `${width / d}:${height / d}`;
};

/** Rótulo curto do modelo de imagem para exibição compacta no card. */
export const modelLabelShort = (model: string): string => {
  switch (model) {
    case 'gemini-2.5-flash-image':
      return 'NB 2.5';
    case 'gemini-3.1-flash-image-preview':
      return 'NB 3.1';
    case 'gemini-3-pro-image-preview':
      return 'NB Pro';
    case 'imagen-4.0-generate-001':
      return 'Imagen 4';
    default:
      return model.split('-')[0];
  }
};

/**
 * Recorta uma região de uma imagem (em coordenadas do tamanho exibido) e
 * devolve o recorte como base64 PNG. Usa canvas — roda no browser.
 */
export const cropImageToRegion = (
  imageUrl: string,
  region: { x: number; y: number; width: number; height: number },
  displayedWidth: number,
  displayedHeight: number,
): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const sx = img.naturalWidth / displayedWidth;
      const sy = img.naturalHeight / displayedHeight;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(region.width * sx));
      canvas.height = Math.max(1, Math.round(region.height * sy));
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(
        img,
        Math.round(region.x * sx),
        Math.round(region.y * sy),
        canvas.width,
        canvas.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      resolve({ base64: canvas.toDataURL('image/png').split(',')[1], mimeType: 'image/png' });
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
