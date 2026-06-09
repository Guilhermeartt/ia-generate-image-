import { describe, expect, it } from 'vitest';
import { applyVisibleTextPolicy } from './promptCoherence';

describe('applyVisibleTextPolicy', () => {
  it('proíbe texto em cenas sem lettering indicado', () => {
    const prompt = applyVisibleTextPolicy('A cinematic street at night.', undefined, []);

    expect(prompt).toContain('Render no visible text of any kind');
    expect(prompt).toContain('including text present in the reference image');
  });

  it('proíbe texto quando o lettering foi desligado', () => {
    const prompt = applyVisibleTextPolicy('A cinematic street at night.', false, ['ABERTO']);

    expect(prompt).toContain('Render no visible text of any kind');
    expect(prompt).not.toContain('\nABERTO');
  });

  it('permite somente o lettering literal quando está ligado', () => {
    const prompt = applyVisibleTextPolicy('A cinematic street at night.', true, ['SÃO PAULO', '2026']);

    expect(prompt).toContain('The only visible text allowed');
    expect(prompt).toContain('SÃO PAULO\n2026');
    expect(prompt).toContain('Do not invent any other words');
  });

  it('substitui uma política anterior sem duplicar o bloco', () => {
    const first = applyVisibleTextPolicy('Base prompt', false, []);
    const second = applyVisibleTextPolicy(first, true, ['NOVO']);

    expect(second.match(/CRITICAL VISIBLE TEXT POLICY:/g)).toHaveLength(1);
    expect(second).toContain('NOVO');
    expect(second).not.toContain('Render no visible text of any kind');
  });
});
