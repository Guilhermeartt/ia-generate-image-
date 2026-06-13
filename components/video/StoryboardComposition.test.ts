import { describe, expect, it } from 'vitest';
import { transitionStyle } from './transitionEffects';

describe('transitionStyle', () => {
  it('mantém zoom blur neutro ao terminar a entrada', () => {
    const style = transitionStyle({
      type: 'zoom-blur',
      enterProgress: 1,
      exitProgress: 0,
      isIncoming: true,
    });

    expect(style.opacity).toBe(1);
    expect(style.transform).toContain('scale(1)');
    expect(style.filter).toBe('blur(0px)');
  });

  it('aplica movimento e desfoque direcionais no whip pan', () => {
    const entering = transitionStyle({
      type: 'whip-left',
      enterProgress: 0,
      exitProgress: 0,
      isIncoming: true,
    });
    const exiting = transitionStyle({
      type: 'whip-left',
      enterProgress: 1,
      exitProgress: 1,
      isIncoming: false,
    });

    expect(entering.transform).toContain('translateX(12%)');
    expect(entering.transform).toContain('scale(1.12)');
    expect(entering.filter).toBe('blur(24px)');
    expect(exiting.transform).toContain('translateX(-12%)');
    expect(exiting.transform).toContain('scale(1.12)');
    expect(exiting.filter).toBe('blur(20px)');
  });

  it('encerra o whip pan com transformação neutra no plano de entrada', () => {
    const style = transitionStyle({
      type: 'whip-right',
      enterProgress: 1,
      exitProgress: 0,
      isIncoming: true,
    });

    expect(style.transform).toBe('translateX(0%) scale(1)');
    expect(style.filter).toBe('blur(0px)');
    expect(style.opacity).toBe(1);
  });

  it('revela iris até cobrir todo o frame', () => {
    const style = transitionStyle({
      type: 'iris',
      enterProgress: 1,
      exitProgress: 0,
      isIncoming: true,
    });

    expect(style.clipPath).toBe('circle(72% at 50% 50%)');
  });

  it('gera máscara radial progressiva para clock wipe', () => {
    const style = transitionStyle({
      type: 'clock-wipe',
      enterProgress: 0.5,
      exitProgress: 0,
      isIncoming: true,
    });

    expect(style.maskImage).toContain('180deg');
    expect(style.WebkitMaskImage).toBe(style.maskImage);
  });

  it.each([
    ['shape-diamond', 4],
    ['shape-hexagon', 6],
    ['shape-star', 10],
  ] as const)('revela a cena com a máscara vetorial %s', (type, pointCount) => {
    const style = transitionStyle({
      type,
      enterProgress: 0.5,
      exitProgress: 0,
      isIncoming: true,
    });

    expect(style.clipPath).toMatch(/^polygon\(/);
    expect(style.clipPath?.split(',')).toHaveLength(pointCount);
  });

  it.each(['shape-diamond', 'shape-hexagon', 'shape-star'] as const)(
    'remove a máscara %s ao concluir a transição',
    (type) => {
      expect(transitionStyle({
        type,
        enterProgress: 1,
        exitProgress: 0,
        isIncoming: true,
      })).toEqual({});
    },
  );

  it('revela a próxima cena por um recorte diagonal', () => {
    const style = transitionStyle({
      type: 'shape-diagonal',
      enterProgress: 0.5,
      exitProgress: 0,
      isIncoming: true,
    });

    expect(style.clipPath).toBe('polygon(0 0, 32.5% 0, 67.5% 100%, 0 100%)');
    expect(style.transform).toContain('scale(1.0125)');
  });
});
