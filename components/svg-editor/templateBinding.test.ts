import { describe, expect, it } from 'vitest';
import type { Scene } from '../../types';
import type { TemplateSlot } from './types';
import { buildPreviewContents, resolveSlotContents } from './templateBinding';

const slot = (id: string, type: TemplateSlot['type'], name: string): TemplateSlot => ({
  id,
  type,
  name,
  bounds: { x: 0, y: 0, width: 10, height: 10 },
});

const scene = (over: Partial<Scene> = {}): Scene =>
  ({
    imageUrl: 'IMG',
    lettering_notes: ['Lettering'],
    original_description: 'Descrição',
    original_location: 'Local',
    ...over,
  }) as unknown as Scene;

describe('resolveSlotContents', () => {
  it('liga a imagem principal ao primeiro slot de imagem e ignora os demais', () => {
    const slots = [slot('a', 'image', 'capa'), slot('b', 'image', 'fundo')];
    const contents = resolveSlotContents(slots, scene());
    expect(contents).toEqual([{ id: 'a', type: 'image', href: 'IMG' }]);
  });

  it('preenche slots de texto por prioridade: lettering, descrição, local', () => {
    const slots = [slot('t1', 'text', 'titulo'), slot('t2', 'text', 'sub'), slot('t3', 'text', 'fonte')];
    const contents = resolveSlotContents(slots, scene());
    expect(contents).toEqual([
      { id: 't1', type: 'text', value: 'Lettering' },
      { id: 't2', type: 'text', value: 'Descrição' },
      { id: 't3', type: 'text', value: 'Local' },
    ]);
  });

  it('respeita overrides por slot', () => {
    const slots = [slot('a', 'image', 'capa'), slot('t1', 'text', 'titulo')];
    const contents = resolveSlotContents(slots, scene(), {
      a: { imageHref: 'OUTRA' },
      t1: { text: 'Fixo' },
    });
    expect(contents).toContainEqual({ id: 'a', type: 'image', href: 'OUTRA' });
    expect(contents).toContainEqual({ id: 't1', type: 'text', value: 'Fixo' });
  });

  it('não gera conteúdo de imagem quando a cena não tem imagem', () => {
    const slots = [slot('a', 'image', 'capa')];
    const contents = resolveSlotContents(slots, scene({ imageUrl: undefined }));
    expect(contents).toEqual([]);
  });
});

describe('buildPreviewContents', () => {
  it('gera conteúdo de exemplo para cada tipo de slot', () => {
    const slots = [slot('a', 'image', 'capa'), slot('t', 'text', 'Título'), slot('i', 'icon', 'selo')];
    const contents = buildPreviewContents(slots);
    expect(contents[0]).toMatchObject({ id: 'a', type: 'image' });
    expect((contents[0] as { href: string }).href).toContain('data:image/png;base64');
    expect(contents[1]).toEqual({ id: 't', type: 'text', value: 'Título' });
    expect(contents[2]).toMatchObject({ id: 'i', type: 'icon' });
  });
});
