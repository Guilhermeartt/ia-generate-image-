// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  appendSvgElement,
  applyGradientFill,
  cleanupSvg,
  createBlankSvg,
  moveSvgElement,
  duplicateSvgElement,
  getSlotMeta,
  isGradientFill,
  readGradient,
  getSvgElementProperties,
  listSlots,
  listSvgLayers,
  markSlot,
  parseViewBox,
  removeSvgElement,
  reorderSvgElement,
  resizeSvgElement,
  sanitizeSvg,
  setSvgElementLocked,
  setSvgElementVisibility,
  setViewBox,
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

  it('preserva texto estruturado em vez de apagar tspans durante edição simples', () => {
    const markup = sanitizeSvg(`
      <svg viewBox="0 0 100 100">
        <text id="title"><tspan x="10" y="20">Linha 1</tspan><tspan x="10" y="40">Linha 2</tspan></text>
      </svg>
    `);
    expect(getSvgElementProperties(markup, 'title')?.structuredText).toBe(true);
    expect(updateSvgText(markup, 'title', 'Substituição')).toBe(markup);
  });

  it('bloqueia mutações com URL externa e mantém controles editoriais seguros', () => {
    const { markup, id } = appendSvgElement(createBlankSvg(), 'rect', {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fill: '#fff',
    });
    const unsafe = updateSvgElement(markup, id, { fill: 'url(https://evil.test/x)' });
    expect(getSvgElementProperties(unsafe, id)?.fill).toBe('#fff');

    const hidden = setSvgElementVisibility(markup, id, false);
    const locked = setSvgElementLocked(hidden, id, true);
    expect(listSvgLayers(locked)[0]).toMatchObject({ visible: false, locked: true });
  });

  it('lista grupos recursivamente e remapeia referências internas ao duplicar', () => {
    const markup = sanitizeSvg(`
      <svg viewBox="0 0 100 100">
        <g id="card">
          <defs><clipPath id="clip"><rect width="10" height="10"/></clipPath></defs>
          <rect id="content" width="20" height="20" clip-path="url(#clip)"/>
        </g>
      </svg>
    `);
    expect(listSvgLayers(markup).map(({ id, depth }) => ({ id, depth }))).toEqual([
      { id: 'card', depth: 0 },
      { id: 'content', depth: 1 },
    ]);

    const duplicate = duplicateSvgElement(markup, 'card');
    const document = new DOMParser().parseFromString(duplicate.markup, 'image/svg+xml');
    const groups = document.querySelectorAll('g');
    const clonedClip = groups[1].querySelector('clipPath')?.id;
    expect(clonedClip).toBeTruthy();
    expect(groups[1].querySelector('rect[clip-path]')?.getAttribute('clip-path')).toBe(
      `url(#${clonedClip})`,
    );
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
    expect(parseViewBox(createBlankSvg())).toEqual({ width: 1280, height: 720 });
    expect(parseViewBox(createBlankSvg(720, 1280))).toEqual({ width: 720, height: 1280 });
    expect(parseViewBox('<svg></svg>')).toBeNull();
  });

  it('redefine o quadro com setViewBox preservando o conteúdo', () => {
    const base = appendSvgElement(createBlankSvg(), 'rect', { x: 0, y: 0, width: 10, height: 10 });
    const reframed = setViewBox(base.markup, 720, 1280);
    expect(parseViewBox(reframed)).toEqual({ width: 720, height: 1280 });
    expect(reframed).toContain('<rect');
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

describe('sanitizeSvg — import fiel e seguro', () => {
  it('materializa classes CSS, style inline e herança sem perder cor ou tipografia', () => {
    const result = sanitizeSvg(`
      <svg viewBox="0 0 400 200">
        <style>
          .title { fill: rgb(17, 34, 51); font: 700 28px "Inter"; letter-spacing: 1.5px; text-anchor: middle; }
          #accent { stroke: #abcdef; stroke-width: 3px; }
        </style>
        <g fill="#123456" font-family="Arial" font-size="20">
          <text id="title" class="title" x="200" y="50" textLength="180" lengthAdjust="spacingAndGlyphs">Título</text>
          <text id="subtitle" x="10" y="100" style="fill:#fedcba;font-size:18px">Subtítulo</text>
          <path id="accent" d="M0 0 L10 10"/>
        </g>
      </svg>
    `);

    expect(result).not.toContain('<style');
    expect(result).not.toContain('class=');
    expect(getSvgElementProperties(result, 'title')).toMatchObject({
      fill: 'rgb(17, 34, 51)',
      fontFamily: '"Inter"',
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: '1.5px',
      textAnchor: 'middle',
      textLength: 180,
      lengthAdjust: 'spacingAndGlyphs',
    });
    expect(getSvgElementProperties(result, 'subtitle')).toMatchObject({
      fill: 'rgb(254, 220, 186)',
      fontFamily: 'Arial',
      fontSize: 18,
    });
    expect(getSvgElementProperties(result, 'accent')).toMatchObject({
      fill: '#123456',
      stroke: 'rgb(171, 205, 239)',
      strokeWidth: 3,
    });
  });

  it('resolve currentColor herdado para a cor exibida no painel', () => {
    const result = sanitizeSvg(`
      <svg viewBox="0 0 10 10" color="#336699">
        <path id="icon" fill="currentColor" d="M0 0 L10 10"/>
      </svg>
    `);
    expect(getSvgElementProperties(result, 'icon')?.fill).toBe('#336699');
  });

  it('preserva apenas fontes embutidas seguras em style dedicado', () => {
    const result = sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style data-embedded-fonts="true">
            @font-face{font-family:"Figtree-Black";src:url("data:font/ttf;base64,QUJD") format("truetype");font-weight:900;font-style:italic;font-display:block}
          </style>
          <style>.evil{fill:red}</style>
        </defs>
        <text font-family="Figtree-Black">Título</text>
      </svg>
    `);
    expect(result).toContain('data-embedded-fonts="true"');
    expect(result).toContain('data:font/ttf;base64,QUJD');
    expect(result).toContain('font-weight:900');
    expect(result).toContain('font-style:italic');
    expect(result).not.toContain('.evil');
  });

  it('descarta fontes com MIME e formato incompatíveis', () => {
    const result = sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style data-embedded-fonts="true">
            @font-face{font-family:"Teste";src:url("data:font/ttf;base64,QUJD") format("woff2")}
          </style>
        </defs>
        <text>Texto</text>
      </svg>
    `);
    expect(result).not.toContain('data-embedded-fonts');
    expect(result).not.toContain('@font-face');
  });

  it('preserva gradientes, filtros, blend mode, style seguro, use e imagem embutida', () => {
    const result = sanitizeSvg(`
      <svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="3"/><feDropShadow dx="2" dy="2"/></filter>
          <symbol id="star"><path d="M0 0 L5 5"/></symbol>
        </defs>
        <rect width="50" height="50" fill="url(#g)" filter="url(#blur)" style="mix-blend-mode:multiply;paint-order:stroke"/>
        <use href="#star" x="10" y="10"/>
        <image href="data:image/png;base64,iVBORw0KGgo=" width="20" height="20"/>
        <text letter-spacing="2" paint-order="stroke">Olá</text>
      </svg>
    `);

    expect(result).toContain('linearGradient');
    expect(result).toContain('feGaussianBlur');
    expect(result).toContain('feDropShadow');
    expect(result).toContain('fill="url(#g)"');
    expect(result).toContain('mix-blend-mode="multiply"');
    expect(result).toContain('paint-order="stroke"');
    expect(result).toContain('letter-spacing="2"');
    expect(result).toContain('<use');
    expect(result).toContain('href="#star"');
    expect(result).toContain('data:image/png;base64');
  });

  it('remove style perigoso, href externo e data:image/svg+xml, mantendo o resto', () => {
    const result = sanitizeSvg(`
      <svg viewBox="0 0 100 100">
        <rect width="10" height="10" style="fill:#0f0;background:url(https://evil.test/x.png)"/>
        <image href="https://evil.test/x.png" width="10" height="10"/>
        <use href="javascript:alert(1)"/>
        <use href="data:image/svg+xml,&lt;svg onload=alert(1)&gt;"/>
      </svg>
    `);

    expect(result).toContain('<rect');
    expect(result).not.toContain('evil.test');
    expect(result).not.toContain('javascript:');
    // data:image/svg+xml (vetor SVG-em-data-URI) é descartado; raster seria mantido.
    expect(result).not.toContain('svg+xml');
    expect(result).not.toContain('onload');
    // O style inteiro é descartado por conter url() externa.
    expect(result).not.toContain('style=');
  });

  it('mantém data:image raster (png) em href', () => {
    const result = sanitizeSvg(
      '<svg viewBox="0 0 10 10"><image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/></svg>',
    );
    expect(result).toContain('data:image/png;base64');
  });

  it('remove data:image raster que não esteja codificada em base64', () => {
    const result = sanitizeSvg(
      '<svg viewBox="0 0 10 10"><image href="data:image/png,&lt;script&gt;alert(1)&lt;/script&gt;"/></svg>',
    );
    expect(result).not.toContain('data:image/png');
    expect(result).not.toContain('script');
  });

  it('continua removendo script, handlers e foreignObject', () => {
    const result = sanitizeSvg(`
      <svg viewBox="0 0 10 10" onload="alert(1)">
        <script>alert(1)</script>
        <foreignObject><div>x</div></foreignObject>
        <rect width="5" height="5" onclick="alert(2)" style="behavior:url(#x)"/>
      </svg>
    `);
    expect(result).toContain('<rect');
    expect(result).not.toContain('script');
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('behavior');
  });
});

describe('degradês (gradientes)', () => {
  const linearSpec = {
    type: 'linear' as const,
    angle: 90,
    stops: [
      { offset: 0, color: '#ff0000', opacity: 1 },
      { offset: 1, color: '#0000ff', opacity: 0.5 },
    ],
  };

  it('isGradientFill distingue url(#id) de cor sólida', () => {
    expect(isGradientFill('url(#g)')).toBe(true);
    expect(isGradientFill('#ff0000')).toBe(false);
    expect(isGradientFill('none')).toBe(false);
  });

  it('aplica um degradê linear e o lê de volta (round-trip)', () => {
    const { markup, id } = appendSvgElement(createBlankSvg(), 'rect', {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const withGradient = applyGradientFill(markup, id, linearSpec);

    expect(getSvgElementProperties(withGradient, id)?.fill).toMatch(/^url\(#grad-/);
    expect(withGradient).toContain('<linearGradient');
    expect(withGradient).toContain('stop-color="#ff0000"');
    expect(withGradient).toContain('stop-opacity');

    const read = readGradient(withGradient, id);
    expect(read?.type).toBe('linear');
    expect(read?.angle).toBe(90);
    expect(read?.stops).toHaveLength(2);
    expect(read?.stops[0]).toMatchObject({ offset: 0, color: '#ff0000' });
    expect(read?.stops[1].opacity).toBeCloseTo(0.5);
  });

  it('troca linear→radial reutilizando o mesmo id de gradiente', () => {
    const { markup, id } = appendSvgElement(createBlankSvg(), 'rect', {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    const linear = applyGradientFill(markup, id, linearSpec);
    const gradId = getSvgElementProperties(linear, id)?.fill;

    const radial = applyGradientFill(linear, id, { ...linearSpec, type: 'radial' });
    expect(getSvgElementProperties(radial, id)?.fill).toBe(gradId);
    expect(radial).toContain('<radialGradient');
    expect(radial).not.toContain('<linearGradient');
    expect(readGradient(radial, id)?.type).toBe('radial');
  });

  it('readGradient devolve null para preenchimento sólido', () => {
    const { markup, id } = appendSvgElement(createBlankSvg(), 'rect', {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fill: '#123456',
    });
    expect(readGradient(markup, id)).toBeNull();
  });
});

describe('cleanupSvg', () => {
  it('remove ocultos (display:none, opacity 0, tamanho zero), mantém visíveis', () => {
    const { markup, summary } = cleanupSvg(`
      <svg viewBox="0 0 100 100">
        <rect id="ok" x="0" y="0" width="10" height="10" fill="#000"/>
        <rect id="none" display="none" width="10" height="10"/>
        <rect id="op0" opacity="0" width="10" height="10"/>
        <rect id="zero" width="0" height="10"/>
        <circle id="visivel" cx="5" cy="5" r="4"/>
      </svg>
    `);
    expect(markup).toContain('id="ok"');
    expect(markup).toContain('id="visivel"');
    expect(markup).not.toContain('id="none"');
    expect(markup).not.toContain('id="op0"');
    expect(markup).not.toContain('id="zero"');
    expect(summary.hidden).toBe(3);
  });

  it('achata grupo redundante mas mantém grupo com transform', () => {
    const { markup, summary } = cleanupSvg(`
      <svg viewBox="0 0 100 100">
        <g><rect id="a" width="10" height="10"/><rect id="b" width="10" height="10"/></g>
        <g transform="translate(5 5)"><rect id="c" width="10" height="10"/></g>
        <g id="vazio"></g>
      </svg>
    `);
    expect(markup).toContain('id="a"');
    expect(markup).toContain('id="b"');
    expect(markup).toContain('transform="translate(5 5)"');
    expect(markup).not.toContain('id="vazio"');
    // o grupo sem atributos foi desembrulhado: rect a/b agora são filhos diretos
    expect(markup.match(/<g[ >]/g)?.length).toBe(1);
    expect(summary.groups).toBeGreaterThanOrEqual(2);
  });

  it('remove defs órfãos mas mantém os referenciados', () => {
    const { markup, summary } = cleanupSvg(`
      <svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="usado"><stop offset="0" stop-color="#f00"/></linearGradient>
          <linearGradient id="orfao"><stop offset="0" stop-color="#0f0"/></linearGradient>
        </defs>
        <rect width="10" height="10" fill="url(#usado)"/>
      </svg>
    `);
    expect(markup).toContain('id="usado"');
    expect(markup).not.toContain('id="orfao"');
    expect(summary.defs).toBe(1);
  });

  it('não remove elemento oculto que é referenciado por id', () => {
    const { markup } = cleanupSvg(`
      <svg viewBox="0 0 100 100">
        <rect id="fonte" display="none" width="10" height="10"/>
        <use href="#fonte" x="20" y="20"/>
      </svg>
    `);
    expect(markup).toContain('id="fonte"');
  });
});

describe('moveSvgElement', () => {
  const order = (markup: string) => [...markup.matchAll(/<rect id="([^"]+)"/g)].map((m) => m[1]);

  it('reordena: move um elemento para antes de outro', () => {
    const a = appendSvgElement(createBlankSvg(), 'rect', { x: 0, y: 0, width: 10, height: 10 });
    const b = appendSvgElement(a.markup, 'rect', { x: 0, y: 0, width: 10, height: 10 });
    const c = appendSvgElement(b.markup, 'rect', { x: 0, y: 0, width: 10, height: 10 });
    // DOM: [a, b, c] → mover c para antes de a
    expect(order(moveSvgElement(c.markup, c.id, a.id, true))).toEqual([c.id, a.id, b.id]);
    // mover a para depois de c
    expect(order(moveSvgElement(c.markup, a.id, c.id, false))).toEqual([b.id, c.id, a.id]);
  });

  it('re-parenta ao mover para junto de um filho de grupo', () => {
    const markup = sanitizeSvg(
      '<svg viewBox="0 0 100 100"><g id="g1"><rect id="r1" width="10" height="10"/></g><rect id="r2" width="10" height="10"/></svg>',
    );
    const moved = moveSvgElement(markup, 'r2', 'r1', true);
    expect(/<g id="g1">.*id="r2".*id="r1".*<\/g>/s.test(moved)).toBe(true);
  });

  it('não move um grupo para dentro de si mesmo', () => {
    const markup = sanitizeSvg(
      '<svg viewBox="0 0 100 100"><g id="g1"><rect id="r1" width="10" height="10"/></g></svg>',
    );
    expect(moveSvgElement(markup, 'g1', 'r1', true)).toBe(markup);
  });
});
