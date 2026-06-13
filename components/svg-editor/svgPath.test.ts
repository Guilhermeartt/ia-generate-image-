import { describe, expect, it } from 'vitest';
import { nearestInsertion, parsePolyline, serializePolyline } from './svgPath';

describe('parsePolyline', () => {
  it('parseia um path M/L aberto', () => {
    expect(parsePolyline('M 0 0 L 10 0 L 10 10')).toEqual({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
    });
  });

  it('detecta path fechado (Z) e linhas implícitas', () => {
    const result = parsePolyline('M0 0 10 0 10 10Z');
    expect(result?.closed).toBe(true);
    expect(result?.points).toHaveLength(3);
    expect(result?.points[1]).toEqual({ x: 10, y: 0 });
  });

  it('rejeita curvas, comandos relativos e múltiplos subpaths', () => {
    expect(parsePolyline('M0 0 C 1 1 2 2 3 3')).toBeNull();
    expect(parsePolyline('m 0 0 l 10 0')).toBeNull();
    expect(parsePolyline('M0 0 L10 0 M20 20 L30 30')).toBeNull();
    expect(parsePolyline('')).toBeNull();
    expect(parsePolyline('M 0 0')).toBeNull();
  });
});

describe('serializePolyline', () => {
  it('reconstrói o d e fecha com Z', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 8 },
    ];
    expect(serializePolyline(points, false)).toBe('M 0 0 L 10 0 L 5 8');
    expect(serializePolyline(points, true)).toBe('M 0 0 L 10 0 L 5 8 Z');
  });

  it('faz round-trip com parsePolyline', () => {
    const d = 'M 0 0 L 20 0 L 20 20 L 0 20 Z';
    const parsed = parsePolyline(d)!;
    expect(serializePolyline(parsed.points, parsed.closed)).toBe(d);
  });
});

describe('nearestInsertion', () => {
  it('insere no segmento mais próximo, no ponto projetado', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const result = nearestInsertion(points, false, { x: 50, y: 10 });
    expect(result?.index).toBe(1);
    expect(result?.point).toEqual({ x: 50, y: 0 });
  });

  it('considera o segmento de fechamento quando closed', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    // ponto perto do segmento de fechamento (último→primeiro)
    const result = nearestInsertion(points, true, { x: 10, y: 50 });
    expect(result?.index).toBe(3);
  });
});
