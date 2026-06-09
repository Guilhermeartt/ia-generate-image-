import { describe, it, expect } from 'vitest';
import { extractNumberFromString, stripLetteringFromDescription } from './sceneText';

describe('extractNumberFromString', () => {
  it('extrai número puro', () => {
    expect(extractNumberFromString('3')).toBe(3);
  });
  it('extrai número de texto ("Cena 12")', () => {
    expect(extractNumberFromString('Cena 12')).toBe(12);
  });
  it('pega o primeiro número', () => {
    expect(extractNumberFromString('1a2b')).toBe(1);
  });
  it('retorna NaN sem dígitos', () => {
    expect(extractNumberFromString('abc')).toBeNaN();
    expect(extractNumberFromString('')).toBeNaN();
  });
});

describe('stripLetteringFromDescription', () => {
  it('remove a instrução LETTERING', () => {
    expect(stripLetteringFromDescription('Maria entra. LETTERING: TÍTULO')).toBe('Maria entra.');
  });
  it('remove LETTERING no meio de múltiplas linhas', () => {
    const out = stripLetteringFromDescription('Linha 1\nLETTERING: X\nLinha 2');
    expect(out).not.toMatch(/LETTERING/);
    expect(out).toContain('Linha 1');
    expect(out).toContain('Linha 2');
  });
  it('é case-insensitive', () => {
    expect(stripLetteringFromDescription('Texto lettering: algo')).toBe('Texto');
  });
  it('mantém texto sem lettering intacto', () => {
    expect(stripLetteringFromDescription('Apenas descrição visual.')).toBe('Apenas descrição visual.');
  });
  it('retorna vazio para entrada vazia', () => {
    expect(stripLetteringFromDescription('')).toBe('');
  });
  it('colapsa quebras de linha triplas', () => {
    expect(stripLetteringFromDescription('a\n\n\n\nb')).toBe('a\n\nb');
  });
});
