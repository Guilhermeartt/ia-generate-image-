import { describe, it, expect } from 'vitest';
import { gcd, aspectRatioLabel, modelLabelShort } from './imageHelpers';

describe('gcd', () => {
  it('calcula o maior divisor comum', () => {
    expect(gcd(1920, 1080)).toBe(120);
    expect(gcd(12, 8)).toBe(4);
    expect(gcd(7, 13)).toBe(1);
  });
  it('lida com b = 0', () => {
    expect(gcd(5, 0)).toBe(5);
  });
});

describe('aspectRatioLabel', () => {
  it('reduz para proporções conhecidas', () => {
    expect(aspectRatioLabel(1920, 1080)).toBe('16:9');
    expect(aspectRatioLabel(1080, 1920)).toBe('9:16');
    expect(aspectRatioLabel(1000, 1000)).toBe('1:1');
    expect(aspectRatioLabel(1024, 768)).toBe('4:3');
  });
  it('retorna vazio para dimensões ausentes', () => {
    expect(aspectRatioLabel(undefined, 1080)).toBe('');
    expect(aspectRatioLabel(1920, 0)).toBe('');
  });
});

describe('modelLabelShort', () => {
  it('mapeia os modelos conhecidos', () => {
    expect(modelLabelShort('gemini-2.5-flash-image')).toBe('NB 2.5');
    expect(modelLabelShort('gemini-3.1-flash-image-preview')).toBe('NB 3.1');
    expect(modelLabelShort('gemini-3-pro-image-preview')).toBe('NB Pro');
    expect(modelLabelShort('imagen-4.0-generate-001')).toBe('Imagen 4');
  });
  it('faz fallback para o prefixo do modelo desconhecido', () => {
    expect(modelLabelShort('foo-bar-baz')).toBe('foo');
  });
});
