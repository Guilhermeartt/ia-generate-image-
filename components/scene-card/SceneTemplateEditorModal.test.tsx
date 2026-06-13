// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scene, SceneTemplateElement } from '../../types';
import type { TemplateSlot } from '../svg-editor/types';
import SceneTemplateEditorModal from './SceneTemplateEditorModal';

afterEach(cleanup);

const slots: TemplateSlot[] = [
  { id: 'title', type: 'text', name: 'Título', bounds: { x: 0, y: 0, width: 100, height: 20 } },
  { id: 'subtitle', type: 'text', name: 'Subtítulo', bounds: { x: 0, y: 25, width: 100, height: 20 } },
  { id: 'main', type: 'image', name: 'Imagem principal', bounds: { x: 0, y: 50, width: 100, height: 80 } },
  { id: 'detail', type: 'image', name: 'Detalhe', bounds: { x: 105, y: 50, width: 50, height: 80 } },
  { id: 'icon-a', type: 'icon', name: 'Ícone A', bounds: { x: 0, y: 135, width: 20, height: 20 } },
  { id: 'icon-b', type: 'icon', name: 'Ícone B', bounds: { x: 25, y: 135, width: 20, height: 20 } },
];

const markup = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
    ${slots.map((slot) => (
      `<rect id="${slot.id}" x="${slot.bounds.x}" y="${slot.bounds.y}" width="${slot.bounds.width}" height="${slot.bounds.height}" data-slot='{"type":"${slot.type}","name":"${slot.name}"}'/>`
    )).join('')}
  </svg>
`;

const scene = {
  imageUrl: 'data:image/png;base64,aA==',
  splitImages: [{ id: 'split', prompt: '', imageUrl: 'data:image/png;base64,Yg==' }],
  lettering_notes: ['Texto principal'],
  original_description: 'Descrição',
  original_location: 'Local',
} as unknown as Scene;

describe('SceneTemplateEditorModal', () => {
  it('lista e permite editar qualquer quantidade de slots por id', () => {
    const onChange = vi.fn();
    const onElementsChange = vi.fn();
    render(
      <SceneTemplateEditorModal
        scene={scene}
        markup={markup}
        slots={slots}
        onClose={vi.fn()}
        onChange={onChange}
        onElementsChange={onElementsChange}
      />,
    );

    expect(screen.getByText('6 elementos · alterações exclusivas desta cena')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1. Título (text)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6. Ícone B (icon)' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'Título ajustado' } });
    expect(onChange).toHaveBeenCalledWith('title', { text: 'Título ajustado' });

    fireEvent.click(screen.getByRole('button', { name: '6. Ícone B (icon)' }));
    fireEvent.click(screen.getByRole('button', { name: 'estrela' }));
    expect(onChange).toHaveBeenLastCalledWith(
      'icon-b',
      expect.objectContaining({ iconSvg: expect.stringContaining('<svg') }),
    );

    fireEvent.click(screen.getByRole('button', { name: '1. Título (text)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar Título' }));
    expect(onElementsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ type: 'text', name: 'Título cópia', text: 'Texto principal' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar texto' }));
    expect(onElementsChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'text', text: 'Novo texto' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Lower third' }));
    expect(onElementsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ type: 'shape', name: 'Barra inferior' }),
      expect.objectContaining({ type: 'shape', name: 'Destaque' }),
      expect.objectContaining({ type: 'text', name: 'Nome' }),
      expect.objectContaining({ type: 'text', name: 'Descrição' }),
    ]);
  });

  it('organiza camadas e duplica textos e imagens', () => {
    const initialElements: SceneTemplateElement[] = [
      {
        id: 'text-extra', type: 'text' as const, name: 'Texto extra',
        x: 10, y: 10, width: 100, height: 30, text: 'Oi',
        fill: '#ffcc00', fontFamily: 'Inter', fontSize: 28, fontWeight: 800,
      },
      {
        id: 'image-extra', type: 'image' as const, name: 'Imagem extra',
        x: 20, y: 50, width: 100, height: 80, imageHref: 'data:image/png;base64,aA==',
      },
    ];

    const Harness = () => {
      const [elements, setElements] = React.useState(initialElements);
      return (
        <>
          <span data-testid="state">{JSON.stringify(elements)}</span>
          <SceneTemplateEditorModal
            scene={{ ...scene, templateElements: elements }}
            markup={markup}
            slots={slots}
            onClose={vi.fn()}
            onChange={vi.fn()}
            onElementsChange={setElements}
          />
        </>
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Duplicar Texto extra' }));
    expect(screen.getByRole('button', { name: 'Texto extra cópia (text)' })).toBeInTheDocument();
    const duplicatedText = JSON.parse(screen.getByTestId('state').textContent ?? '[]')[1];
    expect(duplicatedText).toMatchObject({
      x: 10,
      y: 10,
      width: 100,
      height: 30,
      text: 'Oi',
      fill: '#ffcc00',
      fontFamily: 'Inter',
      fontSize: 28,
      fontWeight: 800,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Duplicar Imagem extra' }));
    expect(screen.getByRole('button', { name: 'Imagem extra cópia (image)' })).toBeInTheDocument();
    expect(screen.getByText(/duplicado na mesma posição/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar Imagem extra para trás' }));
    expect(screen.getByText('camada 2 · image')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar camada'), { target: { value: 'imagem' } });
    expect(screen.queryByRole('button', { name: 'Texto extra (text)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imagem extra (image)' })).toBeInTheDocument();

    expect(screen.getByLabelText('Zoom do canvas')).toHaveTextContent('100%');
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }));
    expect(screen.getByLabelText('Zoom do canvas')).toHaveTextContent('125%');
  });

  it('vincula um shape como máscara e o oculta automaticamente', () => {
    const initialElements: SceneTemplateElement[] = [
      {
        id: 'shape-mask', type: 'shape' as const, name: 'Shape máscara',
        x: 30, y: 40, width: 80, height: 80, shape: 'circle' as const,
      },
      {
        id: 'image-mask', type: 'image' as const, name: 'Imagem mascarada',
        x: 0, y: 0, width: 100, height: 100, imageHref: 'data:image/png;base64,aA==',
      },
    ];

    const Harness = () => {
      const [elements, setElements] = React.useState(initialElements);
      return (
        <>
          <span data-testid="state">{JSON.stringify(elements)}</span>
          <SceneTemplateEditorModal
            scene={{ ...scene, templateElements: elements }}
            markup={markup}
            slots={slots}
            onClose={vi.fn()}
            onChange={vi.fn()}
            onElementsChange={setElements}
          />
        </>
      );
    };

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Imagem mascarada (image)' }));
    const maskSelectors = screen.getAllByLabelText('Usar shape da cena como máscara');
    fireEvent.change(maskSelectors[maskSelectors.length - 1], {
      target: { value: 'shape-mask' },
    });

    expect(screen.getByTestId('state').textContent).toContain('"maskElementId":"shape-mask"');
    expect(screen.getByTestId('state').textContent).toContain('"hidden":true');
  });

  it('duplica texto do modelo com posição e tipografia idênticas', () => {
    const textMarkup = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
        <text
          id="headline"
          x="72"
          y="96"
          fill="#fed766"
          font-family="Montserrat"
          font-size="42"
          font-weight="800"
          font-style="italic"
          letter-spacing="1.5"
          text-decoration="underline"
          text-anchor="middle"
          stroke="#111111"
          stroke-width="2"
          transform="translate(8 4)"
          data-slot='{"type":"text","name":"Headline"}'
        >Original</text>
      </svg>
    `;
    const textSlots: TemplateSlot[] = [
      { id: 'headline', type: 'text', name: 'Headline', bounds: { x: 72, y: 96, width: 0, height: 0 } },
    ];
    const onElementsChange = vi.fn();

    render(
      <SceneTemplateEditorModal
        scene={{ ...scene, lettering_notes: ['Conteúdo aplicado'] }}
        markup={textMarkup}
        slots={textSlots}
        onClose={vi.fn()}
        onChange={vi.fn()}
        onElementsChange={onElementsChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Duplicar Headline' }));
    expect(onElementsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'text',
        text: 'Conteúdo aplicado',
        x: 72,
        y: 96,
        fontFamily: 'Montserrat',
        fontSize: 42,
        fontWeight: '800',
        fontStyle: 'italic',
        letterSpacing: '1.5',
        textDecoration: 'underline',
        fill: '#fed766',
        stroke: '#111111',
        strokeWidth: 2,
        textAlign: 'middle',
        textPositionMode: 'baseline',
        sourceTransform: 'translate(8 4)',
      }),
    ]);
  });

  it('oferece Ken Burns para imagens e preserva a configuração na cena', () => {
    const onChange = vi.fn();
    const Harness = () => {
      const [overrides, setOverrides] = React.useState<Scene['templateOverrides']>({});
      return (
        <SceneTemplateEditorModal
          scene={{ ...scene, templateOverrides: overrides }}
          markup={markup}
          slots={slots}
          onClose={vi.fn()}
          onChange={(slotId, next) => {
            onChange(slotId, next);
            setOverrides((current) => ({ ...current, [slotId]: next ?? {} }));
          }}
          onElementsChange={vi.fn()}
        />
      );
    };
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: '3. Imagem principal (image)' }));
    fireEvent.click(screen.getByLabelText('Animar'));
    fireEvent.change(screen.getByLabelText('Movimento Ken Burns'), {
      target: { value: 'zoom-in' },
    });
    fireEvent.change(screen.getByLabelText('Intensidade Ken Burns'), {
      target: { value: '0.2' },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      'main',
      expect.objectContaining({
        animation: expect.objectContaining({
          kenBurns: { direction: 'zoom-in', intensity: 0.2 },
        }),
      }),
    );
  });

  it('alinha elementos ao quadro e controla guias e áreas seguras', () => {
    const initialElements: SceneTemplateElement[] = [
      {
        id: 'align-me',
        type: 'text',
        name: 'Alinhar',
        x: 12,
        y: 18,
        width: 100,
        height: 20,
        text: 'Texto',
      },
    ];
    const Harness = () => {
      const [elements, setElements] = React.useState(initialElements);
      return (
        <>
          <span data-testid="alignment-state">{JSON.stringify(elements)}</span>
          <SceneTemplateEditorModal
            scene={{ ...scene, templateElements: elements }}
            markup={markup}
            slots={[]}
            onClose={vi.fn()}
            onChange={vi.fn()}
            onElementsChange={setElements}
          />
        </>
      );
    };

    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Alinhar (text)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Centro H' }));
    expect(screen.getByTestId('alignment-state').textContent).toContain('"x":30');

    expect(container.querySelector('.scene-template-guides')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Guias' }));
    expect(container.querySelector('.scene-template-guides')).toBeNull();

    fireEvent.change(screen.getByLabelText('Área segura de vídeo'), {
      target: { value: 'both' },
    });
    expect(container.querySelector('.safe-action')).not.toBeNull();
    expect(container.querySelector('.safe-title')).not.toBeNull();
  });
});
