// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Scene } from '../../types';
import type { TemplateSlot } from '../svg-editor/types';
import SceneTemplateEditorModal from './SceneTemplateEditorModal';

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

    fireEvent.click(screen.getByRole('button', { name: 'Texto' }));
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
});
