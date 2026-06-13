// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { appendSvgElement, createBlankSvg, markSlot } from './svgDocument';
import { renderTemplate } from './templateRender';

const parse = (markup: string) => new DOMParser().parseFromString(markup, 'image/svg+xml');

describe('renderTemplate', () => {
  it('substitui o slot de imagem in-place preservando a ordem de pintura', () => {
    const bg = appendSvgElement(createBlankSvg(), 'rect', { x: 0, y: 0, width: 800, height: 600 });
    const slot = appendSvgElement(bg.markup, 'rect', { x: 100, y: 100, width: 200, height: 150 });
    const fg = appendSvgElement(slot.markup, 'rect', { x: 0, y: 560, width: 800, height: 40 });
    const marked = markSlot(fg.markup, slot.id, { type: 'image', name: 'Capa' });

    const out = renderTemplate(marked, [
      { id: slot.id, type: 'image', href: 'data:image/png;base64,aA==' },
    ]);
    const doc = parse(out);

    const image = doc.querySelector('image');
    expect(image?.getAttribute('href')).toBe('data:image/png;base64,aA==');
    expect(image?.getAttribute('clip-path')).toMatch(/^url\(#slot-clip-/);
    expect(image?.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
    expect(doc.querySelector('defs clipPath')).not.toBeNull();
    expect(image?.getAttribute('width')).toBe('200');

    // O slot virou <image> no mesmo ponto: fundo antes, imagem no meio, frente depois.
    const order = Array.from(doc.documentElement.children)
      .filter((c) => c.localName !== 'defs')
      .map((c) => c.localName);
    expect(order).toEqual(['rect', 'image', 'rect']);
  });

  it('preenche um slot-forma de texto com <text> centralizado', () => {
    const base = appendSvgElement(createBlankSvg(), 'rect', { x: 50, y: 50, width: 300, height: 80 });
    const marked = markSlot(base.markup, base.id, { type: 'text', name: 'Título' });

    const out = renderTemplate(marked, [{ id: base.id, type: 'text', value: 'Olá mundo' }]);
    const text = parse(out).querySelector('text');

    expect(text?.textContent).toBe('Olá mundo');
    expect(text?.getAttribute('text-anchor')).toBe('middle');
    expect(text?.getAttribute('x')).toBe('200');
    expect(text?.getAttribute('y')).toBe('90');
  });

  it('mantém posição/estilo quando o slot de texto já é um <text>', () => {
    const t = appendSvgElement(createBlankSvg(), 'text', { x: 10, y: 20, fill: '#000000' }, 'Original');
    const marked = markSlot(t.markup, t.id, { type: 'text', name: 'titulo' });

    const out = renderTemplate(marked, [{ id: t.id, type: 'text', value: 'Novo texto' }]);
    const text = parse(out).querySelector('text');

    expect(text?.textContent).toBe('Novo texto');
    expect(text?.getAttribute('x')).toBe('10');
    expect(out).not.toContain('data-slot');
  });

  it('escala um ícone para dentro do slot via <svg> aninhado', () => {
    const r = appendSvgElement(createBlankSvg(), 'rect', { x: 0, y: 0, width: 48, height: 48 });
    const marked = markSlot(r.markup, r.id, { type: 'icon', name: 'selo' });
    const icon =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';

    const out = renderTemplate(marked, [{ id: r.id, type: 'icon', svg: icon }]);
    const nested = parse(out).querySelector('svg > svg');

    expect(nested?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(nested?.getAttribute('width')).toBe('48');
    expect(nested?.querySelector('path')).not.toBeNull();
  });

  it('remove conteúdo ativo de ícones e bloqueia href de imagem perigoso', () => {
    const r = appendSvgElement(createBlankSvg(), 'rect', { x: 0, y: 0, width: 48, height: 48 });
    const iconSlot = markSlot(r.markup, r.id, { type: 'icon', name: 'selo' });
    const icon =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0h10v10z" onclick="alert(2)"/></svg>';
    const iconOut = renderTemplate(iconSlot, [{ id: r.id, type: 'icon', svg: icon }]);
    expect(iconOut).not.toContain('script');
    expect(iconOut).not.toContain('onclick');

    const imageSlot = markSlot(r.markup, r.id, { type: 'image', name: 'capa' });
    const imageOut = renderTemplate(imageSlot, [
      { id: r.id, type: 'image', href: 'javascript:alert(1)' },
    ]);
    expect(parse(imageOut).querySelector('image')?.getAttribute('href')).toBe('');
  });

  it('ignora ids de slot inexistentes sem lançar erro', () => {
    const r = appendSvgElement(createBlankSvg(), 'rect', { x: 0, y: 0, width: 10, height: 10 });
    expect(() => renderTemplate(r.markup, [{ id: 'inexistente', type: 'text', value: 'x' }])).not.toThrow();
  });

  it('envolve o slot num <g style> quando há styleById (animação)', () => {
    const r = appendSvgElement(createBlankSvg(), 'rect', { x: 0, y: 0, width: 100, height: 80 });
    const marked = markSlot(r.markup, r.id, { type: 'text', name: 'titulo' });

    const out = renderTemplate(marked, [{ id: r.id, type: 'text', value: 'Oi' }], {
      styleById: { [r.id]: { opacity: 0.5, transform: 'translate(0px, 10px)' } },
    });
    const group = parse(out).querySelector('g[style]');

    expect(group?.getAttribute('style')).toContain('opacity:0.5');
    expect(group?.getAttribute('style')).toContain('translate(0px, 10px)');
    expect(group?.querySelector('text')?.textContent).toBe('Oi');
  });

  it('aplica estilo a um slot sem conteúdo substituto', () => {
    const r = appendSvgElement(createBlankSvg(), 'rect', { x: 0, y: 0, width: 100, height: 80 });
    const marked = markSlot(r.markup, r.id, { type: 'icon', name: 'grafismo' });

    const out = renderTemplate(marked, [], {
      styleById: { [r.id]: { opacity: 0, transform: 'translate(20px, 5px) scale(1.2)' } },
    });
    const group = parse(out).querySelector(`g[data-rendered-slot-id="${r.id}"]`);

    expect(group?.getAttribute('style')).toContain('opacity:0');
    expect(group?.getAttribute('style')).toContain('translate(20px, 5px)');
    expect(group?.querySelector('rect')?.id).toBe(r.id);
  });

  it('acrescenta textos, formas, imagens e ícones exclusivos da cena', () => {
    const out = renderTemplate(createBlankSvg(), [], {
      additionalElements: [
        {
          id: 'extra-text', type: 'text', name: 'Título', x: 10, y: 20,
          width: 200, height: 60, text: 'Texto extra', fill: '#ff0000', fontSize: 32,
        },
        {
          id: 'extra-shape', type: 'shape', name: 'Fundo', x: 0, y: 0,
          width: 300, height: 100, shape: 'pill', fill: '#0000ff',
        },
        {
          id: 'extra-image', type: 'image', name: 'Foto', x: 20, y: 100,
          width: 120, height: 80, imageHref: 'data:image/png;base64,aA==', borderRadius: 12,
        },
        {
          id: 'extra-icon', type: 'icon', name: 'Selo', x: 160, y: 100,
          width: 48, height: 48,
          iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>',
        },
      ],
    });
    const doc = parse(out);

    expect(doc.querySelector('[data-scene-element-id="extra-text"] text')?.textContent).toBe('Texto extra');
    expect(doc.querySelector('[data-scene-element-id="extra-shape"] rect')?.getAttribute('rx')).toBe('50');
    expect(doc.querySelector('[data-scene-element-id="extra-image"] image')?.getAttribute('clip-path')).toMatch(/^url\(#scene-element-clip-/);
    expect(doc.querySelector('[data-scene-element-id="extra-icon"] svg path')).not.toBeNull();
  });

  it('aplica estado animado a elemento adicional', () => {
    const out = renderTemplate(createBlankSvg(), [], {
      additionalElements: [
        { id: 'extra', type: 'shape', name: 'Forma', x: 0, y: 0, width: 100, height: 50 },
      ],
      additionalStyleById: {
        extra: { opacity: 0.5, transform: 'translate(20px, 0px)' },
      },
    });
    const group = parse(out).querySelector('[data-scene-element-id="extra"]');
    expect(group?.getAttribute('style')).toContain('opacity:0.5');
    expect(group?.getAttribute('style')).toContain('translate(20px, 0px)');
  });
});
