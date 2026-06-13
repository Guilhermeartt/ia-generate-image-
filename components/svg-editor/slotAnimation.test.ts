import { describe, expect, it } from 'vitest';
import { enterExitStyle, previewDurationSeconds, slotStyleAtTime } from './slotAnimation';

describe('enterExitStyle', () => {
  it('fade usa só opacidade pelo progresso de entrada', () => {
    expect(enterExitStyle('fade', 'none', 0, 0).opacity).toBe(0);
    expect(enterExitStyle('fade', 'none', 0.5, 0).opacity).toBeCloseTo(0.5);
    expect(enterExitStyle('fade', 'none', 1, 0).opacity).toBe(1);
  });

  it('slide-up traduz no eixo Y e some quando assentado', () => {
    expect(enterExitStyle('slide-up', 'none', 0, 0).transform).toContain('translate(0px, 30px)');
    expect(enterExitStyle('slide-up', 'none', 1, 0).transform).toBeUndefined();
  });

  it('none/none = totalmente visível e sem transform', () => {
    const style = enterExitStyle('none', 'none', 0, 0);
    expect(style.opacity).toBe(1);
    expect(style.transform).toBeUndefined();
  });

  it('saída zoom reduz escala e zera opacidade', () => {
    const style = enterExitStyle('none', 'zoom', 1, 1);
    expect(style.transform).toContain('scale(');
    expect(style.opacity).toBe(0);
  });

  it('blur-in vira filtro no início e some no fim', () => {
    expect(enterExitStyle('blur-in', 'none', 0, 0).filter).toBe('blur(24px)');
    expect(enterExitStyle('blur-in', 'none', 1, 0).filter).toBeUndefined();
  });
});

describe('slotStyleAtTime', () => {
  const animation = {
    enter: 'fade',
    exit: 'fade',
    startSeconds: 1,
    endSeconds: 5,
    enterDurationSeconds: 1,
    exitDurationSeconds: 1,
  } as const;

  it('antes do início está invisível', () => {
    expect(slotStyleAtTime(animation, 0).opacity).toBe(0);
  });

  it('entre entrada e saída está visível', () => {
    expect(slotStyleAtTime(animation, 3).opacity).toBe(1);
  });

  it('ao fim da saída volta a ficar invisível', () => {
    expect(slotStyleAtTime(animation, 5).opacity).toBe(0);
  });

  it('aplica Ken Burns progressivo sem remover a animação de entrada', () => {
    const style = slotStyleAtTime({
      enter: 'fade',
      exit: 'none',
      kenBurns: { direction: 'zoom-in', intensity: 0.2 },
      kenBurnsDurationSeconds: 4,
    }, 2);

    expect(style.opacity).toBe(1);
    expect(style.transform).toContain('scale(1.1)');
  });

  it('limita a intensidade do Ken Burns e suporta movimento panorâmico', () => {
    const style = slotStyleAtTime({
      enter: 'none',
      exit: 'none',
      kenBurns: { direction: 'pan-left', intensity: 0.8 },
      kenBurnsDurationSeconds: 2,
    }, 2);

    expect(style.transform).toContain('scale(1.4)');
    expect(style.transform).toContain('translateX(-20%)');
  });
});

describe('previewDurationSeconds', () => {
  it('mínimo de 2s e cobre o fim de cada animação com folga', () => {
    expect(previewDurationSeconds([])).toBe(2);
    expect(
      previewDurationSeconds([{ enter: 'fade', exit: 'fade', endSeconds: 5 }]),
    ).toBeGreaterThan(5);
  });

  it('inclui a duração do Ken Burns no preview', () => {
    expect(previewDurationSeconds([{
      enter: 'none',
      exit: 'none',
      kenBurns: { direction: 'zoom-in', intensity: 0.1 },
      kenBurnsDurationSeconds: 8,
    }])).toBe(8);
  });
});
