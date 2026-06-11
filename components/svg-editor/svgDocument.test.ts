// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  appendSvgElement,
  createBlankSvg,
  duplicateSvgElement,
  getSlotMeta,
  getSvgElementProperties,
  listSlots,
  listSvgLayers,
  markSlot,
  parseViewBox,
  removeSvgElement,
  reorderSvgElement,
  resizeSvgElement,
  sanitizeSvg,
  translateSvgElement,
  unmarkSlot,
  updateSvgElement,
  updateSvgText,
} from './svgDocument';

describe('svgDocument', () => {
  it('remove conteúdo ativo e mantém formas seguras', () => {
    const result = sanitizeSvg(`
      <svg viewBox="0 0 100 100" onload="alert(1)">
        <script>alert(1)</script>
        <foreignObject><div>perigo</div></foreignObject>
        <rect id="box" width="20" height="10" fill="red" onclick="alert(2)" />
        <path d="M0 0 L10 10" style="fill:url(javascript:alert(3))" />
      </svg>
    `);

    expect(result).toContain('<rect');
    expect(result).not.toContain('script');
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('style=');
  });

  it('cria IDs para elementos editáveis importados', () => {
    const result = sanitizeSvg('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>');
    const document = new DOMParser().parseFromString(result, 'image/svg+xml');
    expect(document.querySelector('circle')?.id).toMatch(/^circle-/);
  });

  it('adiciona, edita, move, duplica e remove uma forma', () => {
    const appended = appendSvgElement(createBlankSvg(), 'rect', {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fill: '#ff0000',
    });
    const updated = updateSvgElement(appended.markup, appended.id, {
      stroke: '#000000',
      'stroke-width': 3,
    });
    expect(getSvgElementProperties(updated, appended.id)).toMatchObject({
      fill: '#ff0000',
      stroke: '#000000',
      strokeWidth: 3,
    });

    const moved = translateSvgElement(updated, appended.id, 12, -4);
    expect(moved).toContain('translate(12 -4)');

    const duplicated = duplicateSvgElement(moved, appended.id);
    expect(duplicated.id).not.toBe(appended.id);
    expect(duplicated.markup.match(/<rect/g)).toHaveLength(2);

    const removed = removeSvgElement(duplicated.markup, appended.id);
    expect(removed.match(/<rect/g)).toHaveLength(1);
  });

  it('edita texto, geometria e ordem das camadas', () => {
    const first = appendSvgElement(createBlankSvg(), 'rect', {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
    const second = appendSvgElement(
      first.markup,
      'text',
      { x: 30, y: 40, fill: '#000000' },
      'Inicial',
    );
    const resized = resizeSvgElement(first.markup, first.id, {
      x: 5,
      y: 6,
      width: 200,
      height: 90,
    });
    expect(getSvgElementProperties(resized, first.id)).toMatchObject({
      x: 5,
      y: 6,
      width: 200,
      height: 90,
    });

    const editedText = updateSvgText(second.markup, second.id, 'Título');
    expect(getSvgElementProperties(editedText, second.id)?.text).toBe('Título');

    const sentBack = reorderSvgElement(second.markup, second.id, 'back');
    expect(listSvgLayers(sentBack).map((layer) => layer.id)).toEqual([first.id, second.id]);
  });
});

describe('slots do modelo', () => {
  const withRect = () =>
    appendSvgElement(createBlankSvg(), 'rect', { x: 10, y: 20, width: 100, height: 50 });

  it('marca, lista e remove um slot com geometria resolvida', () => {
    const { markup, id } = withRect();

    const marked = markSlot(markup, id, { type: 'image', name: 'Imagem principal' });
    expect(getSlotMeta(marked, id)).toEqual({ type: 'image', name: 'Imagem principal' });

    const slots = listSlots(marked);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      id,
      type: 'image',
      name: 'Imagem principal',
      bounds: { x: 10, y: 20, width: 100, height: 50 },
    });

    const unmarked = unmarkSlot(marked, id);
    expect(getSlotMeta(unmarked, id)).toBeNull();
    expect(listSlots(unmarked)).toHaveLength(0);
  });

  it('usa nome padrão quando vazio e atualiza o tipo de um slot existente', () => {
    const { markup, id } = withRect();
    const marked = markSlot(markup, id, { type: 'text', name: '   ' });
    expect(getSlotMeta(marked, id)).toEqual({ type: 'text', name: 'Texto' });

    const retyped = markSlot(marked, id, { type: 'icon', name: 'Selo' });
    expect(getSlotMeta(retyped, id)).toEqual({ type: 'icon', name: 'Selo' });
  });

  it('preserva o data-slot através da sanitização (round-trip de import/export)', () => {
    const { markup, id } = withRect();
    const marked = markSlot(markup, id, { type: 'image', name: 'Capa' });
    const roundTripped = sanitizeSvg(marked);
    expect(getSlotMeta(roundTripped, id)).toEqual({ type: 'image', name: 'Capa' });
  });

  it('ignora data-slot inválido', () => {
    const { markup, id } = withRect();
    const tampered = updateSvgElement(markup, id, { 'data-slot': 'não-é-json' });
    expect(getSlotMeta(tampered, id)).toBeNull();
    expect(listSlots(tampered)).toHaveLength(0);
  });

  it('lê as dimensões do viewBox', () => {
    expect(parseViewBox(createBlankSvg())).toEqual({ width: 800, height: 600 });
    expect(parseViewBox('<svg></svg>')).toBeNull();
  });

  it('persiste a animação do slot e sobrevive à sanitização', () => {
    const { markup, id } = withRect();
    const animation = {
      enter: 'slide-up',
      exit: 'fade',
      startSeconds: 0.2,
      endSeconds: 4,
      enterDurationSeconds: 0.5,
      exitDurationSeconds: 0.4,
    } as const;

    const marked = markSlot(markup, id, { type: 'image', name: 'Capa', animation });
    expect(getSlotMeta(marked, id)?.animation).toEqual(animation);
    expect(listSlots(marked)[0].animation).toEqual(animation);

    const roundTripped = sanitizeSvg(marked);
    expect(getSlotMeta(roundTripped, id)?.animation).toMatchObject({
      enter: 'slide-up',
      exit: 'fade',
      endSeconds: 4,
    });
  });
});
