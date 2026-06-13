// @vitest-environment jsdom

import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DiagonalShapesOverlay from './DiagonalShapesOverlay';

vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>();
  return {
    ...actual,
    AbsoluteFill: ({
      children,
      style,
      ...props
    }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div style={style} {...props}>{children}</div>
    ),
    useCurrentFrame: () => 8,
    useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 20 }),
  };
});

describe('DiagonalShapesOverlay', () => {
  it('renderiza cinco shapes diferentes com uma paleta multicolorida', () => {
    const { container } = render(<DiagonalShapesOverlay durationFrames={20} />);
    const shapes = container.querySelectorAll('[data-transition-shape]');
    const colors = Array.from(shapes).map(shape => (shape as HTMLElement).style.background);
    const masks = Array.from(shapes).map(shape => (shape as HTMLElement).style.clipPath);

    expect(shapes).toHaveLength(5);
    expect(new Set(colors)).toHaveLength(5);
    expect(new Set(masks).size).toBeGreaterThan(3);
  });

  it('distribui os shapes em posições distintas pela diagonal', () => {
    const { container } = render(<DiagonalShapesOverlay durationFrames={20} />);
    const shapes = Array.from(container.querySelectorAll('[data-transition-shape]')) as HTMLElement[];

    expect(new Set(shapes.map(shape => shape.style.left))).toHaveLength(5);
    expect(new Set(shapes.map(shape => shape.style.top))).toHaveLength(5);
  });

  it('usa ribbons em camadas para cobrir o corte diagonal', () => {
    const { container } = render(<DiagonalShapesOverlay durationFrames={20} />);

    expect(container.querySelector('[data-transition-ribbon="shadow"]')).toBeInTheDocument();
    expect(container.querySelector('[data-transition-ribbon="main"]')).toBeInTheDocument();
    expect(container.querySelector('[data-transition-overlay="diagonal-shapes"]')).toBeInTheDocument();
  });

  it('aplica profundidade, brilho e escala nos shapes', () => {
    const { container } = render(<DiagonalShapesOverlay durationFrames={20} />);
    const first = container.querySelector('[data-transition-shape="0"]') as HTMLElement;

    expect(first.style.boxShadow).toContain('inset');
    expect(first.style.border).toContain('rgba');
    expect(first.style.transform).toContain('scale');
    expect(first.firstElementChild).not.toBeNull();
  });
});
