import { describe, expect, it } from 'vitest';
import type { Scene } from '../../types';
import type { TemplateSlot } from './types';
import {
  buildPreviewContents,
  buildSceneSlotStyles,
  resolveSlotContents,
} from './templateBinding';

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
  it('distribui múltiplas imagens da cena entre múltiplos slots', () => {
    const slots = [
      slot('a', 'image', 'capa'),
      slot('b', 'image', 'detalhe'),
      slot('c', 'image', 'final'),
    ];
    const contents = resolveSlotContents(slots, scene({
      splitImages: [{ id: 'split-1', prompt: '', imageUrl: 'SPLIT', imageMimeType: 'image/png' }],
      endFrameUrl: 'END',
    }));
    expect(contents).toEqual([
      { id: 'a', type: 'image', href: 'IMG', fit: undefined },
      { id: 'b', type: 'image', href: 'SPLIT', fit: undefined },
      { id: 'c', type: 'image', href: 'END', fit: undefined },
    ]);
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

  it('resolve vários ícones de forma independente por id', () => {
    const slots = [slot('i1', 'icon', 'estrela'), slot('i2', 'icon', 'seta')];
    const contents = resolveSlotContents(slots, scene(), {
      i1: { iconSvg: '<svg><path d="M0 0h1v1z"/></svg>', fill: '#ff0000' },
      i2: { iconSvg: '<svg><circle cx="1" cy="1" r="1"/></svg>' },
    });
    expect(contents).toEqual([
      { id: 'i1', type: 'icon', svg: '<svg><path d="M0 0h1v1z"/></svg>', fill: '#ff0000' },
      { id: 'i2', type: 'icon', svg: '<svg><circle cx="1" cy="1" r="1"/></svg>', fill: undefined },
    ]);
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

describe('buildSceneSlotStyles', () => {
  it('combina transformação, opacidade e animação por slot', () => {
    const slots = [slot('a', 'text', 'Título'), slot('b', 'icon', 'Selo')];
    const styles = buildSceneSlotStyles(
      slots,
      {
        a: { translateX: 20, translateY: -4, scale: 1.2, rotation: 5, opacity: 0.8 },
        b: { hidden: true },
      },
      {
        a: { opacity: 0.5, transform: 'translate(0px, 10px)' },
      },
    );

    expect(styles.a.opacity).toBeCloseTo(0.4);
    expect(styles.a.transform).toContain('translate(20px, -4px)');
    expect(styles.a.transform).toContain('rotate(5deg)');
    expect(styles.a.transform).toContain('scale(1.2)');
    expect(styles.a.transform).toContain('translate(0px, 10px)');
    expect(styles.b.opacity).toBe(0);
  });
});
