// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { prepareSvgImport } from './svgImport';

describe('prepareSvgImport', () => {
  it('incorpora imagens vinculadas pelo nome do arquivo', async () => {
    const image = new File(['imagem'], 'Img_4.jpeg', { type: 'image/jpeg' });
    const result = await prepareSvgImport(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="../Links/Img_4.jpeg"/></svg>',
      [image],
    );

    expect(result.embeddedImages).toBe(1);
    expect(result.unresolvedImages).toEqual([]);
    expect(result.markup).toContain('href="data:image/jpeg;base64,');
    expect(result.markup).not.toContain('xlink:href');
  });

  it('incorpora fontes correspondentes e informa imagens ausentes', async () => {
    const font = new File(['fonte'], 'Figtree-Black.ttf', { type: 'font/ttf' });
    const result = await prepareSvgImport(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <style>.title{font-family:Figtree-Black, Figtree}</style>
        <image href="../Links/ausente.jpeg"/>
        <text class="title">Título</text>
      </svg>`,
      [font],
    );

    expect(result.embeddedFonts).toBe(1);
    expect(result.unresolvedImages).toEqual(['../Links/ausente.jpeg']);
    expect(result.markup).toContain('data-embedded-fonts="true"');
    expect(result.markup).toContain('data:font/ttf;base64,');
  });

  it('infere o MIME da imagem pela extensão quando o navegador não o informa', async () => {
    const image = new File(['imagem'], 'foto.jpg');
    const result = await prepareSvgImport(
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="foto.jpg"/></svg>',
      [image],
    );

    expect(result.embeddedImages).toBe(1);
    expect(result.markup).toContain('data:image/jpeg;base64,');
  });

  it('tolera escapes inválidos no caminho do vínculo', async () => {
    const image = new File(['imagem'], 'foto%ZZ.png', { type: 'image/png' });
    const result = await prepareSvgImport(
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="../foto%ZZ.png"/></svg>',
      [image],
    );

    expect(result.embeddedImages).toBe(1);
  });

  it('associa variantes de fonte à família usada e preserva peso e estilo', async () => {
    const font = new File(['fonte'], 'Figtree-BlackItalic.ttf');
    const result = await prepareSvgImport(
      '<svg xmlns="http://www.w3.org/2000/svg"><text font-family="Figtree">Título</text></svg>',
      [font],
    );

    expect(result.markup).toContain('font-family:"Figtree"');
    expect(result.markup).toContain('font-weight:900');
    expect(result.markup).toContain('font-style:italic');
  });
});
