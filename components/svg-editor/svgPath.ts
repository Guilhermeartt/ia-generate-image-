// ── Edição de pontos de um <path> poligonal (M/L/Z absolutos) ────────────────
// Cobre os paths que o editor gera (caneta, desenho livre, triângulo, estrela).
// Paths com curvas (C/Q/A), comandos relativos ou múltiplos subpaths NÃO são
// considerados editáveis aqui (parsePolyline devolve null).

export interface PathPoint {
  x: number;
  y: number;
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** Parseia um path simples em pontos. Retorna null se não for poligonal. */
export const parsePolyline = (d: string): { points: PathPoint[]; closed: boolean } | null => {
  if (!d) return null;
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g);
  if (!tokens) return null;

  const points: PathPoint[] = [];
  let closed = false;
  let i = 0;

  const readPair = (): PathPoint | null => {
    const x = Number(tokens[i]);
    const y = Number(tokens[i + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    i += 2;
    return { x, y };
  };

  while (i < tokens.length) {
    const command = tokens[i];
    if (command === 'M' || command === 'L') {
      // Um segundo M (novo subpath) torna o path não-editável aqui.
      if (command === 'M' && points.length > 0) return null;
      i += 1;
      const first = readPair();
      if (!first) return null;
      points.push(first);
      // Pares extras após M/L são linhas implícitas.
      while (i < tokens.length && /^-?[\d.]/.test(tokens[i])) {
        const extra = readPair();
        if (!extra) return null;
        points.push(extra);
      }
    } else if (command === 'Z' || command === 'z') {
      closed = true;
      i += 1;
    } else {
      // Curvas, comandos relativos, etc. → não editável.
      return null;
    }
  }

  if (points.length < 2) return null;
  return { points, closed };
};

/** Reconstrói o atributo `d` a partir dos pontos. */
export const serializePolyline = (points: PathPoint[], closed: boolean): string => {
  if (points.length === 0) return '';
  const body = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`)
    .join(' ');
  return closed ? `${body} Z` : body;
};

const projectOntoSegment = (p: PathPoint, a: PathPoint, b: PathPoint): PathPoint => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSquared));
  return { x: a.x + t * abx, y: a.y + t * aby };
};

/**
 * Encontra o melhor lugar para inserir um novo nó: o ponto mais próximo de `p`
 * sobre os segmentos. Devolve o índice de inserção e o ponto projetado.
 */
export const nearestInsertion = (
  points: PathPoint[],
  closed: boolean,
  p: PathPoint,
): { index: number; point: PathPoint; distance: number } | null => {
  if (points.length < 2) return null;
  const segmentCount = closed ? points.length : points.length - 1;
  let best: { index: number; point: PathPoint; distance: number } | null = null;
  for (let i = 0; i < segmentCount; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const projected = projectOntoSegment(p, a, b);
    const distance = Math.hypot(projected.x - p.x, projected.y - p.y);
    if (!best || distance < best.distance) {
      best = { index: i + 1, point: projected, distance };
    }
  }
  return best;
};
